import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";

const ONE = 10n ** 18n;
const LOCK_PERIOD = 30n * 24n * 60n * 60n; // 30 days

async function deployFixture() {
  const [admin, oracle, treasury, alice] = await ethers.getSigners();

  const audm = await (await ethers.getContractFactory("MockAUDM")).deploy();
  const nft = await (await ethers.getContractFactory("MockCoverageNFT")).deploy(admin.address);

  const pool = await (
    await ethers.getContractFactory("FairGoPool")
  ).deploy(await audm.getAddress(), await nft.getAddress(), admin.address, LOCK_PERIOD);

  const minterRole = await nft.MINTER_ROLE();
  await nft.connect(admin).grantRole(minterRole, await pool.getAddress());

  const oracleRole = await pool.ORACLE_ROLE();
  await pool.connect(admin).grantRole(oracleRole, oracle.address);

  const treasuryRole = await pool.TREASURY_ROLE();
  await pool.connect(admin).grantRole(treasuryRole, treasury.address);

  await audm.mint(alice.address, 10_000n * ONE);
  await audm.mint(await pool.getAddress(), 100_000n * ONE); // pre-fund pool for payouts

  return { admin, oracle, treasury, alice, audm, nft, pool };
}

describe("FairGoPool", () => {
  it("mints a coverage NFT on deposit and records the position", async () => {
    const { alice, audm, nft, pool } = await deployFixture();

    await audm.connect(alice).approve(await pool.getAddress(), 120n * ONE);
    const vehicleHash = ethers.keccak256(ethers.toUtf8Bytes("QLD-047LCS"));

    await expect(pool.connect(alice).deposit(120n * ONE, vehicleHash)).to.emit(pool, "Deposited");

    expect(await nft.ownerOf(1)).to.equal(alice.address);
    expect(await nft.vehicleHashOf(1)).to.equal(vehicleHash);

    const pos = await pool.positionOf(1);
    expect(pos.stake).to.equal(120n * ONE);
  });

  it("reverts deposit of zero", async () => {
    const { alice, pool } = await deployFixture();
    await expect(pool.connect(alice).deposit(0, ethers.ZeroHash)).to.be.revertedWithCustomError(
      pool,
      "ZeroAmount"
    );
  });

  it("locks withdrawal until the lock period expires", async () => {
    const { alice, audm, pool } = await deployFixture();
    await audm.connect(alice).approve(await pool.getAddress(), 120n * ONE);
    await pool.connect(alice).deposit(120n * ONE, ethers.ZeroHash);

    await expect(pool.connect(alice).withdraw(1)).to.be.revertedWithCustomError(pool, "PositionLocked");

    await time.increase(Number(LOCK_PERIOD) + 1);
    await expect(pool.connect(alice).withdraw(1)).to.emit(pool, "Withdrawn");
  });

  it("submits, approves, and pays a claim end-to-end", async () => {
    const { alice, oracle, treasury, audm, pool } = await deployFixture();
    await audm.connect(alice).approve(await pool.getAddress(), 120n * ONE);
    await pool.connect(alice).deposit(120n * ONE, ethers.ZeroHash);

    await pool.connect(alice).submitClaim(1, 156n * ONE, ethers.keccak256(ethers.toUtf8Bytes("FG-2840")));
    await pool.connect(oracle).approveClaim(0);

    const before = await audm.balanceOf(treasury.address);
    await pool.connect(treasury).payClaim(0, treasury.address);
    const after = await audm.balanceOf(treasury.address);
    expect(after - before).to.equal(156n * ONE);
  });

  it("oracle can reject a pending claim", async () => {
    const { alice, oracle, audm, pool } = await deployFixture();
    await audm.connect(alice).approve(await pool.getAddress(), 120n * ONE);
    await pool.connect(alice).deposit(120n * ONE, ethers.ZeroHash);

    await pool.connect(alice).submitClaim(1, 156n * ONE, ethers.ZeroHash);
    await expect(pool.connect(oracle).rejectClaim(0)).to.emit(pool, "ClaimRejected").withArgs(0);

    await expect(pool.connect(oracle).approveClaim(0)).to.be.revertedWithCustomError(pool, "ClaimNotPending");
  });
});
