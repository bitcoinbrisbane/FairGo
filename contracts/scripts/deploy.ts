import { ethers, network } from "hardhat";
import { mkdirSync, writeFileSync } from "fs";
import path from "path";

// --------------------------------------------------------------------------
// Ethereum mainnet externals — verified canonical addresses.
// --------------------------------------------------------------------------
//   AUDM (provided by team):           0x081599e4936d12c46bd48913b2329115cd26cbdd
//   USDT (Tether):                     0xdAC17F958D2ee523a2206206994597C13D831ec7   (6 decimals, non-standard ERC20 — SafeERC20 handles it)
//   AAVE V3 Pool:                      0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2
//   aUSDT (AAVE V3, mainnet):          0x23878914EFE38d27C4D67Ab83ed1b93A74D4086a
//   Uniswap V3 SwapRouter (V1, has `deadline`): 0xE592427A0AEce92De3Edee1F18E0157C05861564
//
// Pre-deploy checklist:
//   - Confirm a Uniswap V3 AUDM/USDT pool exists at SWAP_FEE_TIER (default 3000 = 0.3%).
//     If it doesn't, deposits will revert on the swap.
//   - Set DEPLOYER_PK and RPC_MAINNET in .env. Optional: ETHERSCAN_API_KEY for verify.
const ETH_MAINNET = {
  audm: "0x081599e4936d12c46bd48913b2329115cd26cbdd",
  usdt: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
  aUsdt: "0x23878914EFE38d27C4D67Ab83ed1b93A74D4086a",
  swapRouter: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
  aavePool: "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2",
};

// --------------------------------------------------------------------------
// Pool economics — must match what's tested.
// --------------------------------------------------------------------------
const WAIT_PERIOD_SECONDS = 30 * 24 * 60 * 60;
const K_WAD = ethers.parseEther("1.5");
const SWAP_FEE_TIER = Number(process.env.SWAP_FEE_TIER ?? 3000);

async function main() {
  const [deployer] = await ethers.getSigners();
  const networkName = network.name;
  const chainId = Number((await ethers.provider.getNetwork()).chainId);

  console.log(`\n→ Deployer: ${deployer.address}`);
  console.log(`→ Network:  ${networkName} (chainId ${chainId})`);
  console.log(`→ Balance:  ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} ETH\n`);

  let ext: typeof ETH_MAINNET;

  if (networkName === "mainnet") {
    console.log("Using real Ethereum mainnet externals.");
    ext = ETH_MAINNET;
  } else {
    console.log(`Deploying mocks for ${networkName}…`);
    const audm = await (await ethers.getContractFactory("MockAUDM")).deploy();
    await audm.waitForDeployment();
    const usdt = await (await ethers.getContractFactory("MockUSDT")).deploy();
    await usdt.waitForDeployment();
    const router = await (await ethers.getContractFactory("MockSwapRouter")).deploy();
    await router.waitForDeployment();
    const aave = await (await ethers.getContractFactory("MockAavePool")).deploy(await usdt.getAddress());
    await aave.waitForDeployment();

    // 1:1 rates so the demo round-trip is loss-free.
    const WAD = ethers.parseEther("1");
    await (await router.setRate(await audm.getAddress(), await usdt.getAddress(), WAD)).wait();
    await (await router.setRate(await usdt.getAddress(), await audm.getAddress(), WAD)).wait();
    // Pre-fund both sides of the mock router and the deployer.
    const seed = ethers.parseEther("1000000");
    await (await audm.mint(await router.getAddress(), seed)).wait();
    await (await usdt.mint(await router.getAddress(), seed)).wait();
    await (await audm.mint(deployer.address, ethers.parseEther("10000"))).wait();

    ext = {
      audm: await audm.getAddress(),
      usdt: await usdt.getAddress(),
      aUsdt: await aave.getAddress(), // mock acts as its own aToken
      swapRouter: await router.getAddress(),
      aavePool: await aave.getAddress(),
    };
    console.log(`  MockAUDM        ${ext.audm}`);
    console.log(`  MockUSDT        ${ext.usdt}`);
    console.log(`  MockSwapRouter  ${ext.swapRouter}`);
    console.log(`  MockAavePool    ${ext.aavePool}`);
  }

  console.log("\nDeploying CoverageNFT…");
  const nft = await (await ethers.getContractFactory("CoverageNFT")).deploy(deployer.address);
  await nft.waitForDeployment();
  const nftAddr = await nft.getAddress();
  console.log(`  CoverageNFT     ${nftAddr}`);

  console.log("\nDeploying FairGoPool…");
  const pool = await (await ethers.getContractFactory("FairGoPool")).deploy(
    ext.audm,
    ext.usdt,
    ext.aUsdt,
    nftAddr,
    ext.swapRouter,
    ext.aavePool,
    SWAP_FEE_TIER,
    deployer.address,
    WAIT_PERIOD_SECONDS,
    K_WAD
  );
  await pool.waitForDeployment();
  const poolAddr = await pool.getAddress();
  console.log(`  FairGoPool      ${poolAddr}`);

  console.log("\nGranting CoverageNFT.MINTER_ROLE to FairGoPool…");
  const minterRole = await nft.MINTER_ROLE();
  await (await nft.grantRole(minterRole, poolAddr)).wait();

  const out = {
    network: networkName,
    chainId,
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
    contracts: {
      coverageNFT: nftAddr,
      fairGoPool: poolAddr,
    },
    externals: ext,
    config: {
      swapFeeTier: SWAP_FEE_TIER,
      waitPeriodSeconds: WAIT_PERIOD_SECONDS,
      kWad: K_WAD.toString(),
    },
  };

  const dir = path.join(__dirname, "..", "deployments");
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${networkName}.json`);
  writeFileSync(file, JSON.stringify(out, null, 2));
  console.log(`\n✓ Deployment recorded: ${file}\n`);

  if (networkName === "mainnet" && process.env.ETHERSCAN_API_KEY) {
    console.log("Tip: run `yarn verify:mainnet` to verify on Etherscan.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
