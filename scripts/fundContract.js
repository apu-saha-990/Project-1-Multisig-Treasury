const hre = require("hardhat");
require("dotenv").config();

async function main() {
  console.log("💰 Funding MultiSig Wallet...\n");
  
  const contractAddress = "0xdc8d6F7aF51120af2D6c5de861dfdC187eFE70a2";
  const [owner1] = await hre.ethers.getSigners();
  
  const amount = hre.ethers.parseEther("0.05"); // Send 0.05 ETH
  
  console.log("📤 Sending", hre.ethers.formatEther(amount), "ETH to contract");
  console.log("From:", owner1.address);
  console.log("To:", contractAddress);
  console.log("");
  
  const tx = await owner1.sendTransaction({
    to: contractAddress,
    value: amount
  });
  
  console.log("⏳ Transaction submitted:", tx.hash);
  console.log("Waiting for confirmation...");
  
  await tx.wait();
  
  console.log("✅ Transaction confirmed!");
  console.log("");
  
  // Check new balance
  const balance = await hre.ethers.provider.getBalance(contractAddress);
  console.log("💰 New Contract Balance:", hre.ethers.formatEther(balance), "ETH");
  
  console.log("");
  console.log("🎉 Contract is now funded and ready for MultiSig transactions!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
