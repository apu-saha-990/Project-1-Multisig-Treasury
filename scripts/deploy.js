const hre = require("hardhat");
require("dotenv").config();

async function main() {
  console.log("🚀 Starting MultiSig Wallet deployment...\n");
  
  // Get the contract factory
  const MultiSigWallet = await hre.ethers.getContractFactory("MultiSigWallet");
  
  // Get owner addresses from .env
  const owners = [
    process.env.OWNER_1,
    process.env.OWNER_2,
    process.env.OWNER_3
  ];
  
  const requiredConfirmations = parseInt(process.env.REQUIRED_CONFIRMATIONS);
  
  console.log("📋 Deployment Configuration:");
  console.log("   Owners:", owners);
  console.log("   Required Confirmations:", requiredConfirmations);
  console.log("");
  
  // Deploy the contract
  console.log("⏳ Deploying contract...");
  const multiSigWallet = await MultiSigWallet.deploy(owners, requiredConfirmations);
  
  await multiSigWallet.waitForDeployment();
  
  const address = await multiSigWallet.getAddress();
  
  console.log("✅ MultiSigWallet deployed to:", address);
  console.log("");
  console.log("📝 Save this address for verification and interaction!");
  console.log("");
  console.log("🔍 To verify on Etherscan, run:");
  console.log(`   npx hardhat verify --network sepolia ${address} "${owners.join('","')}" ${requiredConfirmations}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
