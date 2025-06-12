// SOLUTION 1: Updated 04_setup-bridge.js with corrected logic
// scripts/04_setup-bridge.js
const { ethers } = require("hardhat");
const fs = require('fs');

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Setting up bridge connection with account:", deployer.address);

    // Get network info
    const network = await ethers.provider.getNetwork();
    console.log("Current network:", network.name, "Chain ID:", network.chainId);

let filenameNetworkName;
if (network.chainId.toString() === "4442") {
    filenameNetworkName = "tan";
} else {
    filenameNetworkName = network.name || network.chainId.toString();
}
    
    // Load current network deployment
    const currentFileName = `deployments/endpoint-${filenameNetworkName}.json`;
    if (!fs.existsSync(currentFileName)) {
        throw new Error(`Current deployment file ${currentFileName} not found.`);
    }

    const currentDeployment = JSON.parse(fs.readFileSync(currentFileName, 'utf8'));
    console.log("Current deployment:", currentDeployment);

    // Determine remote network and get the actual deployed chain IDs
    let remoteNetwork, remoteFileName, remoteLzChainId;
    
    if (network.chainId === 11155111) { // Sepolia
        remoteNetwork = "tan"; // This is how Tan was saved
        remoteFileName = `deployments/endpoint-tan.json`; // Actual filename
        remoteLzChainId = 4442; // Use the actual deployed chain ID
    } else { // Tan (tan network)
        remoteNetwork = "sepolia";
        remoteFileName = `deployments/endpoint-sepolia.json`;
        remoteLzChainId = 10161; // Use the actual deployed chain ID
    }

    // Try to load remote deployment
    let remoteDeployment = null;
    
    if (fs.existsSync(remoteFileName)) {
        remoteDeployment = JSON.parse(fs.readFileSync(remoteFileName, 'utf8'));
        console.log("Remote deployment found:", remoteDeployment);
    } else {
        console.log(`⚠️  Remote deployment file ${remoteFileName} not found.`);
        console.log("You'll need to deploy on the remote network first, then run this script again.");
        
        // Create a placeholder with instructions
        const placeholder = {
            remoteNetwork: remoteNetwork,
            remoteLzChainId: remoteLzChainId,
            remoteFileName: remoteFileName,
            instructions: [
                "1. Deploy the complete stack on the remote network",
                "2. Make sure both deployment files exist",
                "3. Run this setup script again"
            ]
        };
        
        currentDeployment.bridgeSetup = placeholder;
        fs.writeFileSync(currentFileName, JSON.stringify(currentDeployment, null, 2));
        return;
    }

    // Get contract instances - use fully qualified name to avoid conflicts
    const sender = await ethers.getContractAt("contracts/Sender.sol:Sender", currentDeployment.sender);
    
    console.log(`Setting up bridge from ${network.name || network.chainId} to ${remoteNetwork}...`);
    
    // Set remote receiver address
    console.log("Setting remote receiver address...");
    console.log(`Remote LZ Chain ID: ${remoteLzChainId}`);
    console.log(`Remote Receiver: ${remoteDeployment.receiver}`);
    
    const tx = await sender.setRemote(remoteLzChainId, remoteDeployment.receiver);
    await tx.wait();
    console.log("✓ Remote receiver set");

    // Update deployment info
    currentDeployment.bridgeSetup = {
        remoteNetwork: remoteNetwork,
        remoteLzChainId: remoteLzChainId,
        remoteReceiver: remoteDeployment.receiver,
        setupComplete: true,
        setupTimestamp: new Date().toISOString()
    };

    fs.writeFileSync(currentFileName, JSON.stringify(currentDeployment, null, 2));
    
    console.log("🎉 Bridge setup complete!");
    console.log(`Local Sender (${network.name || network.chainId}):`, currentDeployment.sender);
    console.log(`Remote Receiver (${remoteNetwork}):`, remoteDeployment.receiver);
    console.log(`Remote Chain ID:`, remoteLzChainId);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });