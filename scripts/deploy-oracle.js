const { ethers } = require("hardhat");

async function main() {
    const [deployer] = await ethers.getSigners();

    console.log("Deploying with:", deployer.address);

    const Oracle = await ethers.getContractFactory("Oracle");

    // 🛠 Set gasPrice manually
    const oracle = await Oracle.deploy({
        gasPrice: ethers.utils.parseUnits("10", "gwei") // ← Adjust this as per your network
    });

    await oracle.deployed();
    console.log("✅ Oracle deployed at:", oracle.address);
}

main().catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
});
