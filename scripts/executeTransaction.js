const hre = require("hardhat");
require("dotenv").config();

async function main() {
  console.log("🚀 Executing MultiSig Transaction...\n");
  
  const contractAddress = "0xFbe6d25980243922d94a774255217be1c62a3D1D";
  
  const MultiSigWallet = await hre.ethers.getContractFactory("MultiSigWallet");
  const wallet = MultiSigWallet.attach(contractAddress);
  
  const [owner1] = await hre.ethers.getSigners();
  const txIndex = 0;
  
  console.log("📋 Transaction Index:", txIndex);
  console.log("👤 Executor:", owner1.address);
  console.log("");
  
  // Check balances BEFORE
  const contractBalanceBefore = await hre.ethers.provider.getBalance(contractAddress);
  const owner4BalanceBefore = await hre.ethers.provider.getBalance(process.env.OWNER_4);
  
  console.log("💰 Balances BEFORE Execution:");
  console.log("   Contract:", hre.ethers.formatEther(contractBalanceBefore), "ETH");
  console.log("   Owner 4:", hre.ethers.formatEther(owner4BalanceBefore), "ETH");
  console.log("");
  
  console.log("⏳ Executing transaction...");
  
  const tx = await wallet.executeTransaction(txIndex);
  
  console.log("📤 Execution transaction hash:", tx.hash);
  console.log("Waiting for confirmation...");
  
  await tx.wait();
  
  console.log("✅ Transaction EXECUTED successfully!");
  console.log("");
  
  // Check balances AFTER
  const contractBalanceAfter = await hre.ethers.provider.getBalance(contractAddress);
  const owner4BalanceAfter = await hre.ethers.provider.getBalance(process.env.OWNER_4);
  
  console.log("💰 Balances AFTER Execution:");
  console.log("   Contract:", hre.ethers.formatEther(contractBalanceAfter), "ETH");
  console.log("   Owner 4:", hre.ethers.formatEther(owner4BalanceAfter), "ETH");
  console.log("");
  
  console.log("📊 Changes:");
  console.log("   Contract:", hre.ethers.formatEther(contractBalanceBefore - contractBalanceAfter), "ETH sent");
  console.log("   Owner 4:", hre.ethers.formatEther(owner4BalanceAfter - owner4BalanceBefore), "ETH received");
  console.log("");
  
  console.log("🎉 MULTISIG WORKFLOW COMPLETE!");
  console.log("✅ Your MultiSig wallet is FULLY FUNCTIONAL!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
