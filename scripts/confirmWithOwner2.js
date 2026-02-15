const hre = require("hardhat");
require("dotenv").config();

async function main() {
  console.log("✅ Confirming transaction with Owner 2...\n");
  
  const contractAddress = "0xFbe6d25980243922d94a774255217be1c62a3D1D";
  const owner2PrivateKey = "1a819a889ca46bf356fd20d0c66c9e199e92674ca9f5ac2ec78c3b0044010c85";
  
  // Create wallet for Owner 2
  const provider = new hre.ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
  const owner2Wallet = new hre.ethers.Wallet(owner2PrivateKey, provider);
  
  console.log("👤 Owner 2 Address:", owner2Wallet.address);
  console.log("");
  
  // Connect to contract as Owner 2
  const MultiSigWallet = await hre.ethers.getContractFactory("MultiSigWallet");
  const wallet = MultiSigWallet.attach(contractAddress).connect(owner2Wallet);
  
  const txIndex = 0;
  
  console.log("📋 Confirming transaction index:", txIndex);
  console.log("");
  
  const tx = await wallet.confirmTransaction(txIndex);
  
  console.log("📤 Confirmation transaction hash:", tx.hash);
  console.log("⏳ Waiting for confirmation...");
  
  await tx.wait();
  
  console.log("✅ Transaction confirmed by Owner 2!");
  console.log("");
  
  // Check transaction status
  const txDetails = await wallet.getTransaction(txIndex);
  
  console.log("📊 Updated Transaction Status:");
  console.log("   Confirmations:", txDetails[4].toString(), "/ 2 required");
  console.log("   Executed:", txDetails[3]);
  console.log("");
  
  if (txDetails[4] >= 2n) {
    console.log("🎉 Transaction has enough confirmations!");
    console.log("✅ Ready to execute!");
  } else {
    console.log("⏳ Still needs more confirmations");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
