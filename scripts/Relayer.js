const { ethers } = require("hardhat");

async function main() {
    const [deployer] = await ethers.getSigners();

    console.log("Deploying with:", deployer.address);

    const Relayer = await ethers.getContractFactory("Relayer");
    const relayer = await Relayer.deploy();
    await relayer.deployed();

    console.log("✅ Relayer deployed at:", relayer.address);

    const ULN_ADDRESS = "0xC9f5Fe4C2d0BDbe412f6C030ED7aE871764206e0"; // Sepolia ULN

    // ✅ CALL initialize()
    const tx = await relayer.initialize(ULN_ADDRESS);
    await tx.wait();
    console.log("✅ Relayer initialized with ULN");

    // ✅ Verify owner
    const owner = await relayer.owner();
    console.log("👑 Owner of relayer:", owner);
}

main().catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
});
