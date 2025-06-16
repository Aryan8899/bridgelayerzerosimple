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
       // logEvents(receipt.events);

    } else {
        const amount = ethers.utils.parseUnits("0.001", 18); // 0.001 WTAN
        const currentWtanBalance = await wtan.balanceOf(deployer.address);

        if (currentWtanBalance.lt(amount)) {
            const currentWtanBalance = (await wtan.balanceOf(deployer.address)).toString();
            console.log("balance is",currentWtanBalance)
            console.log("⚠️ WTAN balance low. Minting for testing...");
            //const currentWtanBalance = await wtan.balanceOf(deployer.address);
          //  const mintTx = await wtan.mint(deployer.address, amount);
           // await mintTx.wait();
            console.log("✅ Minted WTAN:", amount.toString());
        }

        console.log("🔐 Approving WTAN...");
        const approveTx = await wtan.approve(sender.address, amount);
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
       // logEvents(receipt.events);
    }

    console.log("✅ Bridge test complete.");
}

// function logEvents(events = []) {
//     console.log("\n=== Events ===");
//     if (!events.length) {
//         console.log("No events found.");
//         return;
//     }

//     events.forEach((e, i) => {
//         console.log(`\nEvent ${i + 1}:`);
//         console.log("📍 Contract:", e.address);
//         console.log("📛 Name:", e.event || "Unknown");
//         if (e.args) {
//             Object.entries(e.args).forEach(([key, val]) => {
//                 if (!isNaN(key)) return;
//                 console.log(`  ${key}: ${val.toString()}`);
//             });
//         }
//     });
// }

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("\n❌ Error occurred:");
        console.error(error);
        process.exit(1);
    });
