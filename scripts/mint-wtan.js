const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
    const [deployer] = await ethers.getSigners();

    const network = await ethers.provider.getNetwork();
    console.log("Connected to:", network.name, "Chain ID:", network.chainId);

    // 🔄 Determine filename based on network
    let filenameNetworkName;
    if (network.chainId.toString() === "4442") {
        filenameNetworkName = "tan";
    } else if (network.chainId.toString() === "11155111") {
        filenameNetworkName = "sepolia";
    } else {
        filenameNetworkName = network.name || network.chainId.toString();
    }

    const deploymentFileName = `deployments/endpoint-${filenameNetworkName}.json`;

    if (!fs.existsSync(deploymentFileName)) {
        throw new Error(`Deployment file ${deploymentFileName} not found.`);
    }

    const deploymentInfo = JSON.parse(fs.readFileSync(deploymentFileName, "utf8"));
    const wtanAddress = deploymentInfo.contracts?.wtan;
    const reciever = deploymentInfo.contracts?.receiver;

    if (!wtanAddress) {
        throw new Error(`WTAN address not found in ${deploymentFileName}`);
    }

    console.log("✅ Using WTAN address:", wtanAddress);

    const wtan = await ethers.getContractAt("WTAN", wtanAddress);
    const amount = ethers.utils.parseUnits("1000", 18); // Mint 1000 WTAN

    console.log("🚀 Minting with add reciever",reciever);
    
    const tx = await wtan.mintTo(reciever, amount);
    const receipt = await tx.wait();

    console.log("✅ Mint complete. Gas used:", receipt.gasUsed.toString());

    const balance = await wtan.balanceOf(deployer.address);
    console.log("💰 New WTAN balance:", ethers.utils.formatUnits(balance, 18));
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Minting failed:", error);
        process.exit(1);
    });
