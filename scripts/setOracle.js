const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`🛠️ Using signer: ${deployer.address}`);

  const network = hre.network.name;
  const deploymentPath = `deployments/endpoint-${network}.json`;

  if (!fs.existsSync(deploymentPath)) {
    throw new Error(`❌ Deployment file not found: ${deploymentPath}`);
  }

  const deploymentData = JSON.parse(fs.readFileSync(deploymentPath));
  const ulnAddress = deploymentData.contracts.uln;
  const oracleAddress = deploymentData.contracts.oracle;

  if (!oracleAddress) throw new Error("❌ Oracle address missing in deployment JSON");

  // Set your remote chain ID manually depending on which direction you're configuring
  const remoteChainId = network === "tan" ? 10161 : 4442;


  const ULN = await ethers.getContractAt("UltraLightNode", ulnAddress);

  console.log(`📍 Setting oracle ${oracleAddress} for remoteChainId ${remoteChainId}`);
  const tx = await ULN.setOracle(remoteChainId, oracleAddress, {
  gasPrice: ethers.utils.parseUnits("10", "gwei") // or higher if needed
});
  console.log(`⛓️ TX sent: ${tx.hash}`);
  await tx.wait();

  console.log(`✅ Oracle set successfully for chain ${remoteChainId}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
