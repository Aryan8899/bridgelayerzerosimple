const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Using account:", deployer.address);

    // Get the contract instances
    const network = await ethers.provider.getNetwork();
    let filenameNetworkName, gasPrice;
    if (network.chainId.toString() === "4442") {  // TAN Network
        filenameNetworkName = "tan";
        gasPrice = ethers.utils.parseUnits("20", "gwei");
    } else {
        filenameNetworkName = network.name || network.chainId.toString();
        gasPrice = undefined;
    }

    const deploymentFileName = `deployments/endpoint-${filenameNetworkName}.json`;
    if (!fs.existsSync(deploymentFileName)) {
        throw new Error(`Deployment file ${deploymentFileName} not found.`);
    }

    const deploymentInfo = JSON.parse(fs.readFileSync(deploymentFileName, "utf8"));
    const senderAddress = deploymentInfo.contracts?.sender;
    const wtanAddress = deploymentInfo.contracts?.wtan;
    const endpointAddress = deploymentInfo.contracts?.endpoint;
    const recieverAddress = deploymentInfo.contracts?.receiver;

    if (!senderAddress || !wtanAddress || !endpointAddress || !recieverAddress) {
        throw new Error("Missing sender/wtan/endpoint/receiver address in deployment info.");
    }

    console.log("Using contracts:");
    console.log("Sender:", senderAddress);
    console.log("WTAN:", wtanAddress);
    console.log("Endpoint:", endpointAddress);
    console.log("Receiver:", recieverAddress);

    // Get contract instances
    const sender = await ethers.getContractAt("contracts/Sender.sol:Sender", senderAddress);
    const wtan = await ethers.getContractAt("WTAN", wtanAddress);
    const endpoint = await ethers.getContractAt("Endpoint", endpointAddress);
    const receiver = await ethers.getContractAt("Receiver", recieverAddress);

    // Check the current owner of the WTAN contract
    const owner = await wtan.owner();
    console.log("Current owner of the WTAN contract:", owner);

    // If the owner is not the deployer or receiver, transfer ownership to the Receiver contract
    if (owner !== recieverAddress) {
        console.log("Transferring ownership of WTAN to Receiver contract...");
        const tx = await wtan.transferOwnership(recieverAddress, {
            ...(gasPrice ? { gasPrice } : {}),
        });
        await tx.wait();
        console.log("✅ Ownership transferred to Receiver contract.");
    } else {
        console.log("✅ Ownership is already set to Receiver contract, skipping transfer.");
    }

    // Set the Receiver contract as the minter for the WTAN contract
    if (await wtan.minter() !== recieverAddress) {
        console.log("Setting Receiver contract as the minter for WTAN...");
        const setMinterTx = await wtan.setMinter(recieverAddress, {
            ...(gasPrice ? { gasPrice } : {}),
        });
        await setMinterTx.wait();
        console.log("✅ Receiver contract is now the minter for WTAN.");
    } else {
        console.log("✅ Receiver contract is already the minter.");
    }

    console.log("✅ Bridge test complete.");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Error occurred:", error);
        process.exit(1);
    });
