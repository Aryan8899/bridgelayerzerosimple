const { ethers } = require("hardhat");

async function main() {
  
    const [deployer] = await ethers.getSigners(); // Get the deployer's account

    // Replace with your actual contract name and address
    const contract = await ethers.getContractAt("UltraLightNode", "0xb85F78148f5Dd95f038Dd919292E3DF5750662CF");

    const srcChainId = 4442; // Source chain ID
    const uaAddress = "0xBe59330bc42B8e2d3F5a67CF0B67a2BA49CC1638"; // The address of your User Application

    // Fetch all config types from the contract
    const inboundProofLibraryVersion = await contract.getConfig(srcChainId, uaAddress, 1); // ConfigType 1 for inboundProofLibraryVersion
    const inboundBlockConfirmations = await contract.getConfig(srcChainId, uaAddress, 2); // ConfigType 2 for inboundBlockConfirmations
    const relayer = await contract.getConfig(srcChainId, uaAddress, 3); // ConfigType 3 for relayer
    const outboundProofType = await contract.getConfig(srcChainId, uaAddress, 4); // ConfigType 4 for outboundProofType
    const outboundBlockConfirmations = await contract.getConfig(srcChainId, uaAddress, 5); // ConfigType 5 for outboundBlockConfirmations
    const oracle = await contract.getConfig(srcChainId, uaAddress, 6); // ConfigType 6 for oracle

    // Decode all the returned values
    const decodedInboundProofLibraryVersion = ethers.utils.defaultAbiCoder.decode(["uint16"], inboundProofLibraryVersion);
    const decodedInboundBlockConfirmations = ethers.utils.defaultAbiCoder.decode(["uint64"], inboundBlockConfirmations);
    const decodedRelayer = ethers.utils.defaultAbiCoder.decode(["address"], relayer);
    const decodedOutboundProofType = ethers.utils.defaultAbiCoder.decode(["uint16"], outboundProofType);
    const decodedOutboundBlockConfirmations = ethers.utils.defaultAbiCoder.decode(["uint64"], outboundBlockConfirmations);
    const decodedOracle = ethers.utils.defaultAbiCoder.decode(["address"], oracle);

    // Log the decoded values
    console.log("Inbound Proof Library Version:", decodedInboundProofLibraryVersion[0]);
    console.log("Inbound Block Confirmations:", decodedInboundBlockConfirmations[0]);
    console.log("Relayer Address:", decodedRelayer[0]);
    console.log("Outbound Proof Type:", decodedOutboundProofType[0]);
    console.log("Outbound Block Confirmations:", decodedOutboundBlockConfirmations[0]);
    console.log("Oracle Address:", decodedOracle[0]);
}

// Run the function to get and decode the configuration data
main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
