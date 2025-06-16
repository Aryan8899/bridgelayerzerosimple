const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Testing bridge with account:", deployer.address);

    const network = await ethers.provider.getNetwork();
    console.log("Current network:", network.name, "Chain ID:", network.chainId);

    let filenameNetworkName, gasPrice;
    if (network.chainId.toString() === "4442") {
        filenameNetworkName = "tan";
        gasPrice = ethers.utils.parseUnits("20", "gwei");
    } else {
        filenameNetworkName = network.name || network.chainId.toString();
        gasPrice = undefined;
    }

    const deploymentFileName = `deployments/endpoint-${filenameNetworkName}.json`;
    if (!fs.existsSync(deploymentFileName)) {
        throw new Error(`Deployment file ${deploymentFileName} not found.`);
    }

    const deploymentInfo = JSON.parse(fs.readFileSync(deploymentFileName, "utf8"));
    if (!deploymentInfo.bridgeSetup?.setupComplete) {
        throw new Error("Bridge setup not complete. Run setup-bridge.js first.");
    }

    const senderAddress = deploymentInfo.contracts?.sender;
    const receiverAddress = deploymentInfo.contracts?.receiver;
    const wtanAddress = deploymentInfo.contracts?.wtan;

    if (!senderAddress || !receiverAddress || !wtanAddress) {
        throw new Error("Missing sender/receiver/wtan address in deployment info.");
    }

    console.log("Using contract addresses:");
    console.log("Sender:", senderAddress);
    console.log("Receiver:", receiverAddress);
    console.log("WTAN:", wtanAddress);

    const sender = await ethers.getContractAt("contracts/Sender.sol:Sender", senderAddress);
    const receiver = await ethers.getContractAt("contracts/Receiver.sol:Receiver", receiverAddress);
    const wtan = await ethers.getContractAt("WTAN", wtanAddress);

    const remoteChainId = deploymentInfo.bridgeSetup.remoteLzChainId;
    const chainNameMap = { 10161: "sepolia", 4442: "tan" };
    const currentChainName = chainNameMap[network.chainId] || filenameNetworkName;

    const balance = await ethers.provider.getBalance(deployer.address);
    console.log("Deployer Balance:", ethers.utils.formatEther(balance), "ETH");

    const useNative = network.chainId.toString() === "4442"; // TAN → Sepolia: native → WTAN mint

    if (useNative) {
        console.log("⛽ Sending native TAN to Sepolia → WTAN mint...");

        const tx = await sender.sendNativeToRemote(remoteChainId, {
            value: ethers.utils.parseEther("0.001"),
            ...(gasPrice ? { gasPrice } : {})
        });

        console.log("✅ TX Sent:", tx.hash);
        const receipt = await tx.wait();
        console.log("📦 Confirmed in block:", receipt.blockNumber);
        console.log("⛽ Gas used:", receipt.gasUsed.toString());
        logEvents(receipt.events);

    } else {
        const amount = ethers.utils.parseUnits("0.001", 18); // 0.001 WTAN
        const currentWtanBalance = await wtan.balanceOf(deployer.address);

        console.log("Current WTAN balance:", ethers.utils.formatEther(currentWtanBalance), "WTAN");

        if (currentWtanBalance.lt(amount)) {
            console.log("⚠️ WTAN balance low. Need to mint for testing...");
            
            // Check the current receiver
            const currentReceiver = await wtan.receiver();
            console.log("WTAN receiver is set to:", currentReceiver);
            console.log("Receiver contract address:", receiverAddress);
            console.log("Deployer address:", deployer.address);
            
            if (currentReceiver === ethers.constants.AddressZero) {
                throw new Error("WTAN receiver not set. This should have been set during deployment.");
            }
            
            // The receiver should be the Receiver contract, not the deployer
            if (currentReceiver !== receiverAddress) {
                throw new Error(`WTAN receiver is set to ${currentReceiver}, but expected ${receiverAddress}`);
            }
            
            console.log("\n❗ Cannot mint WTAN directly on live networks.");
            console.log("💡 To get WTAN tokens for testing, you need to:");
            console.log("1. Bridge native TAN from TAN network to Sepolia");
            console.log("2. Or wait for cross-chain transactions to complete");
            console.log("\n🔄 Let's check if any WTAN was minted from the TAN->Sepolia bridge...");
            
            // Check recent WTAN balance again (in case cross-chain tx completed)
            await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
            const updatedBalance = await wtan.balanceOf(deployer.address);
            console.log("Updated WTAN balance:", ethers.utils.formatEther(updatedBalance), "WTAN");
            
            if (updatedBalance.lt(amount)) {
                console.log("\n⚠️ Still insufficient WTAN balance.");
                console.log("🚀 Suggestion: Run the bridge from TAN network first:");
                console.log("   npx hardhat run scripts/05_test-bridge.js --network tan");
                console.log("   Then wait a few minutes and run this script again.");
                
                // For demonstration, let's use a smaller amount if we have some WTAN
                if (updatedBalance.gt(0)) {
                    const smallerAmount = updatedBalance.div(2); // Use half of available balance
                    if (smallerAmount.gt(0)) {
                        console.log(`\n🔄 Using available balance: ${ethers.utils.formatEther(smallerAmount)} WTAN`);
                        // Update amount to use available balance
                        amount = smallerAmount;
                    } else {
                        throw new Error("No WTAN available for testing. Bridge from TAN network first.");
                    }
                } else {
                    throw new Error("No WTAN available for testing. Bridge from TAN network first.");
                }
            }
        }

        console.log("🔐 Approving WTAN...");
        const approveTx = await wtan.approve(sender.address, amount, {
            ...(gasPrice ? { gasPrice } : {})
        });
        await approveTx.wait();
        console.log("✅ Approved");

        console.log("🚀 Sending WTAN to TAN → Unwrap to native...");
        const tx = await sender.bridgeWTANTo(remoteChainId, amount, {
            ...(gasPrice ? { gasPrice } : {})
        });

        console.log("✅ TX Sent:", tx.hash);
        const receipt = await tx.wait();
        console.log("📦 Confirmed in block:", receipt.blockNumber);
        console.log("⛽ Gas used:", receipt.gasUsed.toString());
        logEvents(receipt.events);
    }

    console.log("✅ Bridge test complete.");
}

function logEvents(events = []) {
    console.log("\n=== Events ===");
    if (!events.length) {
        console.log("No events found.");
        return;
    }

    events.forEach((e, i) => {
        console.log(`\nEvent ${i + 1}:`);
        console.log("📍 Contract:", e.address);
        console.log("📛 Name:", e.event || "Unknown");
        if (e.args) {
            Object.entries(e.args).forEach(([key, val]) => {
                if (!isNaN(key)) return;
                console.log(`  ${key}: ${val.toString()}`);
            });
        }
    });
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("\n❌ Error occurred:");
        console.error(error);
        process.exit(1);
    });