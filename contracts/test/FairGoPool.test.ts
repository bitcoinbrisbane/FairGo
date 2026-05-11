import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";

const WAD = 10n ** 18n;
const DAY = 24n * 60n * 60n;
const MONTH = 30n * DAY;
const WAIT = 30n * DAY;
const K_WAD = (3n * WAD) / 2n; // 1.5
const FEE_TIER = 500n; // 0.05% — irrelevant for the mock router

// 1:1 mock rates so round-trip swaps are loss-free — this lets us assert exact
// AUDM amounts on payouts and withdrawals. Slippage behaviour is still
// exercised via deposit `minUsdtOut` and payClaim `maxUsdtIn` thresholds.
const RATE_AUDM_USDT = WAD;
const RATE_USDT_AUDM = WAD;

const NEAR = (a: bigint, b: bigint, eps = WAD / 2000n) => {
  const diff = a > b ? a - b : b - a;
  if (diff > eps) {
    throw new Error(`expected ${a} ~ ${b} (diff ${diff} > eps ${eps})`);
  }
};

async function deployFixture() {
  const [admin, oracle, treasury, alice] = await ethers.getSigners();

  const audm = await (await ethers.getContractFactory("MockAUDM")).deploy();
  const usdt = await (await ethers.getContractFactory("MockUSDT")).deploy();
  const nft = await (await ethers.getContractFactory("CoverageNFT")).deploy(admin.address);

  const router = await (await ethers.getContractFactory("MockSwapRouter")).deploy();
  await router.setRate(await audm.getAddress(), await usdt.getAddress(), RATE_AUDM_USDT);
  await router.setRate(await usdt.getAddress(), await audm.getAddress(), RATE_USDT_AUDM);
  // Fund the router with both sides so swaps in either direction can settle.
  await audm.mint(await router.getAddress(), 1_000_000n * WAD);
  await usdt.mint(await router.getAddress(), 1_000_000n * WAD);

  const aave = await (await ethers.getContractFactory("MockAavePool")).deploy(await usdt.getAddress());

  const pool = await (
    await ethers.getContractFactory("FairGoPool")
  ).deploy(
    await audm.getAddress(),
    await usdt.getAddress(),
    await aave.getAddress(), // mock acts as its own aToken
    await nft.getAddress(),
    await router.getAddress(),
    await aave.getAddress(),
    FEE_TIER,
    admin.address,
    WAIT,
    K_WAD
  );

  await nft.connect(admin).grantRole(await nft.MINTER_ROLE(), await pool.getAddress());
  await pool.connect(admin).grantRole(await pool.ORACLE_ROLE(), oracle.address);
  await pool.connect(admin).grantRole(await pool.TREASURY_ROLE(), treasury.address);

  await audm.mint(alice.address, 10_000n * WAD);

  return { admin, oracle, treasury, alice, audm, usdt, nft, router, aave, pool };
}

async function depositAlice(stake = 120n * WAD) {
  const fx = await deployFixture();
  await fx.audm.connect(fx.alice).approve(await fx.pool.getAddress(), stake);
  // expected USDT out for the 80% leg, with 0.5% slippage tolerance
  const investAudm = (stake * 8000n) / 10000n;
  const expectedUsdt = (investAudm * RATE_AUDM_USDT) / WAD;
  const minUsdtOut = (expectedUsdt * 9950n) / 10000n;
  await fx.pool.connect(fx.alice).deposit(stake, ethers.ZeroHash, minUsdtOut);
  return { ...fx, stake, investAudm, expectedUsdt };
}

describe("FairGoPool — deposit splits AUDM 80/20 and parks USDT in AAVE", () => {
  it("supplies 80% as USDT into AAVE, keeps 20% as AUDM buffer", async () => {
    const { audm, usdt, aave, pool, stake, investAudm, expectedUsdt } = await depositAlice();

    // 80% leg swapped → supplied to AAVE
    expect(await pool.usdtPrincipal()).to.equal(expectedUsdt);
    expect(await aave.principalOf(await pool.getAddress())).to.equal(expectedUsdt);

    // 20% AUDM buffer remains in the pool
    const buffer = stake - investAudm;
    expect(await audm.balanceOf(await pool.getAddress())).to.equal(buffer);
  });

  it("reverts the deposit if Uniswap slippage is exceeded", async () => {
    const fx = await deployFixture();
    const stake = 120n * WAD;
    await fx.audm.connect(fx.alice).approve(await fx.pool.getAddress(), stake);
    // Demand more USDT out than 1:1 rate can produce.
    const investAudm = (stake * 8000n) / 10000n;
    await expect(
      fx.pool.connect(fx.alice).deposit(stake, ethers.ZeroHash, investAudm + 1n)
    ).to.be.revertedWithCustomError(fx.router, "Slippage");
  });

  it("mints the soulbound coverage NFT and records the position", async () => {
    const { alice, nft, pool, stake } = await depositAlice();
    expect(await nft.ownerOf(1)).to.equal(alice.address);
    expect(await nft.locked(1)).to.equal(true);
    const pos = await pool.positionOf(1);
    expect(pos.stake).to.equal(stake);
    expect(pos.totalPaid).to.equal(0n);
  });

  it("rejects deposit of zero", async () => {
    const { alice, pool } = await deployFixture();
    await expect(
      pool.connect(alice).deposit(0, ethers.ZeroHash, 0)
    ).to.be.revertedWithCustomError(pool, "ZeroAmount");
  });
});

