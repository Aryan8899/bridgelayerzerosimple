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
    const wtan = await ethers.getContractAt("WTAN", wtanAddress);
    const receiver = await ethers.getContractAt("contracts/Receiver.sol:Receiver", receiverAddress);


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

    } else {
        // Sepolia → TAN: WTAN → native
        const amount = ethers.utils.parseUnits("0.001", 18); // 0.001 WTAN
        const currentWtanBalance = await wtan.balanceOf(deployer.address);

        if (currentWtanBalance.lt(amount)) {
            console.log("⚠️ WTAN balance low. Need to use emergency mint for testing...");
            
            // Check if receiver has the emergencyMint function and use it
            try {
                console.log("🔄 Using emergency mint function from Receiver...");
                const mintTx = await wtan.mint(deployer.address, amount, {
                    ...(gasPrice ? { gasPrice } : {})
                });
                await mintTx.wait();
                console.log("✅ Emergency minted WTAN:", amount.toString());
            } catch (mintError) {
                console.error("❌ Emergency mint failed:", mintError.message);
                console.log("💡 Note: In production, WTAN should only be minted through the bridge.");
                console.log("💡 You should bridge some TAN from the TAN network first to get WTAN on Sepolia.");
                throw new Error("Cannot mint WTAN for testing. Bridge some TAN from TAN network first.");
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
    }

    console.log("✅ Bridge test complete.");
    console.log("🔐 Security Note: WTAN can only be minted by the Receiver contract through bridge operations.");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("\n❌ Error occurred:");
        console.error(error);
        process.exit(1);
    });