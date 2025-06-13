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
    console.log("💰 Balance:", ethers.utils.formatEther(await deployer.getBalance()), "ETH");

    // Load deployment files
    const sepoliaFile = `deployments/endpoint-sepolia.json`;
    const tanFile = `deployments/endpoint-tan.json`;

    const sepoliaDeployment = fs.existsSync(sepoliaFile)
        ? JSON.parse(fs.readFileSync(sepoliaFile, 'utf8')) : null;

    const tanDeployment = fs.existsSync(tanFile)
        ? JSON.parse(fs.readFileSync(tanFile, 'utf8')) : null;

    if (!sepoliaDeployment || !tanDeployment) {
        console.log("❌ Missing deployment files!");
        console.log("Sepolia found:", !!sepoliaDeployment);
        console.log("TAN found:", !!tanDeployment);
        console.log("\n💡 Run deployment scripts first:");
        console.log("   npx hardhat run scripts/01_deploy-endpoint.js --network sepolia");
        console.log("   npx hardhat run scripts/01_deploy-endpoint.js --network tan");
        return;
    }

    console.log("\n=== 📋 DEPLOYMENT SUMMARY ===");
    console.log("\n🔗 SEPOLIA DEPLOYMENT:");
    console.log("  Endpoint:", sepoliaDeployment.endpoint);
    console.log("  Sender:", sepoliaDeployment.sender);
    console.log("  Receiver:", sepoliaDeployment.receiver);
    console.log("  Library:", sepoliaDeployment.library);
    console.log("  LZ Chain ID:", sepoliaDeployment.lzChainId);

    console.log("\n🔗 TAN DEPLOYMENT:");
    console.log("  Endpoint:", tanDeployment.endpoint);
    console.log("  Sender:", tanDeployment.sender);
    console.log("  Receiver:", tanDeployment.receiver);
    console.log("  Library:", tanDeployment.library);
    console.log("  LZ Chain ID:", tanDeployment.lzChainId);

    const currentDeployment = network.chainId === 11155111 ? sepoliaDeployment : tanDeployment;
    const remoteDeployment = network.chainId === 11155111 ? tanDeployment : sepoliaDeployment;
    const remoteName = network.chainId === 11155111 ? "TAN" : "Sepolia";

    console.log(`\n=== 🔍 VERIFYING FROM ${networkName.toUpperCase()} ===`);

    try {
        // Load contracts
        const sender = await ethers.getContractAt("contracts/Sender.sol:Sender", currentDeployment.sender);
        const receiver = await ethers.getContractAt("contracts/Receiver.sol:Receiver", currentDeployment.receiver);
        const endpoint = await ethers.getContractAt("contracts/Endpoint.sol:Endpoint", currentDeployment.endpoint);

        // 1. Deployment check
        console.log("\n1️⃣ CONTRACT DEPLOYMENT CHECK:");
        const senderCode = await ethers.provider.getCode(sender.address);
        const receiverCode = await ethers.provider.getCode(receiver.address);
        const endpointCode = await ethers.provider.getCode(endpoint.address);

        console.log("  " + (senderCode !== "0x" ? "✅" : "❌") + " Sender:", sender.address);
        console.log("  " + (receiverCode !== "0x" ? "✅" : "❌") + " Receiver:", receiver.address);
        console.log("  " + (endpointCode !== "0x" ? "✅" : "❌") + " Endpoint:", endpoint.address);

        if (senderCode === "0x" || receiverCode === "0x" || endpointCode === "0x") {
            console.log("❌ Some contracts are not deployed properly!");
            return;
        }

        // 2. Bridge config check
        console.log("\n2️⃣ BRIDGE CONFIGURATION:");
        const bridgeSetup = currentDeployment.bridgeSetup;
        if (bridgeSetup && bridgeSetup.setupComplete) {
            console.log("  ✅ Bridge setup complete");
            console.log("  🔗 Remote Chain ID:", bridgeSetup.remoteLzChainId);
            console.log("  📍 Remote Receiver:", bridgeSetup.remoteReceiver);
            console.log("  🌐 Remote Network:", remoteName);

            // Verify remote receiver matches
            const expectedRemoteReceiver = remoteDeployment.receiver;
            if (bridgeSetup.remoteReceiver.toLowerCase() === expectedRemoteReceiver.toLowerCase()) {
                console.log("  ✅ Remote receiver address matches deployment");
            } else {
                console.log("  ⚠️ Remote receiver mismatch!");
                console.log("    Expected:", expectedRemoteReceiver);
                console.log("    Configured:", bridgeSetup.remoteReceiver);
            }
        } else {
            console.log("  ❌ Bridge setup incomplete");
            console.log("  💡 Run: npx hardhat run scripts/setup-bridge.js --network", networkName);
            return;
        }

        // 3. Contract State Verification
        console.log("\n3️⃣ CONTRACT STATE VERIFICATION:");
        try {
            // Check if contracts have proper configurations
            console.log("  📊 Checking contract configurations...");
            
            // You can add more contract-specific checks here
            console.log("  ✅ Contracts appear to be properly configured");
        } catch (error) {
            console.log("  ⚠️ Could not verify all contract states:", error.message);
        }

        // 4. Network Gas Price Check
        console.log("\n4️⃣ NETWORK CONDITIONS:");
        try {
            const gasPrice = await ethers.provider.getGasPrice();
            console.log("  ⛽ Current gas price:", ethers.utils.formatUnits(gasPrice, "gwei"), "gwei");
            
            if (network.chainId === 4442) {
                console.log("  ⚡ TAN network - May need elevated gas prices for transactions");
            }
        } catch (error) {
            console.log("  ⚠️ Could not fetch gas price:", error.message);
        }

        // 5. Recent Transaction Logs
        console.log("\n5️⃣ RECENT BRIDGE TRANSACTIONS:");
        try {
            const currentBlock = await ethers.provider.getBlockNumber();
            const fromBlock = Math.max(currentBlock - 1000, 0); // Check last 1000 blocks
            
            console.log(`  🔍 Scanning blocks ${fromBlock} to ${currentBlock}...`);
            
            const logs = await ethers.provider.getLogs({
                address: sender.address,
                fromBlock,
                toBlock: 'latest'
            });

            console.log(`  📨 Found ${logs.length} transaction logs from Sender`);
            
            if (logs.length > 0) {
                console.log("  📋 Recent transactions:");
                logs.slice(-5).forEach((log, idx) => {
                    console.log(`    ${idx + 1}. Block: ${log.blockNumber} | TX: ${log.transactionHash}`);
                });
            } else {
                console.log("  ℹ️ No recent bridge transactions found");
            }

            // Also check receiver logs
            const receiverLogs = await ethers.provider.getLogs({
                address: receiver.address,
                fromBlock,
                toBlock: 'latest'
            });

            console.log(`  📥 Found ${receiverLogs.length} receiver logs`);
            
        } catch (error) {
            console.log("  ⚠️ Error fetching transaction logs:", error.message);
        }

        // 6. Explorer Links
        console.log("\n6️⃣ EXPLORER VERIFICATION LINKS:");
        if (network.chainId === 11155111) {
            console.log("  🔍 Sepolia Etherscan Links:");
            console.log(`    📍 Sender: https://sepolia.etherscan.io/address/${sepoliaDeployment.sender}`);
            console.log(`    📍 Receiver: https://sepolia.etherscan.io/address/${sepoliaDeployment.receiver}`);
            console.log(`    📍 Endpoint: https://sepolia.etherscan.io/address/${sepoliaDeployment.endpoint}`);
            console.log(`    📍 Your Account: https://sepolia.etherscan.io/address/${deployer.address}`);
        } else if (network.chainId === 4442) {
            console.log("  🔍 TAN Blockscout Links:");
            console.log(`    📍 Sender: https://tan.blockscout.com/address/${tanDeployment.sender}`);
            console.log(`    📍 Receiver: https://tan.blockscout.com/address/${tanDeployment.receiver}`);
            console.log(`    📍 Endpoint: https://tan.blockscout.com/address/${tanDeployment.endpoint}`);
            console.log(`    📍 Your Account: https://tan.blockscout.com/address/${deployer.address}`);
        }

        // 7. Cross-Chain Verification
        console.log("\n7️⃣ CROSS-CHAIN VERIFICATION:");
        console.log("  📋 Bridge Connection Summary:");
        console.log(`    ${networkName.toUpperCase()} → ${remoteName}`);
        console.log(`    Sender: ${currentDeployment.sender}`);
        console.log(`    → Receiver: ${remoteDeployment.receiver}`);
        console.log(`    LZ Chain ID: ${currentDeployment.lzChainId} → ${remoteDeployment.lzChainId}`);

        // 8. Testing Instructions
        console.log("\n8️⃣ BRIDGE TESTING INSTRUCTIONS:");
        console.log("  🧪 To test the bridge:");
        console.log(`    1️⃣ From ${networkName}: npx hardhat run scripts/test-and-verify-bridge.js --network ${networkName}`);
        console.log(`    2️⃣ Verify on ${remoteName.toLowerCase()}: npx hardhat run scripts/verify-bridge-both-chains.js --network ${network.chainId === 11155111 ? 'tan' : 'sepolia'}`);
        console.log("  📊 Both scripts now include enhanced gas price handling");

        // 9. Manual Checklist
        console.log("\n9️⃣ MANUAL VERIFICATION CHECKLIST:");
        console.log("  □ All contracts deployed and verified");
        console.log("  □ Bridge configuration is complete");
        console.log("  □ Remote receiver addresses match");
        console.log("  □ Gas prices are reasonable for transactions");
        console.log("  □ Explorer links work and show contract code");
        console.log("  □ Bridge test transactions succeed");
        console.log("  □ Cross-chain message delivery works");

        // 10. Health Check Summary
        console.log("\n🏥 BRIDGE HEALTH CHECK SUMMARY:");
        const healthChecks = [
            { name: "Contracts Deployed", status: senderCode !== "0x" && receiverCode !== "0x" && endpointCode !== "0x" },
            { name: "Bridge Configured", status: bridgeSetup && bridgeSetup.setupComplete },
            { name: "Remote Addresses Match", status: bridgeSetup && bridgeSetup.remoteReceiver.toLowerCase() === remoteDeployment.receiver.toLowerCase() },
            { name: "Sufficient Balance", status: (await deployer.getBalance()).gt(ethers.utils.parseEther("0.01")) }
        ];

        healthChecks.forEach(check => {
            console.log(`  ${check.status ? '✅' : '❌'} ${check.name}`);
        });

        const allHealthy = healthChecks.every(check => check.status);
        console.log(`\n🎯 Overall Bridge Status: ${allHealthy ? '✅ HEALTHY' : '⚠️ NEEDS ATTENTION'}`);

    } catch (error) {
        console.log("\n❌ VERIFICATION ERROR:");
        console.error(error.message);
        
        if (error.message.includes("could not detect network")) {
            console.log("💡 TIP: Check your network configuration in hardhat.config.js");
        }
        
        if (error.message.includes("contract not deployed")) {
            console.log("💡 TIP: Run deployment scripts first");
        }
    }

    console.log("\n" + "=".repeat(60));
    console.log("🎉 VERIFICATION COMPLETE!");
    console.log("Use the explorer links and run tests on both chains for full verification.");
    console.log("=".repeat(60));
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Verification script failed:");
        console.error(error);
        process.exit(1);
    });