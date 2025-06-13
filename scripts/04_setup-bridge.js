
const { ethers } = require("hardhat");
const fs = require('fs');

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Setting up bridge connection with account:", deployer.address);
   
    const network = await ethers.provider.getNetwork();
    console.log("Current network:", network.name, "Chain ID:", network.chainId);
    
    let filenameNetworkName;
    if (network.chainId.toString() === "4442") {
        filenameNetworkName = "tan";
    } else {
        filenameNetworkName = network.name || network.chainId.toString();
    }

    
    async function getGasPrice() {
        try {
            const feeData = await ethers.provider.getFeeData();
            console.log("Current fee data:", {
                gasPrice: feeData.gasPrice?.toString(),
                maxFeePerGas: feeData.maxFeePerGas?.toString(),
                maxPriorityFeePerGas: feeData.maxPriorityFeePerGas?.toString()
            });
            
           
            if (feeData.maxFeePerGas) {
                return {
                    maxFeePerGas: feeData.maxFeePerGas.mul(120).div(100), // 20% buffer
                    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas?.mul(110).div(100) || ethers.utils.parseUnits("2", "gwei")
                };
            } else if (feeData.gasPrice) {
                
                return {
                    gasPrice: feeData.gasPrice.mul(120).div(100) // 20% buffer
                };
            } else {
             
                return {
                    gasPrice: ethers.utils.parseUnits("50", "gwei")
                };
            }
        } catch (error) {
            console.log("Error getting fee data, using fallback gas price:", error.message);
            return {
                gasPrice: ethers.utils.parseUnits("50", "gwei")
            };
        }
    }

    const gasOptions = await getGasPrice();
    console.log("Using gas options:", gasOptions);
    
   
    const currentFileName = `deployments/endpoint-${filenameNetworkName}.json`;
    if (!fs.existsSync(currentFileName)) {
        throw new Error(`Current deployment file ${currentFileName} not found.`);
    }
    
    const currentDeployment = JSON.parse(fs.readFileSync(currentFileName, 'utf8'));
    console.log("Current deployment:", currentDeployment);
    
   
    let senderAddress;
    if (currentDeployment.sender) {
        senderAddress = currentDeployment.sender;
    } else if (currentDeployment.contracts && currentDeployment.contracts.sender) {
        senderAddress = currentDeployment.contracts.sender;
    } else {
        throw new Error("Sender contract address not found in deployment file");
    }
    
    console.log("Using sender address:", senderAddress);
    

    let remoteNetwork, remoteFileName, remoteLzChainId;
    if (network.chainId === 11155111) {
        remoteNetwork = "tan";
        remoteFileName = `deployments/endpoint-tan.json`;
        remoteLzChainId = 4442;
    } else {
        remoteNetwork = "sepolia";
        remoteFileName = `deployments/endpoint-sepolia.json`;
        remoteLzChainId = 10161;
    }
    
    // Load remote deployment info
    if (!fs.existsSync(remoteFileName)) {
        console.log(`⚠️  Remote deployment file ${remoteFileName} not found.`);
        console.log("Please deploy the complete stack on the remote network first, then rerun this script.");
        const placeholder = {
            remoteNetwork,
            remoteLzChainId,
            remoteFileName,
            instructions: [
                "1. Deploy the complete stack on the remote network",
                "2. Ensure both deployment files exist",
                "3. Run this setup script again"
            ]
        };
        currentDeployment.bridgeSetup = placeholder;
        fs.writeFileSync(currentFileName, JSON.stringify(currentDeployment, null, 2));
        return;
    }
    
    const remoteDeployment = JSON.parse(fs.readFileSync(remoteFileName, 'utf8'));
    console.log("Remote deployment found:", remoteDeployment);
    
    // Get remote receiver address - handle both old and new deployment formats
    let remoteReceiverAddress;
    if (remoteDeployment.receiver) {
        remoteReceiverAddress = remoteDeployment.receiver;
    } else if (remoteDeployment.contracts && remoteDeployment.contracts.receiver) {
        remoteReceiverAddress = remoteDeployment.contracts.receiver;
    } else {
        throw new Error("Remote receiver contract address not found in deployment file");
    }
    
    console.log("Using remote receiver address:", remoteReceiverAddress);
    
    // Get contract instance
    const sender = await ethers.getContractAt("contracts/Sender.sol:Sender", senderAddress);
    
    console.log(`Setting up bridge from ${filenameNetworkName} to ${remoteNetwork}...`);
    console.log(`Remote LZ Chain ID: ${remoteLzChainId}`);
    console.log(`Remote Receiver: ${remoteReceiverAddress}`);

    // Add retry logic for transactions
    async function executeWithRetry(txFunction, description, maxRetries = 3) {
        for (let i = 0; i < maxRetries; i++) {
            try {
                console.log(`${description} (attempt ${i + 1}/${maxRetries})`);
                const tx = await txFunction();
                await tx.wait();
                console.log(`✅ ${description} completed`);
                return tx;
            } catch (error) {
                console.log(`❌ ${description} failed:`, error.message);
                if (i === maxRetries - 1) throw error;
                
                // Wait before retrying and get fresh gas price
                await new Promise(resolve => setTimeout(resolve, 2000));
                const newGasOptions = await getGasPrice();
                Object.assign(gasOptions, newGasOptions);
                console.log("Retrying with updated gas options:", newGasOptions);
            }
        }
    }

    // Set remote receiver with retry logic
    await executeWithRetry(
        () => sender.setRemote(remoteLzChainId, remoteReceiverAddress, gasOptions),
        "Setting remote receiver"
    );
    
    // Update deployment info
    currentDeployment.bridgeSetup = {
        remoteNetwork,
        remoteLzChainId,
        remoteReceiver: remoteReceiverAddress,
        setupComplete: true,
        setupTimestamp: new Date().toISOString(),
        gasOptionsUsed: gasOptions
    };
    
    fs.writeFileSync(currentFileName, JSON.stringify(currentDeployment, null, 2));
    
    console.log("🎉 Bridge setup complete!");
    console.log(`Local Sender (${filenameNetworkName}):`, senderAddress);
    console.log(`Remote Receiver (${remoteNetwork}):`, remoteReceiverAddress);
    console.log(`Remote Chain ID:`, remoteLzChainId);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });