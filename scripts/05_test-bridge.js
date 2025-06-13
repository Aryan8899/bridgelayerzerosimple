
const { ethers } = require("hardhat");
const fs = require('fs');

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Testing bridge with account:", deployer.address);

    const network = await ethers.provider.getNetwork();
    console.log("Current network:", network.name, "Chain ID:", network.chainId);

    
    let filenameNetworkName;
    let gasPrice;

    if (network.chainId.toString() === "4442") {
        filenameNetworkName = "tan";
        gasPrice = ethers.utils.parseUnits("20", "gwei"); // Custom for TAN
    } else {
        filenameNetworkName = network.name || network.chainId.toString();
        gasPrice = undefined; 
    }

    const deploymentFileName = `deployments/endpoint-${filenameNetworkName}.json`;
    if (!fs.existsSync(deploymentFileName)) {
        throw new Error(`Deployment file ${deploymentFileName} not found.`);
    }

    const deploymentInfo = JSON.parse(fs.readFileSync(deploymentFileName, 'utf8'));

    if (!deploymentInfo.bridgeSetup || !deploymentInfo.bridgeSetup.setupComplete) {
        throw new Error("Bridge setup not complete. Run setup-bridge.js first.");
    }

   
    let senderAddress, receiverAddress;
    
    if (deploymentInfo.sender) {
        senderAddress = deploymentInfo.sender;
    } else if (deploymentInfo.contracts && deploymentInfo.contracts.sender) {
        senderAddress = deploymentInfo.contracts.sender;
    } else {
        throw new Error("Sender contract address not found in deployment file");
    }

    if (deploymentInfo.receiver) {
        receiverAddress = deploymentInfo.receiver;
    } else if (deploymentInfo.contracts && deploymentInfo.contracts.receiver) {
        receiverAddress = deploymentInfo.contracts.receiver;
    } else {
        throw new Error("Receiver contract address not found in deployment file");
    }

    console.log("Using contract addresses:");
    console.log("Sender:", senderAddress);
    console.log("Receiver:", receiverAddress);

    
    const sender = await ethers.getContractAt("contracts/Sender.sol:Sender", senderAddress);
    const receiver = await ethers.getContractAt("contracts/Receiver.sol:Receiver", receiverAddress);

    console.log("Contract addresses:");
    console.log("Sender:", sender.address);
    console.log("Receiver:", receiver.address);
    console.log("Remote Chain ID:", deploymentInfo.bridgeSetup.remoteLzChainId);

   
    const balance = await ethers.provider.getBalance(deployer.address);
    console.log("Account balance:", ethers.utils.formatEther(balance), "ETH");

   
    const remoteChainId = deploymentInfo.bridgeSetup.remoteLzChainId;
    const chainNameMap = { 10161: "sepolia", 4442: "tan" };
    const currentChainName = chainNameMap[network.chainId] || filenameNetworkName;
    const testMessageString = `Hello ${chainNameMap[remoteChainId] || "unknown"} from ${currentChainName} at ${new Date().toISOString()}`;

    const testMessage = ethers.utils.toUtf8Bytes(testMessageString);
    console.log("Test message:", testMessageString);

  
    try {
        console.log("Getting quote for cross-chain message...");
        // const quote = await sender.quote(remoteChainId, testMessage, false);
        // console.log("Estimated fee:", ethers.utils.formatEther(quote), "ETH");
    } catch {
        console.log("Quote not available, using default fee");
    }

   
    console.log("Sending test message...");
    const tx = await sender.sendMessage(
        remoteChainId,
        testMessage,
        {
            value: ethers.utils.parseEther("0.001"),
            ...(gasPrice ? { gasPrice } : {})
        }
    );

    console.log("Transaction sent:", tx.hash);
    const receipt = await tx.wait();
    console.log("Transaction confirmed in block:", receipt.blockNumber);
    console.log("Gas used:", receipt.gasUsed.toString());

   
    console.log("\n=== Transaction Events ===");
    const events = receipt.events || [];
    console.log(`Found ${events.length} events:`);
    events.forEach((event, i) => {
        console.log(`\nEvent ${i}:`);
        console.log("  Contract:", event.address);
        console.log("  Event Name:", event.event || "Unknown");
        console.log("  Topics:", event.topics);
        if (event.args && event.args.length > 0) {
            console.log("  Args:");
            event.args.forEach((arg, j) => {
                console.log(`    [${j}]:`, arg.toString());
            });
        }
        if (event.data && event.data !== "0x") {
            console.log("  Data:", event.data);
        }
    });

    const messageSentEvents = events.filter(e => e.event === "MessageSent" || e.event === "SendMessage");
    if (messageSentEvents.length > 0) {
        console.log("\n🚀 Message sent successfully!");
        messageSentEvents.forEach((event, i) => {
            console.log(`SendMessage Event ${i}:`, event.args);
        });
    }

   
    console.log("=== Full Receipt ===");
    console.log("Status:", receipt.status === 1 ? "SUCCESS" : "FAILED");
    console.log("Block Number:", receipt.blockNumber);
    console.log("Transaction Hash:", receipt.transactionHash);
    console.log("From:", receipt.from);
    console.log("To:", receipt.to);

    
    try {
        console.log("\n=== Checking Stored Messages ===");
        // const messageCount = await receiver.getMessageCount();
        // console.log("Messages received:", messageCount.toString());
    } catch {
        console.log("Could not read stored messages (method may not exist)");
    }

    console.log("✅ Test completed!");
    
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("\n❌ Error occurred:");
        console.error(error);
        process.exit(1);
    });