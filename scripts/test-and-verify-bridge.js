// scripts/test-and-verify-bridge.js - Complete Bridge Testing & Verification
const { ethers } = require("hardhat");
const fs = require('fs');

async function main() {
    console.log("🌉 BRIDGE TEST & VERIFICATION TOOL");
    console.log("=".repeat(50));

    const [deployer] = await ethers.getSigners();
    const network = await ethers.provider.getNetwork();

    const networkLabels = {
        11155111: "sepolia",
        4442: "tan"
    };

    const DEST_NAMES = {
        10161: "sepolia",
        4442: "tan"
    };

    const filenameNetworkName = network.chainId === 4442 ? "tan" : networkLabels[network.chainId] || network.name;

    const deploymentFileName = `deployments/endpoint-${filenameNetworkName}.json`;
    if (!fs.existsSync(deploymentFileName)) {
        throw new Error(`Deployment file ${deploymentFileName} not found.`);
    }

    const deployment = JSON.parse(fs.readFileSync(deploymentFileName, 'utf8'));

    if (!deployment.bridgeSetup || !deployment.bridgeSetup.setupComplete) {
        console.log("❌ Bridge not configured. Run setup-bridge.js first.");
        return;
    }

    const remoteChainId = deployment.bridgeSetup.remoteLzChainId;
    const testMessage = `Hello from ${DEST_NAMES[remoteChainId] || "unknown"} at ${new Date().toISOString()}`;
    const messageBytes = ethers.utils.toUtf8Bytes(testMessage);

    const networkName = networkLabels[network.chainId] || network.name || network.chainId.toString();
    console.log("🚀 Testing bridge from:", networkName);
    console.log("👤 Account:", deployer.address);

    console.log("\n=== 📋 BRIDGE CONFIGURATION ===");
    console.log("Local Sender:", deployment.sender);
    console.log("Remote Receiver:", deployment.bridgeSetup.remoteReceiver);
    console.log("Remote Chain ID:", remoteChainId);

    const sender = await ethers.getContractAt("contracts/Sender.sol:Sender", deployment.sender);

    console.log("\n=== 🧪 RUNNING BRIDGE TEST ===");
    console.log("📤 Sending message:", testMessage);
    console.log("📊 Message size:", messageBytes.length, "bytes");

    const balanceBefore = await deployer.getBalance();
    console.log("💰 Balance before:", ethers.utils.formatEther(balanceBefore), "ETH");

    try {
        const tx = await sender.sendMessage(
            remoteChainId,
            messageBytes,
            { value: ethers.utils.parseEther("0.01") }
        );

        console.log("📝 Transaction hash:", tx.hash);
        console.log("⏳ Waiting for confirmation...");

        const receipt = await tx.wait();
        console.log("✅ Transaction confirmed!");
        console.log("📦 Block number:", receipt.blockNumber);
        console.log("⛽ Gas used:", receipt.gasUsed.toString());

        const balanceAfter = await deployer.getBalance();
        const gasCost = balanceBefore.sub(balanceAfter);
        console.log("💸 Total cost:", ethers.utils.formatEther(gasCost), "ETH");

        console.log("\n=== 📊 TRANSACTION ANALYSIS ===");
        console.log("Status:", receipt.status === 1 ? "✅ SUCCESS" : "❌ FAILED");
        console.log("From:", receipt.from);
        console.log("To:", receipt.to);
        console.log("Events found:", receipt.logs.length);

        if (receipt.logs.length > 0) {
            console.log("\n📋 Transaction Events:");
            receipt.logs.forEach((log, index) => {
                console.log(`\nEvent ${index + 1}:`);
                console.log("  Contract:", log.address);
                console.log("  Topics:", log.topics.length);
                console.log("  Data length:", log.data.length);

                if (log.address.toLowerCase() === sender.address.toLowerCase()) {
                    console.log("  📍 From Sender Contract ✅");
                }
            });
        }

        console.log("\n=== 🔗 EXPLORER VERIFICATION ===");
        if (network.chainId === 11155111) {
            console.log("🔍 Sepolia Etherscan Links:");
            console.log(`📍 Transaction: https://sepolia.etherscan.io/tx/${tx.hash}`);
            console.log(`📍 Sender Contract: https://sepolia.etherscan.io/address/${sender.address}`);
            console.log(`📍 Your Account: https://sepolia.etherscan.io/address/${deployer.address}`);
        } else {
            console.log("🔍 TANPS Explorer Links:");
            console.log(`📍 Transaction: [TANPS_EXPLORER]/tx/${tx.hash}`);
            console.log(`📍 Sender Contract: [TANPS_EXPLORER]/address/${sender.address}`);
            console.log(`📍 Your Account: [TANPS_EXPLORER]/address/${deployer.address}`);
            console.log("\n⚠️  Replace [TANPS_EXPLORER] with your actual TANPS explorer URL");
        }

        console.log("\n=== ✅ VERIFICATION CHECKLIST ===");
        console.log("□ Transaction shows as successful");
        console.log("□ Sender contract address matches deployment");
        console.log("□ Gas used is reasonable (~60-80k)");
        console.log("□ Transaction includes message data");
        console.log("□ Events were emitted properly");
        console.log("□ ETH value sent matches fee (0.01 ETH)");

        console.log("\n=== 🔄 NEXT STEPS ===");
        const remoteNetwork = network.chainId === 11155111 ? "tanps" : "sepolia";
        console.log(`1️⃣ Switch to ${remoteNetwork} and run:`);
        console.log(`   npx hardhat run scripts/test-and-verify-bridge.js --network ${remoteNetwork}`);

        console.log("\n2️⃣ Verify on destination chain:");
        console.log("   • Message received");
        console.log("   • lzReceive called");
        console.log("   • Message stored or state updated");

        console.log("\n3️⃣ Production deployment advice:");
        console.log("   • Use official LayerZero endpoints");
        console.log("   • Deploy to real networks");
        console.log("   • Enable message reliability features");

        console.log("\n" + "=".repeat(50));
        console.log("🎉 BRIDGE TEST COMPLETED SUCCESSFULLY!");
        console.log("Check the explorer links above for detailed verification");
        console.log("=".repeat(50));

    } catch (error) {
        console.log("\n❌ BRIDGE TEST FAILED:");
        console.error(error.message);

        if (error.message.includes("insufficient funds")) {
            console.log("💡 TIP: Add more ETH to your account");
            console.log("Current balance:", ethers.utils.formatEther(await deployer.getBalance()));
        }

        if (error.message.includes("execution reverted")) {
            console.log("💡 TIP: Run: npx hardhat run scripts/04_setup-bridge.js --network", networkName);
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Script failed:");
        console.error(error);
        process.exit(1);
    });
