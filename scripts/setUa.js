const { ethers } = require("hardhat");

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with the account:", deployer.address);

    const userApplicationAddress = "0x4bFC677d064F5D98C0a91E3cF4302825010e0201";
    const userApplication = await ethers.getContractAt("UserApplication", userApplicationAddress);

    const chainId = 10161;
    const inboundProofLibraryVersion = 1;
    const inboundBlockConfirmations = 42;
    const relayerAddress = "0x65130EF45182e53885E291B0Fb6336E822ff173C";
    const outboundProofType = 1;
    const outboundBlockConfirmations = 42;
    const oracleAddress = "0x3e262F8bB827235c658012Fe6eCa420927823EBB";

    try {
        // Call the setDefaultConfig function to set the configuration
        const tx = await userApplication.setDefaultConfig(
            chainId,
            inboundProofLibraryVersion,
            inboundBlockConfirmations,
            relayerAddress,
            outboundProofType,
            outboundBlockConfirmations,
            oracleAddress,
            {
                gasLimit: 500000, // Set higher gas limit
            }
        );

        console.log("Setting default config...");
        await tx.wait(); // Wait for the transaction to be mined

        console.log("Default config set successfully!");
    } catch (error) {
        console.error("Transaction failed:", error);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
