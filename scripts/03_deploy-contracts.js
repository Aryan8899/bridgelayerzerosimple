const { ethers } = require("hardhat");
const fs = require('fs');
const path = require("path");

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying Sender and Receiver contracts with account:", deployer.address);

    const network = await ethers.provider.getNetwork();
    console.log("Current network:", network.name, "Chain ID:", network.chainId);

    let filenameNetworkName;
    if (network.chainId.toString() === "4442") {
        filenameNetworkName = "tan";
    } else if (network.chainId.toString() === "11155111") {
        filenameNetworkName = "sepolia";
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
                    maxFeePerGas: feeData.maxFeePerGas.mul(120).div(100),
                    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas?.mul(110).div(100) || ethers.utils.parseUnits("2", "gwei")
                };
            } else if (feeData.gasPrice) {
                return {
                    gasPrice: feeData.gasPrice.mul(120).div(100)
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

    const endpointFileName = `deployments/endpoint-${filenameNetworkName}.json`;
    if (!fs.existsSync(endpointFileName)) {
        throw new Error(`Endpoint deployment file ${endpointFileName} not found. Deploy endpoint first.`);
    }

    const deploymentInfo = JSON.parse(fs.readFileSync(endpointFileName, 'utf8'));

    console.log("🔍 Deployment info structure:");
    console.log("- setupComplete:", deploymentInfo.setupComplete);
    console.log("- contracts:", deploymentInfo.contracts);
    console.log("- endpoint address:", deploymentInfo.contracts?.endpoint);
    console.log("- WTAN address:", deploymentInfo.contracts?.wtan);

    if (!deploymentInfo.setupComplete) {
        throw new Error("Endpoint setup not complete. Run setup-endpoint.js first.");
    }

    const endpointAddress = deploymentInfo.contracts?.endpoint;
    const wtanAddress = deploymentInfo.contracts?.wtan;

    if (!endpointAddress || !wtanAddress) {
        throw new Error("Missing endpoint or WTAN address in deployment file.");
    }

    console.log("✅ Using Endpoint:", endpointAddress);
    console.log("✅ Using WTAN:", wtanAddress);

    // Get WTAN contract instance
    const wtan = await ethers.getContractAt("WTAN", wtanAddress);

    async function deployWithGasEstimation(contractName, args = [], description, maxRetries = 3) {
        for (let i = 0; i < maxRetries; i++) {
            try {
                console.log(`${description} (attempt ${i + 1}/${maxRetries})`);
                const ContractFactory = await ethers.getContractFactory(contractName);
                const deploymentData = ContractFactory.getDeployTransaction(...args);
                const estimatedGas = await ethers.provider.estimateGas(deploymentData);
                const gasLimit = estimatedGas.mul(110).div(100); // 10% buffer
                const contract = await ContractFactory.deploy(...args, {
                    ...gasOptions,
                    gasLimit: gasLimit
                });
                await contract.deployed();
                const receipt = await contract.deployTransaction.wait();
                console.log(`✅ ${description} completed`);
                console.log(`Gas used: ${receipt.gasUsed.toString()}`);
                return contract;
            } catch (error) {
                console.log(`❌ ${description} failed:`, error.message);
                if (i === maxRetries - 1) throw error;
                console.log("⏱️ Waiting 2 seconds before retry...");
                await new Promise(resolve => setTimeout(resolve, 2000));
                const newGasOptions = await getGasPrice();
                Object.assign(gasOptions, newGasOptions);
                console.log("🔄 Retrying with updated gas options:", newGasOptions);
            }
        }
    }

    async function executeWithRetry(fn, description, maxRetries = 3) {
        for (let i = 0; i < maxRetries; i++) {
            try {
                console.log(`${description} (attempt ${i + 1}/${maxRetries})`);
                const tx = await fn();
                const receipt = await tx.wait();
                console.log(`✅ ${description} completed. Gas used: ${receipt.gasUsed.toString()}`);
                return receipt;
            } catch (error) {
                console.log(`❌ ${description} failed:`, error.message);
                if (i === maxRetries - 1) throw error;
                
                console.log("⏱️ Waiting 2 seconds before retry...");
                await new Promise(resolve => setTimeout(resolve, 2000));
                const newGasOptions = await getGasPrice();
                Object.assign(gasOptions, newGasOptions);
                console.log("🔄 Retrying with updated gas options:", newGasOptions);
            }
        }
    }

    console.log("📤 Deploying Sender...");
    const sender = await deployWithGasEstimation(
        "contracts/Sender.sol:Sender",
        [endpointAddress, wtanAddress],
        "Sender deployment"
    );
    console.log("✓ Sender deployed to:", sender.address);

   // Inside the deployment script after deploying the Receiver contract

console.log("📥 Deploying Receiver...");
const receiver = await deployWithGasEstimation(
    "contracts/Receiver.sol:Receiver",
    [wtanAddress, endpointAddress],
    "Receiver deployment"
);
console.log("✓ Receiver deployed to:", receiver.address);

// After deploying the receiver, call the initialize function to set it as the minter
// Inside your deploy script, call initialize using the deployer's signer explicitly
// Inside your deploy script after deploying the Receiver contract
const wtanContract = await ethers.getContractAt("WTAN", wtanAddress);
const owner = await wtanContract.owner();
console.log("Owner of the WTAN contract is:", owner);

const receiverContract = await ethers.getContractAt("Receiver", receiver.address);
const signer = await ethers.getSigner();  // Get the deployer's signer

console.log("🔧 Setting the Receiver contract as the minter for WTAN...");
const tx = await wtanContract.connect(signer).setMinter(receiver.address, {
    gasLimit: 5000000,  // Manually set a higher gas limit
    gasPrice: ethers.utils.parseUnits("50", "gwei")  // Adjust gas price if needed
});
await tx.wait();
console.log("✅ Receiver successfully set as the minter for WTAN.");





    // The Receiver constructor automatically sets itself as the minter
    // But let's verify and log it
    try {
        const currentMinter = await wtan.minter();
        console.log("✅ WTAN minter is now set to:", currentMinter);
        console.log("✅ Receiver address:", receiver.address);
        
        if (currentMinter.toLowerCase() === receiver.address.toLowerCase()) {
            console.log("✅ Minter setup successful - Receiver is now the only contract that can mint WTAN");
        } else {
            console.log("⚠️ Warning: Minter setup may not be correct");
        }
    } catch (error) {
        console.log("⚠️ Could not verify minter setup:", error.message);
    }

    if (!deploymentInfo.contracts) {
        deploymentInfo.contracts = {};
    }

    deploymentInfo.contracts.sender = sender.address;
    deploymentInfo.contracts.receiver = receiver.address;
    deploymentInfo.contractsDeployed = true;
    deploymentInfo.contractsTimestamp = new Date().toISOString();
    deploymentInfo.contractsGasOptions = {
        maxFeePerGas: gasOptions.maxFeePerGas?.toString(),
        maxPriorityFeePerGas: gasOptions.maxPriorityFeePerGas?.toString(),
        gasPrice: gasOptions.gasPrice?.toString()
    };

    try {
        fs.writeFileSync(endpointFileName, JSON.stringify(deploymentInfo, null, 2));
        console.log(`✅ Updated deployment info saved to ${endpointFileName}`);
    } catch (error) {
        console.log("⚠️ Warning: Could not save updated deployment info:", error.message);
    }

    console.log("\n🎉 Sender and Receiver contracts deployed successfully!");
    console.log("📍 Contract addresses:");
    console.log("  Endpoint:", endpointAddress);
    console.log("  WTAN:", wtanAddress);
    console.log("  Sender:", sender.address);
    console.log("  Receiver:", receiver.address);
    console.log("🔐 Security: Only the Receiver contract can mint WTAN tokens");
    console.log("🌐 Network:", network.name, "Chain ID:", network.chainId);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Deployment failed:", error);
        process.exit(1);
    });