describe("FairGoPool — withdrawal", () => {
  it("locks withdrawal during the wait period", async () => {
    const { alice, pool } = await depositAlice();
    await expect(pool.connect(alice).withdraw(1, 0)).to.be.revertedWithCustomError(pool, "PositionLocked");
  });

  it("returns full AUDM stake by unwinding AAVE + swapping USDT back", async () => {
    const { alice, audm, usdt, aave, pool, stake } = await depositAlice();
    await time.increase(Number(WAIT) + 1);

    // Stake (120) > buffer (24) → must unwind. Allow plenty of USDT for swap.
    const before = await audm.balanceOf(alice.address);
    await pool.connect(alice).withdraw(1, 200n * WAD);

    // Alice gets her exact stake back in AUDM.
    expect((await audm.balanceOf(alice.address)) - before).to.equal(stake);

    // Pool should hold no AUDM after returning the stake.
    expect(await audm.balanceOf(await pool.getAddress())).to.equal(0n);

    // usdtPrincipal should have dropped — leftover USDT was re-supplied.
    const aavePrincipal = await aave.principalOf(await pool.getAddress());
    expect(await pool.usdtPrincipal()).to.equal(aavePrincipal);
  });

  it("rejects non-owner withdraw", async () => {
    const { admin, pool } = await depositAlice();
    await time.increase(Number(WAIT) + 1);
    await expect(pool.connect(admin).withdraw(1, 200n * WAD)).to.be.revertedWithCustomError(pool, "NotMember");
  });
});

describe("FairGoPool — coverage algorithm (stake-based, unchanged)", () => {
  it("multiplier and coverage are 0 during wait period", async () => {
    const { pool } = await depositAlice();
    expect(await pool.coverageMultiplier(1)).to.equal(0n);
    expect(await pool.coverageAvailable(1)).to.equal(0n);
  });

  it("multiplier matches k * ln(1 + months_past_wait) at 1, 3, 12 months", async () => {
    const { pool } = await depositAlice();
    await time.increase(Number(WAIT + MONTH));
    NEAR(await pool.coverageMultiplier(1), (K_WAD * 693147180559945309n) / WAD);
    await time.increase(Number(2n * MONTH));
    NEAR(await pool.coverageMultiplier(1), (K_WAD * 1386294361119890619n) / WAD);
    await time.increase(Number(9n * MONTH));
    NEAR(await pool.coverageMultiplier(1), (K_WAD * 2564949357461536736n) / WAD);
  });

  it("lifetimeCap = stake * multiplier", async () => {
    const { pool, stake } = await depositAlice(200n * WAD);
    await time.increase(Number(WAIT + MONTH));
    const mult = await pool.coverageMultiplier(1);
    expect(await pool.lifetimeCap(1)).to.equal((stake * mult) / WAD);
  });
});

