const hre = require("hardhat");
require("dotenv").config();

async function main() {
  console.log("📝 Submitting MultiSig Transaction...\n");
  
  const contractAddress = "0xdc8d6F7aF51120af2D6c5de861dfdC187eFE70a2";
  
  const MultiSigWallet = await hre.ethers.getContractFactory("MultiSigWallet");
  const wallet = MultiSigWallet.attach(contractAddress);
  
  const [owner1] = await hre.ethers.getSigners();
  
  // Transaction details: Send 0.01 ETH to Owner 4
  const recipient = process.env.OWNER_4;
  const amount = hre.ethers.parseEther("0.01");
  const data = "0x"; // No data, just ETH transfer
  
  console.log("📋 Transaction Details:");
  console.log("   From Contract:", contractAddress);
  console.log("   To:", recipient);
  console.log("   Amount:", hre.ethers.formatEther(amount), "ETH");
  console.log("   Submitted by:", owner1.address);
  console.log("");
  
  console.log("⏳ Submitting transaction...");
  
  const tx = await wallet.submitTransaction(recipient, amount, data);
  
  console.log("📤 Transaction hash:", tx.hash);
  console.log("Waiting for confirmation...");
  
  const receipt = await tx.wait();
  
  console.log("✅ Transaction submitted to MultiSig!");
  console.log("");
  
  // Get transaction index from event
  const txIndex = await wallet.getTransactionCount() - 1n;
  
  console.log("📊 Transaction Index:", txIndex.toString());
  console.log("");
  
  // Get transaction details
  const txDetails = await wallet.getTransaction(txIndex);
  
  console.log("📋 MultiSig Transaction Status:");
  console.log("   To:", txDetails[0]);
  console.log("   Value:", hre.ethers.formatEther(txDetails[1]), "ETH");
  console.log("   Executed:", txDetails[3]);
  console.log("   Confirmations:", txDetails[4].toString(), "/ 2 required");
  console.log("");
  
  console.log("🎯 Next Steps:");
  console.log("   1. Owner 2 or Owner 3 needs to confirm this transaction");
  console.log("   2. Go to Etherscan and use 'Write Contract' tab");
  console.log("   3. Connect with Owner 2 or Owner 3's MetaMask");
  console.log("   4. Call confirmTransaction(" + txIndex.toString() + ")");
  console.log("   5. After 2 confirmations, anyone can call executeTransaction(" + txIndex.toString() + ")");
  console.log("");
  console.log("🔗 Contract on Etherscan:");
  console.log("   https://sepolia.etherscan.io/address/" + contractAddress + "#writeContract");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
