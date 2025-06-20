const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("🚀 Deploying FPValidator with account:", deployer.address);

  // Dummy Stargate bridge & token addresses (replace if needed)
  const STG_BRIDGE = "0x0000000000000000000000000000000000000001";
  const STG_TOKEN = "0x0000000000000000000000000000000000000002";

  const FPValidator = await ethers.getContractFactory("FPValidator");
  const validator = await FPValidator.deploy(STG_BRIDGE, STG_TOKEN);

  await validator.deployed();
  console.log("✅ FPValidator deployed to:", validator.address);
}

main().catch((error) => {
  console.error("❌ Deployment failed:", error);
  process.exit(1);
});
