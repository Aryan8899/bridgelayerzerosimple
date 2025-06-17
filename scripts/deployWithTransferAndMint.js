const { ethers } = require("hardhat");
const fs = require('fs');
const path = require("path");

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

    // Get gas price dynamically
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

    // Deploy or get contract instances
    const Receiver = await ethers.getContractAt("Receiver", deploymentInfo.contracts.receiver, deployer);
    const WTAN = await ethers.getContractAt("WTAN", wtanAddress, deployer);

    // Call transferOwnership and mint
    async function transferOwnershipAndMint() {
        try {
            console.log("🔐 Transferring ownership of WTAN to Receiver...");
            const txTransfer = await WTAN.transferOwnership(Receiver.address, {
                ...gasOptions,
                gasLimit: ethers.utils.hexlify(400000) // Adjust gas limit
            });

            await txTransfer.wait();
            console.log("✅ Ownership transferred to Receiver:", Receiver.address);

            // Check if Receiver contract is initialized (adjust based on your contract logic)
            const isInitialized = await Receiver.initialized(); // Assume `initialized()` returns true if already initialized
            if (!isInitialized) {
                console.log("Receiver contract is not initialized. Calling initialize...");
                const initTx = await Receiver.initialize({
                    ...gasOptions,
                    gasLimit: ethers.utils.hexlify(300000) // Adjust gas limit for initialization
                });
                await initTx.wait();
                console.log("✅ Initialization done!");
            } else {
                console.log("Receiver contract is already initialized. Skipping initialization.");
            }

            // Minting call - assuming the Receiver contract has a mint function
            console.log("🪙 Minting tokens...");
            const mintTx = await Receiver.mint(deployer.address, ethers.utils.parseUnits("100", "ether"), {
                ...gasOptions,
                gasLimit: ethers.utils.hexlify(200000) // Adjust gas limit for minting
            });

            await mintTx.wait();
            console.log("✅ Minting successful, tokens minted to:", deployer.address);
        } catch (error) {
            console.error("❌ Error during ownership transfer and minting:", error);
        }
    }

    await transferOwnershipAndMint();

    // Update deployment information
    if (!deploymentInfo.contracts) {
        deploymentInfo.contracts = {};
    }

    deploymentInfo.contractsDeployed = true;
    deploymentInfo.contractsTimestamp = new Date().toISOString();

    try {
        fs.writeFileSync(endpointFileName, JSON.stringify(deploymentInfo, null, 2));
        console.log(`✅ Updated deployment info saved to ${endpointFileName}`);
    } catch (error) {
        console.log("⚠️ Warning: Could not save updated deployment info:", error.message);
    }

    console.log("\n🎉 Ownership transfer and minting completed!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Deployment failed:", error);
        process.exit(1);
    });