describe("FairGoPool — claims flow with AAVE-backed payout", () => {
  it("pays a small claim from the AUDM buffer without touching AAVE", async () => {
    const { alice, oracle, treasury, audm, pool } = await depositAlice();
    await time.increase(Number(WAIT + 6n * MONTH));

    const before = await audm.balanceOf(alice.address);
    const principalBefore = await pool.usdtPrincipal();

    // 20 AUDM claim — well under the 24 AUDM buffer.
    await pool.connect(alice).submitClaim(1, 20n * WAD, ethers.ZeroHash);
    await pool.connect(oracle).approveClaim(0);
    await pool.connect(treasury).payClaim(0, alice.address, 0);

    expect((await audm.balanceOf(alice.address)) - before).to.equal(20n * WAD);
    expect(await pool.usdtPrincipal()).to.equal(principalBefore); // AAVE untouched
  });

  it("pays a large claim by unwinding AAVE and swapping USDT→AUDM", async () => {
    const { alice, oracle, treasury, audm, pool } = await depositAlice();
    await time.increase(Number(WAIT + 6n * MONTH));

    const before = await audm.balanceOf(alice.address);
    const principalBefore = await pool.usdtPrincipal();

    // 50 AUDM claim — buffer is only 24, must pull 26 AUDM via swap.
    await pool.connect(alice).submitClaim(1, 50n * WAD, ethers.ZeroHash);
    await pool.connect(oracle).approveClaim(0);
    await pool.connect(treasury).payClaim(0, alice.address, 100n * WAD);

    expect((await audm.balanceOf(alice.address)) - before).to.equal(50n * WAD);
    // Principal must have dropped by roughly 26 / 1.5384 ≈ 16.9 USDT.
    const principalAfter = await pool.usdtPrincipal();
    expect(principalAfter).to.be.lessThan(principalBefore);
    NEAR(principalBefore - principalAfter, (26n * WAD * RATE_AUDM_USDT) / WAD, WAD / 100n);
  });

  it("reverts payout when maxUsdtIn is too small to cover the swap", async () => {
    const { alice, oracle, treasury, pool, router } = await depositAlice();
    await time.increase(Number(WAIT + 6n * MONTH));

    await pool.connect(alice).submitClaim(1, 50n * WAD, ethers.ZeroHash);
    await pool.connect(oracle).approveClaim(0);
    // Need ~16.9 USDT for the swap, but cap at 1.
    await expect(
      pool.connect(treasury).payClaim(0, alice.address, 1n * WAD)
    ).to.be.revertedWithCustomError(router, "Slippage");
  });

  it("rejects claims during wait period (cap is 0)", async () => {
    const { alice, pool } = await depositAlice();
    await expect(
      pool.connect(alice).submitClaim(1, 50n * WAD, ethers.ZeroHash)
    ).to.be.revertedWithCustomError(pool, "ExceedsCoverage");
  });

  it("rejects claims exceeding current available coverage", async () => {
    const { alice, pool } = await depositAlice();
    await time.increase(Number(WAIT + MONTH));
    await expect(
      pool.connect(alice).submitClaim(1, 500n * WAD, ethers.ZeroHash)
    ).to.be.revertedWithCustomError(pool, "ExceedsCoverage");
  });

  it("oracle can reject a pending claim", async () => {
    const { alice, oracle, pool } = await depositAlice();
    await time.increase(Number(WAIT + MONTH));
    await pool.connect(alice).submitClaim(1, 50n * WAD, ethers.ZeroHash);
    await expect(pool.connect(oracle).rejectClaim(0)).to.emit(pool, "ClaimRejected").withArgs(0);
    await expect(pool.connect(oracle).approveClaim(0)).to.be.revertedWithCustomError(pool, "ClaimNotPending");
  });
});

describe("FairGoPool — AAVE yield harvest", () => {
  it("returns 0 and emits nothing when there is no yield", async () => {
    const { treasury, pool } = await depositAlice();
    expect(await pool.accruedYield()).to.equal(0n);
    await expect(pool.connect(treasury).harvest(treasury.address)).to.not.emit(pool, "YieldHarvested");
  });

  it("withdraws only the yield, leaves principal intact", async () => {
    const { treasury, usdt, aave, pool, expectedUsdt } = await depositAlice();

    // Simulate 5 USDT of accrued AAVE yield — fund the pool with the asset
    // and credit the supplier's balance.
    const yieldUsdt = 5n * WAD;
    await usdt.mint(await aave.getAddress(), yieldUsdt);
    await aave.accrueYield(await pool.getAddress(), yieldUsdt);

    expect(await pool.accruedYield()).to.equal(yieldUsdt);

    const before = await usdt.balanceOf(treasury.address);
    await expect(pool.connect(treasury).harvest(treasury.address))
      .to.emit(pool, "YieldHarvested")
      .withArgs(treasury.address, yieldUsdt);
    expect((await usdt.balanceOf(treasury.address)) - before).to.equal(yieldUsdt);

    // Principal accumulator unchanged; remaining aToken balance == principal.
    expect(await pool.usdtPrincipal()).to.equal(expectedUsdt);
    expect(await aave.principalOf(await pool.getAddress())).to.equal(expectedUsdt);
    expect(await pool.accruedYield()).to.equal(0n);
  });

  it("only TREASURY_ROLE can harvest", async () => {
    const { alice, pool } = await depositAlice();
    await expect(pool.connect(alice).harvest(alice.address)).to.be.revertedWithCustomError(
      pool,
      "AccessControlUnauthorizedAccount"
    );
  });

  it("rejects harvest to zero address", async () => {
    const { treasury, pool } = await depositAlice();
    await expect(pool.connect(treasury).harvest(ethers.ZeroAddress)).to.be.revertedWithCustomError(
      pool,
      "ZeroAddress"
    );
  });
});
