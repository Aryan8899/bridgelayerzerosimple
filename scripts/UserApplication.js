// scripts/deploy.js
const { ethers } = require("hardhat");
const fs = require("fs");


async function main() {
    // Get the signers from Hardhat (deployer account)
    const [deployer] = await ethers.getSigners();
    
    console.log("Deploying contracts with the account:", deployer.address);

   // const [deployer] = await ethers.getSigners();
   // console.log("🔍 Testing bridge with account:", deployer.address);

    const network = await ethers.provider.getNetwork();
    const chainId = network.chainId.toString();
    const isTan = chainId === "4442";
    const filename = `deployments/endpoint-${isTan ? "tan" : "sepolia"}.json`;
    const remoteLzChainId = isTan ? 10161 : 4442;

    if (!fs.existsSync(filename)) throw new Error(`Missing: ${filename}`);
    const deployment = JSON.parse(fs.readFileSync(filename, "utf8"));

    // Deploy the Endpoint contract first (if not deployed already)
   

    // Now deploy the UserApplication contract and pass the Endpoint address
    console.log(deployment.contracts.endpoint)
    const UserApplication = await ethers.getContractFactory("UserApplication");
    const userApplication = await UserApplication.deploy(deployment.contracts.endpoint,{
        gasPrice: ethers.utils.parseUnits("20", "gwei")
});
    console.log("UserApplication contract deployed to:", userApplication.address);

    // Optionally: Deploy your other contracts (e.g., UltraLightNode, Relayer, etc.) if needed.

    // Return contract addresses
    // return {
    //     endpoint: endpoint.address,
    //     userApplication: userApplication.address,
    // };
}

// Run the deployment
main()
    .then((deployedContracts) => {
        console.log("Deployment completed:");
     //   console.log("Endpoint Contract:", deployedContracts.endpoint);
     //   console.log("UserApplication Contract:", deployedContracts.userApplication);
    })
    .catch((error) => {
        console.error("Deployment failed:", error);
        process.exit(1);
    });
