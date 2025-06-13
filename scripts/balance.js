const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deployer Address:", deployer.address);

    const network = await ethers.provider.getNetwork();
    const chainId = network.chainId.toString();
    const chainName = network.name || chainId;

    let filenameNetworkName;
    if (network.chainId.toString() === "4442") {
      filenameNetworkName = "tan";
    } else if (network.chainId.toString() === "11155111") {
      filenameNetworkName = "sepolia";
    } else {
      filenameNetworkName = network.name || network.chainId.toString();
    }

    const filename = `deployments/endpoint-${filenameNetworkName}.json`;
    if (!fs.existsSync(filename)) {
        throw new Error(`Deployment file ${filename} not found.`);
    }

    const data = JSON.parse(fs.readFileSync(filename, "utf-8"));
    const wtanAddress = data.contracts?.wtan;

    if (!wtanAddress) {
        throw new Error("WTAN address not found in deployment file.");
    }

    const wtan = await ethers.getContractAt("WTAN", wtanAddress);

    const balance = await wtan.balanceOf(deployer.address);
    console.log(`WTAN Balance: ${ethers.utils.formatUnits(balance, 18)} WTAN`);
}

main().catch((error) => {
    console.error("Error:", error);
    process.exit(1);
});


