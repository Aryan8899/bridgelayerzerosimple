const { ethers } = require("hardhat");
const fs = require('fs');
const path = require("path");
const receiverABI = require("../artifacts/contracts/Receiver.sol/Receiver.json");
const { Signer } = require("ethers");

async function main() {
    const [deployer] = await ethers.getSigners();
    const network = await ethers.provider.getNetwork();
    let provider;
    let gasOptions = {};
    let filenameNetworkName;

    // Set the provider and network-specific options
    if (network.chainId.toString() === "4442") {  // TAN Network
        filenameNetworkName = "tan";
        provider = new ethers.providers.JsonRpcProvider("https://tan-devnetrpc2.tan.live");
        gasOptions = { gasPrice: ethers.utils.parseUnits("2", "gwei") };  // 2 Gwei for TAN network
    } else if (network.chainId.toString() === "11155111") {  // Sepolia Network
        filenameNetworkName = "sepolia";
        provider = new ethers.providers.JsonRpcProvider("https://eth-sepolia.g.alchemy.com/v2/B7X9gRjxfPZ9uOYogYWOy");
        gasOptions = {}; // Default gas settings for Sepolia
    } else {
        throw new Error("Unsupported network");
    }

    console.log("Using provider:", provider.connection.url);
    console.log("Deploying Sender and Receiver contracts with account:", deployer.address);

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

    // Add the getGasPrice function to dynamically calculate the gas price
    async function getGasPrice() {
        try {
            const feeData = await provider.getFeeData();
            console.log("Current fee data:", feeData);

            if (feeData.maxFeePerGas) {
                return {
                    maxFeePerGas: feeData.maxFeePerGas.mul(120).div(100),  // Adjust by 20%
                    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas?.mul(110).div(100) || ethers.utils.parseUnits("2", "gwei")
                };
            } else if (feeData.gasPrice) {
                return {
                    gasPrice: feeData.gasPrice.mul(120).div(100)  // Adjust by 20%
                };
            } else {
                return { gasPrice: ethers.utils.parseUnits("50", "gwei") };  // Default gas price
            }
        } catch (error) {
            console.log("Error getting fee data, using fallback gas price:", error.message);
            return {
                gasPrice: ethers.utils.parseUnits("50", "gwei")  // Default fallback gas price
            };
        }
    }

    // Get gas price dynamically
    gasOptions = await getGasPrice();

    async function deployWithGasEstimation(contractName, args = [], description, maxRetries = 3) {
        for (let i = 0; i < maxRetries; i++) {
            try {
                console.log(`${description} (attempt ${i + 1}/${maxRetries})`);
                const ContractFactory = await ethers.getContractFactory(contractName);
                const deploymentData = ContractFactory.getDeployTransaction(...args);
                const estimatedGas = await provider.estimateGas(deploymentData);
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

    console.log("📤 Deploying Sender...");
    const sender = await deployWithGasEstimation(
        "contracts/Sender.sol:Sender",
        [endpointAddress, wtanAddress],
        "Sender deployment"
    );
    console.log("✓ Sender deployed to:", sender.address);

    console.log("📥 Deploying Receiver...");
    const receiver = await deployWithGasEstimation(
        "contracts/Receiver.sol:Receiver",
        [wtanAddress, endpointAddress],
        "Receiver deployment"
    );
    console.log("✓ Receiver deployed to:", receiver.address);

   console.log("🔐 Transferring ownership of WTAN to Receiver...");

// Create WTAN contract instance with deployer signer
const WTAN = await ethers.getContractAt("WTAN", wtanAddress, deployer);

// Call transferOwnership
console.log(receiver.address);

const tx = await WTAN.transferOwnership(receiver.address, {
    ...gasOptions,
    gasLimit: ethers.utils.hexlify(400000) // Increased gas limit
});
await tx.wait();

//await tx.wait();

console.log("✅ Ownership transferred to Receiver:", receiver.address);

    // Fix: Use deployer (signer) instead of provider
    // const contract = new ethers.Contract(receiver.address, receiverABI.abi, deployer);

    // // Use the correct contract instance to call initialize
    // const initTx = await contract.initialize({
    //     ...gasOptions,
    //     gasLimit: ethers.utils.hexlify(300000) // Set a reasonable gas limit
    // });
    // await initTx.wait();
    // console.log("✅ Minter set successfully.");

    // Update deployment information
    if (!deploymentInfo.contracts) {
        deploymentInfo.contracts = {};
    }

    deploymentInfo.contracts.sender = sender.address;
    deploymentInfo.contracts.receiver = receiver.address;
    deploymentInfo.contractsDeployed = true;
    deploymentInfo.contractsTimestamp = new Date().toISOString();
    deploymentInfo.contractsGasOptions = {
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
    console.log("🌐 Network:", network.name, "Chain ID:", network.chainId);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Deployment failed:", error);
        process.exit(1);
    });