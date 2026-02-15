const hre = require("hardhat");
require("dotenv").config();

async function main() {
  console.log("✅ Confirming transaction with Owner 1...\n");
  
  const contractAddress = "0xFbe6d25980243922d94a774255217be1c62a3D1D";
  
  const MultiSigWallet = await hre.ethers.getContractFactory("MultiSigWallet");
  const wallet = MultiSigWallet.attach(contractAddress);
  
  const [owner1] = await hre.ethers.getSigners();
  
  console.log("👤 Owner 1 Address:", owner1.address);
  
  const txIndex = 0;
  
  console.log("📋 Confirming transaction index:", txIndex);
  console.log("");
  
  const tx = await wallet.confirmTransaction(txIndex);
  
  console.log("📤 Confirmation transaction hash:", tx.hash);
  console.log("⏳ Waiting for confirmation...");
  
  await tx.wait();
  
  console.log("✅ Transaction confirmed by Owner 1!");
  console.log("");
  
  // Check transaction status
  const txDetails = await wallet.getTransaction(txIndex);
  
  console.log("📊 Updated Transaction Status:");
  console.log("   Confirmations:", txDetails[4].toString(), "/ 2 required");
  console.log("   Executed:", txDetails[3]);
  console.log("");
  
  if (txDetails[4] >= 2n) {
    console.log("🎉 Transaction has enough confirmations!");
    console.log("🚀 Ready to execute!");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
