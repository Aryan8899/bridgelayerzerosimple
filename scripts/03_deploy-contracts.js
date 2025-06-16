//new
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
    //console.log("- WTAN address:", deploymentInfo.contracts?.wtan);

    if (!deploymentInfo.setupComplete) {
        throw new Error("Endpoint setup not complete. Run setup-endpoint.js first.");
    }

    const endpointAddress = deploymentInfo.contracts?.endpoint;
  //  const wtanAddress = deploymentInfo.contracts?.wtan;

    if (!endpointAddress) {
        throw new Error("Missing endpoint or WTAN address in deployment file.");
    }

    console.log("✅ Using Endpoint:", endpointAddress);
   // console.log("✅ Using WTAN:", wtanAddress);

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
// 📥 First deploy WTAN
console.log("📥 Deploying Receiver...");
const receiver = await deployWithGasEstimation(
    "contracts/Receiver.sol:Receiver",
    [endpointAddress], // Remove WTAN address for now
    "Receiver deployment"
);
console.log("✓ Receiver deployed to:", receiver.address);

// Deploy WTAN with receiver address
console.log("🪙 Deploying WTAN...");
const wtan = await deployWithGasEstimation(
    "WTAN",
    [receiver.address], // Pass receiver address to WTAN constructor
    "WTAN deployment"
);
console.log("✓ WTAN deployed to:", wtan.address);

// 🔁 Update WTAN's receiver address now (if you want dynamic re-assignment)
// Optional: Only if your WTAN has `setReceiver()` method, otherwise pass correct one initially

// 📤 Finally deploy Sender
console.log("📤 Deploying Sender...");
const sender = await deployWithGasEstimation(
    "contracts/Sender.sol:Sender",
    [endpointAddress, wtan.address],
    "Sender deployment"
);
console.log("✓ Sender deployed to:", sender.address);

// Update receiver with WTAN address (you'll need to add a setter function)
console.log("🔗 Linking WTAN to Receiver...");
const setWTANTx = await receiver.setWTAN(wtan.address, gasOptions);
await setWTANTx.wait();
console.log("✅ WTAN linked to Receiver");


    if (!deploymentInfo.contracts) {
        deploymentInfo.contracts = {};
    }
   




    deploymentInfo.contracts.sender = sender.address;
    deploymentInfo.contracts.receiver = receiver.address;
    deploymentInfo.contractsDeployed = true;
    deploymentInfo.contracts.wtan = wtan.address;
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
    console.log("  WTAN:", wtan.address);
    console.log("  Sender:", sender.address);
    console.log("  Receiver:", receiver.address);
    console.log("🌐 Network:", network.name, "Chain ID:", network.chainId);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Deployment failed:", error);
        process.exit(1);
    });
