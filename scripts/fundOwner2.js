const hre = require("hardhat");
require("dotenv").config();

async function main() {
  console.log("💸 Sending gas money to Owner 2...\n");
  
  const [owner1] = await hre.ethers.getSigners();
  const owner2Address = process.env.OWNER_2;
  
  // Send 0.005 ETH for gas
  const amount = hre.ethers.parseEther("0.005");
  
  console.log("From:", owner1.address);
  console.log("To:", owner2Address);
  console.log("Amount:", hre.ethers.formatEther(amount), "ETH (for gas)");
  console.log("");
  
  const tx = await owner1.sendTransaction({
    to: owner2Address,
    value: amount
  });
  
  console.log("⏳ Transaction:", tx.hash);
  await tx.wait();
  
  console.log("✅ Owner 2 funded!");
  
  const balance = await hre.ethers.provider.getBalance(owner2Address);
  console.log("💰 Owner 2 Balance:", hre.ethers.formatEther(balance), "ETH");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
