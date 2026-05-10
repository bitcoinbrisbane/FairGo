import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";

const WAD = 10n ** 18n;
const DAY = 24n * 60n * 60n;
const MONTH = 30n * DAY;
const WAIT = 30n * DAY;
const K_WAD = (3n * WAD) / 2n; // 1.5

// Tolerance for ln approximations (~0.05%).
const NEAR = (a: bigint, b: bigint, eps = WAD / 2000n) => {
  const diff = a > b ? a - b : b - a;
  if (diff > eps) {
    throw new Error(`expected ${a} ~ ${b} (diff ${diff} > eps ${eps})`);
  }
};

async function deployFixture() {
  const [admin, oracle, treasury, alice] = await ethers.getSigners();

  const audm = await (await ethers.getContractFactory("MockAUDM")).deploy();
  const nft = await (await ethers.getContractFactory("MockCoverageNFT")).deploy(admin.address);

  const pool = await (
    await ethers.getContractFactory("FairGoPool")
  ).deploy(await audm.getAddress(), await nft.getAddress(), admin.address, WAIT, K_WAD);

  const minterRole = await nft.MINTER_ROLE();
  await nft.connect(admin).grantRole(minterRole, await pool.getAddress());

  const oracleRole = await pool.ORACLE_ROLE();
  await pool.connect(admin).grantRole(oracleRole, oracle.address);

  const treasuryRole = await pool.TREASURY_ROLE();
  await pool.connect(admin).grantRole(treasuryRole, treasury.address);

  await audm.mint(alice.address, 10_000n * WAD);
  await audm.mint(await pool.getAddress(), 100_000n * WAD); // pre-fund pool

  return { admin, oracle, treasury, alice, audm, nft, pool };
}

async function depositAlice(stake = 120n * WAD) {
  const fx = await deployFixture();
  await fx.audm.connect(fx.alice).approve(await fx.pool.getAddress(), stake);
  await fx.pool.connect(fx.alice).deposit(stake, ethers.ZeroHash);
  return { ...fx, stake };
}

describe("FairGoPool — deposit / withdraw", () => {
  it("mints a coverage NFT on deposit and records the position", async () => {
    const { alice, audm, nft, pool } = await deployFixture();
    await audm.connect(alice).approve(await pool.getAddress(), 120n * WAD);
    const vehicleHash = ethers.keccak256(ethers.toUtf8Bytes("QLD-047LCS"));
    await expect(pool.connect(alice).deposit(120n * WAD, vehicleHash)).to.emit(pool, "Deposited");
    expect(await nft.ownerOf(1)).to.equal(alice.address);
    expect(await nft.vehicleHashOf(1)).to.equal(vehicleHash);
    const pos = await pool.positionOf(1);
    expect(pos.stake).to.equal(120n * WAD);
    expect(pos.totalPaid).to.equal(0n);
  });

  it("reverts deposit of zero", async () => {
    const { alice, pool } = await deployFixture();
    await expect(pool.connect(alice).deposit(0, ethers.ZeroHash)).to.be.revertedWithCustomError(
      pool,
      "ZeroAmount"
    );
  });

  it("locks withdrawal during the wait period", async () => {
    const { alice, pool } = await depositAlice();
    await expect(pool.connect(alice).withdraw(1)).to.be.revertedWithCustomError(pool, "PositionLocked");
    await time.increase(Number(WAIT) + 1);
    await expect(pool.connect(alice).withdraw(1)).to.emit(pool, "Withdrawn");
  });
});

