// Import the necessary Hardhat dependencies
const { ethers, network } = require("hardhat");
const fs = require("fs");

async function main() {
    // Deploy the WTAN contract
    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with the account:", deployer.address);

    const network = await ethers.provider.getNetwork();
    const chainId = network.chainId;

    let filenameNetworkName;
    if (chainId === 4442) {
        filenameNetworkName = "tan";
    } else if (chainId === 11155111) {
        filenameNetworkName = "sepolia";
    } else {
        throw new Error("Unsupported network");
    }  

    const endpointFileName = `deployments/endpoint-${filenameNetworkName}.json`;
    const localDeployment = JSON.parse(fs.readFileSync(endpointFileName, "utf8"));

    const wtanAddress = localDeployment.contracts?.wtan;
    const Receiver = localDeployment.contracts?.receiver;


    // Deploy the WTAN contract
    const WTAN = await ethers.getContractAt("WTAN",wtanAddress);
    
    console.log("WTAN is deployed at:", WTAN.address);

    // Deploy the Receiver contract
    const receiver = await ethers.getContractAt("Receiver",Receiver);
   // const receiver = await Receiver.deploy(wtan.address, deployer.address);
    console.log("Receiver is deployed at:", receiver.address);

    // Set the receiver contract as the authorized receiver for the WTAN contract
    console.log("Setting Receiver contract as the authorized receiver...");
    const tx = await WTAN.setReceiver(receiver.address);
    await tx.wait();
    console.log("Receiver contract is now authorized!");

    // Check if the receiver address is correctly set in WTAN
    const receiverAddress = await WTAN.receiver();
    console.log("Receiver address set in WTAN:", receiverAddress);
}

// Run the main function
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
