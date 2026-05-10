import { expect } from "chai";
import { ethers } from "hardhat";

async function deployFixture() {
  const [admin, minter, alice, bob] = await ethers.getSigners();
  const nft = await (await ethers.getContractFactory("CoverageNFT")).deploy(admin.address);
  const minterRole = await nft.MINTER_ROLE();
  await nft.connect(admin).grantRole(minterRole, minter.address);
  return { admin, minter, alice, bob, nft };
}

describe("CoverageNFT", () => {
  it("mints to a member and stores the vehicle hash", async () => {
    const { minter, alice, nft } = await deployFixture();
    const vehicleHash = ethers.keccak256(ethers.toUtf8Bytes("QLD-047LCS"));
    await expect(nft.connect(minter).mint(alice.address, vehicleHash))
      .to.emit(nft, "Locked")
      .withArgs(1);
    expect(await nft.ownerOf(1)).to.equal(alice.address);
    expect(await nft.vehicleHashOf(1)).to.equal(vehicleHash);
    expect(await nft.locked(1)).to.equal(true);
  });

  it("only MINTER_ROLE can mint", async () => {
    const { alice, nft } = await deployFixture();
    await expect(
      nft.connect(alice).mint(alice.address, ethers.ZeroHash)
    ).to.be.revertedWithCustomError(nft, "AccessControlUnauthorizedAccount");
  });

  it("blocks transfers (soulbound)", async () => {
    const { minter, alice, bob, nft } = await deployFixture();
    await nft.connect(minter).mint(alice.address, ethers.ZeroHash);
    await expect(
      nft.connect(alice).transferFrom(alice.address, bob.address, 1)
    ).to.be.revertedWithCustomError(nft, "Soulbound");
    await expect(
      nft.connect(alice)["safeTransferFrom(address,address,uint256)"](alice.address, bob.address, 1)
    ).to.be.revertedWithCustomError(nft, "Soulbound");
  });

  it("blocks approvals", async () => {
    const { minter, alice, bob, nft } = await deployFixture();
    await nft.connect(minter).mint(alice.address, ethers.ZeroHash);
    await expect(nft.connect(alice).approve(bob.address, 1)).to.be.revertedWithCustomError(
      nft,
      "ApprovalsDisabled"
    );
    await expect(
      nft.connect(alice).setApprovalForAll(bob.address, true)
    ).to.be.revertedWithCustomError(nft, "ApprovalsDisabled");
  });

  it("burns clear vehicle hash and free ownership", async () => {
    const { minter, alice, nft } = await deployFixture();
    const h = ethers.keccak256(ethers.toUtf8Bytes("VIC-001"));
    await nft.connect(minter).mint(alice.address, h);
    await nft.connect(minter).burn(1);
    expect(await nft.vehicleHashOf(1)).to.equal(ethers.ZeroHash);
    await expect(nft.ownerOf(1)).to.be.revertedWithCustomError(nft, "ERC721NonexistentToken");
  });

  it("locked() reverts for unminted tokens", async () => {
    const { nft } = await deployFixture();
    await expect(nft.locked(999)).to.be.revertedWithCustomError(nft, "ERC721NonexistentToken");
  });

  it("advertises EIP-5192 via supportsInterface", async () => {
    const { nft } = await deployFixture();
    expect(await nft.supportsInterface("0xb45a3c0e")).to.equal(true);
    // ERC721
    expect(await nft.supportsInterface("0x80ac58cd")).to.equal(true);
  });

  it("works as a drop-in for FairGoPool", async () => {
    const [admin, oracle, treasury, alice] = await ethers.getSigners();
    const audm = await (await ethers.getContractFactory("MockAUDM")).deploy();
    const usdt = await (await ethers.getContractFactory("MockUSDT")).deploy();
    const nft = await (await ethers.getContractFactory("CoverageNFT")).deploy(admin.address);

    const WAD = 10n ** 18n;
    const WAIT = 30n * 24n * 60n * 60n;
    const K_WAD = (3n * WAD) / 2n;
    const RATE = (65n * WAD) / 100n;

    const router = await (await ethers.getContractFactory("MockSwapRouter")).deploy();
    await router.setRate(await audm.getAddress(), await usdt.getAddress(), RATE);
    await router.setRate(await usdt.getAddress(), await audm.getAddress(), (WAD * WAD) / RATE);
    await audm.mint(await router.getAddress(), 1_000_000n * WAD);
    await usdt.mint(await router.getAddress(), 1_000_000n * WAD);

    const aave = await (await ethers.getContractFactory("MockAavePool")).deploy();

    const pool = await (
      await ethers.getContractFactory("FairGoPool")
    ).deploy(
      await audm.getAddress(),
      await usdt.getAddress(),
      await nft.getAddress(),
      await router.getAddress(),
      await aave.getAddress(),
      500n,
      admin.address,
      WAIT,
      K_WAD
    );

    await nft.connect(admin).grantRole(await nft.MINTER_ROLE(), await pool.getAddress());
    await pool.connect(admin).grantRole(await pool.ORACLE_ROLE(), oracle.address);
    await pool.connect(admin).grantRole(await pool.TREASURY_ROLE(), treasury.address);

    await audm.mint(alice.address, 1_000n * WAD);
    await audm.connect(alice).approve(await pool.getAddress(), 120n * WAD);
    await pool.connect(alice).deposit(120n * WAD, ethers.ZeroHash, 0);

    expect(await nft.ownerOf(1)).to.equal(alice.address);
    expect(await nft.locked(1)).to.equal(true);
  });
});
