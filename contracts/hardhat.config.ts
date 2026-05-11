import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config();

const RPC_MAINNET = process.env.RPC_MAINNET ?? "";
const RPC_SEPOLIA = process.env.RPC_SEPOLIA ?? "https://ethereum-sepolia-rpc.publicnode.com";
const DEPLOYER_PK = process.env.DEPLOYER_PK;
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY ?? "";

const accounts = DEPLOYER_PK ? [DEPLOYER_PK] : [];

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.26",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      evmVersion: "cancun",
      viaIR: false,
    },
  },
  networks: {
    hardhat: {},
    mainnet: { url: RPC_MAINNET, accounts },
    sepolia: { url: RPC_SEPOLIA, accounts },
  },
  etherscan: {
    apiKey: {
      mainnet: ETHERSCAN_API_KEY,
      sepolia: ETHERSCAN_API_KEY,
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
};

export default config;
