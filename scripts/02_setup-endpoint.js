// scripts/setup-endpoint.js
const { ethers } = require("hardhat");
const fs = require('fs');

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Setting up Endpoint with account:", deployer.address);

    

    // Get network info
    const network = await ethers.provider.getNetwork();
    console.log("Current network:", network.name, "Chain ID:", network.chainId);


     let filenameNetworkName;
if (network.chainId.toString() === "4442") {
    filenameNetworkName = "tan";
} else {
    filenameNetworkName = network.name || network.chainId.toString();
}
    // Load deployment info
    const deploymentFileName = `deployments/endpoint-${filenameNetworkName}.json`;
    if (!fs.existsSync(deploymentFileName)) {
        throw new Error(`Deployment file ${deploymentFileName} not found. Deploy endpoint first.`);
    }

    const deploymentInfo = JSON.parse(fs.readFileSync(deploymentFileName, 'utf8'));
    console.log("Loaded deployment info:", deploymentInfo);

    // Get contract instances
    const endpoint = await ethers.getContractAt("Endpoint", deploymentInfo.endpoint);
    const library = await ethers.getContractAt("MockMessagingLibrary", deploymentInfo.library);

    console.log("Setting up messaging library...");

    // Step 1: Add new library version
    console.log("Adding new library version...");
    const tx1 = await endpoint.newVersion(library.address);
    await tx1.wait();
    console.log("✓ Library version added");

    // Get the latest version
    const latestVersion = await endpoint.latestVersion();
    console.log("Latest version:", latestVersion.toString());

    // Step 2: Set default send version
    console.log("Setting default send version...");
    const tx2 = await endpoint.setDefaultSendVersion(latestVersion);
    await tx2.wait();
    console.log("✓ Default send version set");

    // Step 3: Set default receive version
    console.log("Setting default receive version...");
    const tx3 = await endpoint.setDefaultReceiveVersion(latestVersion);
    await tx3.wait();
    console.log("✓ Default receive version set");

    // Update deployment info
    deploymentInfo.setupComplete = true;
    deploymentInfo.libraryVersion = latestVersion.toString();
    deploymentInfo.setupTimestamp = new Date().toISOString();

    fs.writeFileSync(deploymentFileName, JSON.stringify(deploymentInfo, null, 2));
    
    console.log("🎉 Endpoint setup complete!");
    console.log("Endpoint address:", endpoint.address);
    console.log("Library address:", library.address);
    console.log("Library version:", latestVersion.toString());
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });