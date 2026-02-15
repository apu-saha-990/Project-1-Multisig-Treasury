const hre = require("hardhat");
require("dotenv").config();

async function main() {
  console.log("🎯 MultiSig Wallet Interaction Script\n");
  
  // Contract address
  const contractAddress = "0xFbe6d25980243922d94a774255217be1c62a3D1D";
  
  // Get contract instance
  const MultiSigWallet = await hre.ethers.getContractFactory("MultiSigWallet");
  const wallet = MultiSigWallet.attach(contractAddress);
  
  console.log("📋 Contract Address:", contractAddress);
  console.log("");
  
  // Get signer (only Owner 1 has private key in .env)
  const [owner1] = await hre.ethers.getSigners();
  
  console.log("👤 Connected Account (Owner 1):", owner1.address);
  console.log("");
  
  // Check Owner 1 balance
  const owner1Balance = await hre.ethers.provider.getBalance(owner1.address);
  console.log("💵 Owner 1 Balance:", hre.ethers.formatEther(owner1Balance), "ETH");
  console.log("");
  
  // Check contract balance
  const contractBalance = await hre.ethers.provider.getBalance(contractAddress);
  console.log("💰 Contract Balance:", hre.ethers.formatEther(contractBalance), "ETH");
  console.log("");
  
  // Get owners from contract
  const owners = await wallet.getOwners();
  console.log("✅ Registered Owners in Contract:");
  owners.forEach((owner, i) => console.log(`   ${i + 1}. ${owner}`));
  console.log("");
  
  // Get required confirmations
  const required = await wallet.numConfirmationsRequired();
  console.log("🔐 Required Confirmations:", required.toString());
  console.log("");
  
  // Get transaction count
  const txCount = await wallet.getTransactionCount();
  console.log("📊 Total Transactions:", txCount.toString());
  console.log("");
  
  console.log("✅ Contract is connected and working!");
  console.log("");
  console.log("🎯 Next Steps:");
  console.log("   1. Send some ETH to contract: npx hardhat run scripts/fundContract.js --network sepolia");
  console.log("   2. Submit a transaction using this script");
  console.log("   3. Confirm with other owners via MetaMask on Etherscan");
  console.log("   4. Execute the transaction");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
