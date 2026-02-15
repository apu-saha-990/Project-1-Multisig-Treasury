const hre = require("hardhat");
require("dotenv").config();

async function main() {
  const contractAddress = "0xdc8d6F7aF51120af2D6c5de861dfdC187eFE70a2";
  
  const owners = [
    process.env.OWNER_1,
    process.env.OWNER_2,
    process.env.OWNER_3
  ];
  
  const requiredConfirmations = parseInt(process.env.REQUIRED_CONFIRMATIONS);
  
  console.log("🔍 Verifying contract on Etherscan...");
  console.log("Contract:", contractAddress);
  console.log("Owners:", owners);
  console.log("Required Confirmations:", requiredConfirmations);
  console.log("");
  
  try {
    await hre.run("verify:verify", {
      address: contractAddress,
      constructorArguments: [owners, requiredConfirmations],
    });
    
    console.log("✅ Contract verified successfully!");
  } catch (error) {
    if (error.message.includes("Already Verified")) {
      console.log("✅ Contract already verified!");
    } else {
      console.error("❌ Verification failed:", error.message);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
