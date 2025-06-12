// scripts/01_deploy.js
const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", (await deployer.getBalance()).toString());

  // LayerZero-style chain IDs
  const CHAIN_IDS = {
    sepolia: 10161,
    tan: 4442
  };

  // Detect network
  const network = await ethers.provider.getNetwork();
  console.log("Current network:", network.name, "Chain ID:", network.chainId);

  // Pick lzChainId based on chain
  let lzChainId;
  let filenameNetworkName;

  if (network.chainId.toString() === "11155111") {
    lzChainId = CHAIN_IDS.sepolia;
    filenameNetworkName = "sepolia";
  } else if (network.chainId.toString() === "4442") {
    lzChainId = CHAIN_IDS.tan;
    filenameNetworkName = "tan";
  } else {
    throw new Error("Unsupported network chainId: " + network.chainId);
  }

  // 1. Deploy MockMessagingLibrary
  console.log("Deploying MockMessagingLibrary...");
  const MockMessagingLibrary = await ethers.getContractFactory("MockMessagingLibrary");
  const library = await MockMessagingLibrary.deploy();
  await library.deployed();
  console.log("✅ MockMessagingLibrary deployed to:", library.address);

  // 2. Deploy Endpoint
  console.log("Deploying Endpoint...");
  const Endpoint = await ethers.getContractFactory("Endpoint");
  const endpoint = await Endpoint.deploy(lzChainId);
  await endpoint.deployed();
  console.log("✅ Endpoint deployed to:", endpoint.address);

  // 3. Deploy UltraLightNode
  console.log("Deploying UltraLightNode...");
  const ULN = await ethers.getContractFactory("UltraLightNode");
  const uln = await ULN.deploy();
  await uln.deployed();
  console.log("✅ UltraLightNode deployed to:", uln.address);

  // 4. Deploy Relayer
  console.log("Deploying Relayer...");
  const Relayer = await ethers.getContractFactory("Relayer");
  const relayer = await Relayer.deploy();
  await relayer.deployed();
  console.log("✅ Relayer deployed to:", relayer.address);

  // 5. Initialize Relayer with ULN
  const tx1 = await relayer.initialize(uln.address);
  await tx1.wait();
  console.log("✅ Relayer initialized with ULN");

  // 6. Connect ULN to Relayer and Endpoint
  await uln.setRelayer(relayer.address);
  await uln.setEndpoint(endpoint.address);
  console.log("✅ ULN linked to Relayer and Endpoint");

  // 7. Connect Endpoint to ULN
  await endpoint.setULN(uln.address);
  console.log("✅ Endpoint linked to ULN");

  // 8. Save deployment info
  const deploymentInfo = {
    network: network.name,
    chainId: network.chainId,
    lzChainId: lzChainId,
    deployer: deployer.address,
    library: library.address,
    endpoint: endpoint.address,
    uln: uln.address,
    relayer: relayer.address,
    timestamp: new Date().toISOString()
  };

  const fileName = `deployments/endpoint-${filenameNetworkName}.json`;
  fs.mkdirSync("deployments", { recursive: true });
  fs.writeFileSync(fileName, JSON.stringify(deploymentInfo, null, 2));
  console.log(`✅ Deployment info saved to ${fileName}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