describe("FairGoPool — coverage algorithm", () => {
  it("multiplier and coverage are 0 during wait period", async () => {
    const { pool } = await depositAlice();
    expect(await pool.coverageMultiplier(1)).to.equal(0n);
    expect(await pool.coverageAvailable(1)).to.equal(0n);
    await time.increase(Number(WAIT) - 10);
    expect(await pool.coverageMultiplier(1)).to.equal(0n);
  });

  it("multiplier matches k * ln(1 + months_past_wait) at 1, 3, 12 months", async () => {
    const { pool } = await depositAlice();

    // 1 month past wait: k * ln(2) ≈ 1.5 * 0.693 = 1.0397
    await time.increase(Number(WAIT + MONTH));
    NEAR(await pool.coverageMultiplier(1), (K_WAD * 693147180559945309n) / WAD);

    // 3 months past wait: k * ln(4) ≈ 1.5 * 1.386 = 2.0794
    await time.increase(Number(2n * MONTH));
    NEAR(await pool.coverageMultiplier(1), (K_WAD * 1386294361119890619n) / WAD);

    // 12 months past wait: k * ln(13) ≈ 1.5 * 2.5649 = 3.8474
    await time.increase(Number(9n * MONTH));
    NEAR(await pool.coverageMultiplier(1), (K_WAD * 2564949357461536736n) / WAD);
  });

  it("lifetimeCap = stake * multiplier; coverageAvailable subtracts totalPaid", async () => {
    const { pool, stake } = await depositAlice(200n * WAD);
    await time.increase(Number(WAIT + MONTH));
    const mult = await pool.coverageMultiplier(1);
    expect(await pool.lifetimeCap(1)).to.equal((stake * mult) / WAD);
    expect(await pool.coverageAvailable(1)).to.equal((stake * mult) / WAD);
  });

  it("rejects claims during wait period", async () => {
    const { alice, pool } = await depositAlice();
    await expect(
      pool.connect(alice).submitClaim(1, 50n * WAD, ethers.ZeroHash)
    ).to.be.revertedWithCustomError(pool, "ExceedsCoverage");
  });

  it("rejects a claim exceeding current available coverage", async () => {
    const { alice, pool } = await depositAlice();
    // 1 month past wait: cap ~ 120 * 1.04 = ~124.7 AUDM
    await time.increase(Number(WAIT + MONTH));
    await expect(
      pool.connect(alice).submitClaim(1, 500n * WAD, ethers.ZeroHash)
    ).to.be.revertedWithCustomError(pool, "ExceedsCoverage");
  });

  it("drains lifetimeCap as claims are paid; tenure later restores headroom", async () => {
    const { alice, oracle, treasury, audm, pool, stake } = await depositAlice(120n * WAD);

    // Jump to 6 months past wait — cap ~ 120 * 1.5 * ln(7) ≈ 350 AUDM.
    await time.increase(Number(WAIT + 6n * MONTH));
    const capAt6 = await pool.lifetimeCap(1);
    const before = await audm.balanceOf(treasury.address);

    await pool.connect(alice).submitClaim(1, 200n * WAD, ethers.ZeroHash);
    await pool.connect(oracle).approveClaim(0);
    await pool.connect(treasury).payClaim(0, treasury.address);

    expect((await audm.balanceOf(treasury.address)) - before).to.equal(200n * WAD);
    const pos = await pool.positionOf(1);
    expect(pos.totalPaid).to.equal(200n * WAD);
    // Cap may have nudged up a few wei between reads; compare to current cap.
    expect(await pool.coverageAvailable(1)).to.equal((await pool.lifetimeCap(1)) - 200n * WAD);
    expect(await pool.lifetimeCap(1)).to.be.greaterThanOrEqual(capAt6);

    // Can't drain more than what's left — pick a value way above any plausible cap growth.
    const remaining = await pool.coverageAvailable(1);
    await expect(
      pool.connect(alice).submitClaim(1, remaining * 10n, ethers.ZeroHash)
    ).to.be.revertedWithCustomError(pool, "ExceedsCoverage");

    // Wait another year — cap should rise further, restoring headroom.
    await time.increase(Number(12n * MONTH));
    expect(await pool.lifetimeCap(1)).to.be.greaterThan(capAt6);
    expect(await pool.coverageAvailable(1)).to.be.greaterThan(remaining);

    // Sanity ref to silence unused stake var.
    expect(stake).to.equal(120n * WAD);
  });

  it("oracle can reject a pending claim", async () => {
    const { alice, oracle, pool } = await depositAlice();
    await time.increase(Number(WAIT + MONTH));
    await pool.connect(alice).submitClaim(1, 50n * WAD, ethers.ZeroHash);
    await expect(pool.connect(oracle).rejectClaim(0)).to.emit(pool, "ClaimRejected").withArgs(0);
    await expect(pool.connect(oracle).approveClaim(0)).to.be.revertedWithCustomError(pool, "ClaimNotPending");
  });
});
