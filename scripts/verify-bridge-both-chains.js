// scripts/verify-bridge-both-chains.js - Cross-Chain Bridge Verification
const { ethers } = require("hardhat");
const fs = require('fs');

async function main() {
    console.log("🌉 CROSS-CHAIN BRIDGE VERIFICATION TOOL");
    console.log("=".repeat(60));

    const [deployer] = await ethers.getSigners();
    const network = await ethers.provider.getNetwork();

    const networkLabels = {
        11155111: "sepolia",
        4442: "tan"
    };

    const networkName = networkLabels[network.chainId] || network.name || network.chainId.toString();

    console.log("🔍 Current Network:", networkName, "| Chain ID:", network.chainId);
    console.log("👤 Account:", deployer.address);

    // Load deployment files
    const sepoliaFile = `deployments/endpoint-sepolia.json`;
    const tanpsFile = `deployments/endpoint-tan.json`;

    const sepoliaDeployment = fs.existsSync(sepoliaFile)
        ? JSON.parse(fs.readFileSync(sepoliaFile, 'utf8')) : null;

    const tanpsDeployment = fs.existsSync(tanpsFile)
        ? JSON.parse(fs.readFileSync(tanpsFile, 'utf8')) : null;

    if (!sepoliaDeployment || !tanpsDeployment) {
        console.log("❌ Missing deployment files!");
        console.log("Sepolia found:", !!sepoliaDeployment);
        console.log("TANPS found:", !!tanpsDeployment);
        return;
    }

    console.log("\n=== 📋 DEPLOYMENT SUMMARY ===");
    console.log("\n🔗 SEPOLIA DEPLOYMENT:");
    console.log("  Endpoint:", sepoliaDeployment.endpoint);
    console.log("  Sender:", sepoliaDeployment.sender);
    console.log("  Receiver:", sepoliaDeployment.receiver);
    console.log("  Library:", sepoliaDeployment.library);
    console.log("  LZ Chain ID:", sepoliaDeployment.lzChainId);

    console.log("\n🔗 TANPS DEPLOYMENT:");
    console.log("  Endpoint:", tanpsDeployment.endpoint);
    console.log("  Sender:", tanpsDeployment.sender);
    console.log("  Receiver:", tanpsDeployment.receiver);
    console.log("  Library:", tanpsDeployment.library);
    console.log("  LZ Chain ID:", tanpsDeployment.lzChainId);

    const currentDeployment = network.chainId === 11155111 ? sepoliaDeployment : tanpsDeployment;
    const remoteDeployment = network.chainId === 11155111 ? tanpsDeployment : sepoliaDeployment;
    const remoteName = network.chainId === 11155111 ? "TANPS" : "Sepolia";

    console.log(`\n=== 🔍 VERIFYING FROM ${networkName.toUpperCase()} ===`);

    // Load contracts
    const sender = await ethers.getContractAt("contracts/Sender.sol:Sender", currentDeployment.sender);
    const receiver = await ethers.getContractAt("contracts/Receiver.sol:Receiver", currentDeployment.receiver);
    const endpoint = await ethers.getContractAt("contracts/Endpoint.sol:Endpoint", currentDeployment.endpoint);

    // 1. Deployment check
    console.log("\n1️⃣ CONTRACT DEPLOYMENT CHECK:");
    console.log("  ✅ Sender:", (await ethers.provider.getCode(sender.address)) !== "0x");
    console.log("  ✅ Receiver:", (await ethers.provider.getCode(receiver.address)) !== "0x");
    console.log("  ✅ Endpoint:", (await ethers.provider.getCode(endpoint.address)) !== "0x");

    // 2. Bridge config check
    console.log("\n2️⃣ BRIDGE CONFIGURATION:");
    const bridgeSetup = currentDeployment.bridgeSetup;
    if (bridgeSetup && bridgeSetup.setupComplete) {
        console.log("  ✅ Bridge setup complete");
        console.log("  🔗 Remote Chain ID:", bridgeSetup.remoteLzChainId);
        console.log("  📍 Remote Receiver:", bridgeSetup.remoteReceiver);
        console.log("  🌐 Remote Network:", remoteName);
    } else {
        console.log("  ❌ Bridge setup incomplete");
        return;
    }

    // 3. Transaction Logs
    console.log("\n3️⃣ RECENT BRIDGE TRANSACTIONS:");
    const currentBlock = await ethers.provider.getBlockNumber();
    const fromBlock = Math.max(currentBlock - 100, 0);
    const logs = await ethers.provider.getLogs({
        address: sender.address,
        fromBlock,
        toBlock: 'latest'
    });

    console.log(`  📨 Found ${logs.length} logs`);
    logs.slice(-3).forEach((log, idx) => {
        console.log(`    ${idx + 1}. Block: ${log.blockNumber} | TX: ${log.transactionHash.slice(0, 20)}...`);
    });

    // 4. Explorer Links
    console.log("\n4️⃣ EXPLORER VERIFICATION LINKS:");
    if (network.chainId === 11155111) {
        console.log(`  📍 Sender: https://sepolia.etherscan.io/address/${sepoliaDeployment.sender}`);
        console.log(`  📍 Receiver: https://sepolia.etherscan.io/address/${sepoliaDeployment.receiver}`);
        console.log(`  📍 Endpoint: https://sepolia.etherscan.io/address/${sepoliaDeployment.endpoint}`);
        console.log(`  📍 Account: https://sepolia.etherscan.io/address/${deployer.address}`);
    } else {
        const tanpsExplorer = "https://your-tanps-explorer.com";
        console.log(`  📍 Sender: ${tanpsExplorer}/address/${tanpsDeployment.sender}`);
        console.log(`  📍 Receiver: ${tanpsExplorer}/address/${tanpsDeployment.receiver}`);
        console.log(`  📍 Endpoint: ${tanpsExplorer}/address/${tanpsDeployment.endpoint}`);
        console.log(`  📍 Account: ${tanpsExplorer}/address/${deployer.address}`);
    }

    // 5. Instructions
    console.log("\n5️⃣ BRIDGE TESTING INSTRUCTIONS:");
    console.log(`   ➤ Run on this network: npx hardhat run scripts/05_test-bridge.js --network ${networkName}`);
    console.log(`   ➤ Then check remote network: npx hardhat run scripts/verify-bridge-both-chains.js --network ${network.chainId === 11155111 ? 'tanps' : 'sepolia'}`);

    // 6. Manual Checklist
    console.log("\n6️⃣ MANUAL VERIFICATION CHECKLIST:");
    console.log("  □ Sender emits sendMessage events");
    console.log("  □ Message bytes look valid");
    console.log("  □ Receiver logs lzReceive call");
    console.log("  □ No failed TXs in either explorer");

    // 7. Summary
    console.log("\n🎉 VERIFICATION DONE!");
    console.log("   Use explorers and run on both chains for full cross-chain proof.");
    console.log("=".repeat(60));
}

main().then(() => process.exit(0)).catch((e) => {
    console.error("❌ Verification failed:", e);
    process.exit(1);
});
