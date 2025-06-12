// scripts/05_test-bridge.js
const { ethers } = require("hardhat");
const fs = require('fs');

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Testing bridge with account:", deployer.address);

    // Get network info
    const network = await ethers.provider.getNetwork();
    console.log("Current network:", network.name, "Chain ID:", network.chainId);

    // Load deployment info
    let filenameNetworkName;
if (network.chainId.toString() === "4442") {
    filenameNetworkName = "tan";
} else {
    filenameNetworkName = network.name || network.chainId.toString();
}

    const deploymentFileName = `deployments/endpoint-${filenameNetworkName}.json`;
    if (!fs.existsSync(deploymentFileName)) {
        throw new Error(`Deployment file ${deploymentFileName} not found.`);
    }

    const deploymentInfo = JSON.parse(fs.readFileSync(deploymentFileName, 'utf8'));
    
    if (!deploymentInfo.bridgeSetup || !deploymentInfo.bridgeSetup.setupComplete) {
        throw new Error("Bridge setup not complete. Run setup-bridge.js first.");
    }

    // Get contract instances using fully qualified names
    const sender = await ethers.getContractAt("contracts/Sender.sol:Sender", deploymentInfo.sender);
    const receiver = await ethers.getContractAt("contracts/Receiver.sol:Receiver", deploymentInfo.receiver);

    console.log("Contract addresses:");
    console.log("Sender:", sender.address);
    console.log("Receiver:", receiver.address);
    console.log("Remote Chain ID:", deploymentInfo.bridgeSetup.remoteLzChainId);

    // Check current balance
    const balance = await ethers.provider.getBalance(deployer.address);
    console.log("Account balance:", ethers.utils.formatEther(balance), "ETH");

    // Test message
    const currentChainId = network.chainId;
const remoteChainId = deploymentInfo.bridgeSetup.remoteLzChainId;

const chainNameMap = {
    10161: "sepolia",
    4442: "tan"
};

// Invert the names: use remote chain name instead of current
const testMessageString = `Hello from ${chainNameMap[remoteChainId] || "unknown"} at ${new Date().toISOString()}`;
const testMessage = ethers.utils.toUtf8Bytes(testMessageString);

console.log("Test message:", testMessageString);



//const networkName = networkLabels[network.chainId] || `chain-${network.chainId}`;
//const testMessage = ethers.utils.toUtf8Bytes(`Hello from ${networkName} at ${new Date().toISOString()}`);

  //console.log("Test message:", testMessage);


    // Get quote for the message (if the contract supports it)
    try {
        console.log("Getting quote for cross-chain message...");
        // This depends on your contract implementation
        // const quote = await sender.quote(deploymentInfo.bridgeSetup.remoteLzChainId, testMessage, false);
        // console.log("Estimated fee:", ethers.utils.formatEther(quote), "ETH");
    } catch (error) {
        console.log("Quote not available, using default fee");
    }

    // Send test message
    console.log("Sending test message...");
    const tx = await sender.sendMessage(
        deploymentInfo.bridgeSetup.remoteLzChainId,
        testMessage,
        { value: ethers.utils.parseEther("0.01") } // Small amount for gas
    );

    console.log("Transaction sent:", tx.hash);
    console.log("Waiting for confirmation...");
    
    const receipt = await tx.wait();
    console.log("Transaction confirmed in block:", receipt.blockNumber);
    console.log("Gas used:", receipt.gasUsed.toString());

    // Parse events more carefully
    console.log("\n=== Transaction Events ===");
    const events = receipt.events || [];
    console.log(`Found ${events.length} events:`);
    
    events.forEach((event, index) => {
        console.log(`\nEvent ${index}:`);
        console.log("  Contract:", event.address);
        console.log("  Event Name:", event.event || "Unknown");
        console.log("  Topics:", event.topics);
        
        if (event.args && event.args.length > 0) {
            console.log("  Args:");
            event.args.forEach((arg, argIndex) => {
                console.log(`    [${argIndex}]:`, arg.toString());
            });
        }
        
        if (event.data && event.data !== "0x") {
            console.log("  Data:", event.data);
        }
    });

    // Check for specific events
    const messageSentEvents = events.filter(e => e.event === "MessageSent" || e.event === "SendMessage");
    if (messageSentEvents.length > 0) {
        console.log("\n🚀 Message sent successfully!");
        messageSentEvents.forEach((event, index) => {
            console.log(`SendMessage Event ${index}:`, event.args);
        });
    }

    // Log transaction receipt for debugging
    console.log("\n=== Full Receipt ===");
    console.log("Status:", receipt.status === 1 ? "SUCCESS" : "FAILED");
    console.log("Block Number:", receipt.blockNumber);
    console.log("Transaction Hash:", receipt.transactionHash);
    console.log("From:", receipt.from);
    console.log("To:", receipt.to);

    console.log("\n✅ Test completed!");
    console.log("\n📝 Next Steps:");
    console.log("1. Check the LayerZero scan for your transaction:");
    console.log(`   https://layerzeroscan.com/tx/${tx.hash}`);
    console.log("2. Monitor the destination chain for message delivery");
    console.log("3. In a real cross-chain scenario, run this script on the destination chain to see received messages");

    // Optional: Try to read any stored messages
    try {
        console.log("\n=== Checking Stored Messages ===");
        // This depends on your contract implementation
        // const messageCount = await receiver.getMessageCount();
        // console.log("Messages received:", messageCount.toString());
    } catch (error) {
        console.log("Could not read stored messages (method may not exist)");
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("\n❌ Error occurred:");
        console.error(error);
        process.exit(1);
    });