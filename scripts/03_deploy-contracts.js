// scripts/03_deploy-contracts.js
const { ethers } = require("hardhat");
const fs = require('fs');

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying Sender and Receiver contracts with account:", deployer.address);

    // Get network info
    const network = await ethers.provider.getNetwork();

    console.log("Current network:", network.name, "Chain ID:", network.chainId);
  let filenameNetworkName;
if (network.chainId.toString() === "4442") {
    filenameNetworkName = "tan";
} else {
    filenameNetworkName = network.name || network.chainId.toString();
}
    

    // Load endpoint deployment info
    const endpointFileName = `deployments/endpoint-${filenameNetworkName}.json`;
    if (!fs.existsSync(endpointFileName)) {
        throw new Error(`Endpoint deployment file ${endpointFileName} not found. Deploy endpoint first.`);
    }

    const deploymentInfo = JSON.parse(fs.readFileSync(endpointFileName, 'utf8'));
    
    if (!deploymentInfo.setupComplete) {
        throw new Error("Endpoint setup not complete. Run setup-endpoint.js first.");
    }

    console.log("Using Endpoint address:", deploymentInfo.endpoint);

    // Deploy Sender - Use fully qualified name to avoid conflict
    console.log("Deploying Sender...");
    const Sender = await ethers.getContractFactory("contracts/Sender.sol:Sender");
    const sender = await Sender.deploy(deploymentInfo.endpoint);
    await sender.deployed();
    console.log("✓ Sender deployed to:", sender.address);

    // Deploy Receiver - Use fully qualified name to avoid conflict
    console.log("Deploying Receiver...");
    const Receiver = await ethers.getContractFactory("contracts/Receiver.sol:Receiver");
    const receiver = await Receiver.deploy();
    await receiver.deployed();
    console.log("✓ Receiver deployed to:", receiver.address);

    // Update deployment info
    deploymentInfo.sender = sender.address;
    deploymentInfo.receiver = receiver.address;
    deploymentInfo.contractsTimestamp = new Date().toISOString();

    fs.writeFileSync(endpointFileName, JSON.stringify(deploymentInfo, null, 2));
    
    console.log("🎉 Sender and Receiver contracts deployed!");
    console.log("Sender:", sender.address);
    console.log("Receiver:", receiver.address);
    console.log(`Updated ${endpointFileName}`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });