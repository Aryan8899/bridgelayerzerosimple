const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Setting up bridge connection with account:", deployer.address);

    const network = await ethers.provider.getNetwork();
    console.log("Current network:", network.name, "Chain ID:", network.chainId);

    let filenameNetworkName;
    if (network.chainId.toString() === "4442") {
        filenameNetworkName = "tan";
    } else if (network.chainId.toString() === "11155111") {
        filenameNetworkName = "sepolia";
    } else {
        filenameNetworkName = network.name || network.chainId.toString();
    }

    const getGasPrice = async () => {
        try {
            const feeData = await ethers.provider.getFeeData();
            if (feeData.maxFeePerGas) {
                return {
                    maxFeePerGas: feeData.maxFeePerGas.mul(120).div(100),
                    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas?.mul(110).div(100) || ethers.utils.parseUnits("2", "gwei")
                };
            } else if (feeData.gasPrice) {
                return {
                    gasPrice: feeData.gasPrice.mul(120).div(100)
                };
            } else {
                return {
                    gasPrice: ethers.utils.parseUnits("50", "gwei")
                };
            }
        } catch (e) {
            console.warn("Error fetching gas price:", e.message);
            return {
                gasPrice: ethers.utils.parseUnits("50", "gwei")
            };
        }
    };

    const gasOptions = await getGasPrice();

    const currentFile = `deployments/endpoint-${filenameNetworkName}.json`;
    if (!fs.existsSync(currentFile)) throw new Error(`Missing local deployment file: ${currentFile}`);

    const currentDeployment = JSON.parse(fs.readFileSync(currentFile, "utf8"));
    const senderAddress = currentDeployment.contracts?.sender;
    const wtanAddress = currentDeployment.contracts?.wtan;

    if (!senderAddress) throw new Error("Sender address missing in local deployment file.");
    if (!wtanAddress) throw new Error("WTAN address missing in local deployment file.");

    let remoteNetwork, remoteFile, remoteLzChainId;
    if (network.chainId === 11155111) {
        remoteNetwork = "tan";
        remoteFile = `deployments/endpoint-tan.json`;
        remoteLzChainId = 4442;
    } else {
        remoteNetwork = "sepolia";
        remoteFile = `deployments/endpoint-sepolia.json`;
        remoteLzChainId = 10161;
    }

    if (!fs.existsSync(remoteFile)) {
        console.warn(`❌ Remote deployment not found: ${remoteFile}`);
        currentDeployment.bridgeSetup = {
            remoteNetwork,
            remoteLzChainId,
            remoteFile,
            instructions: [
                "1. Deploy all contracts on the remote network.",
                "2. Ensure receiver is deployed and saved in deployment file.",
                "3. Rerun this setup script."
            ]
        };
        fs.writeFileSync(currentFile, JSON.stringify(currentDeployment, null, 2));
        return;
    }

    const remoteDeployment = JSON.parse(fs.readFileSync(remoteFile, "utf8"));
    const remoteReceiver = remoteDeployment.contracts?.receiver;
    const remoteWTAN = remoteDeployment.contracts?.wtan;

    if (!remoteReceiver) throw new Error("Remote receiver address not found.");
    if (!remoteWTAN) throw new Error("Remote WTAN address missing.");

    const sender = await ethers.getContractAt("contracts/Sender.sol:Sender", senderAddress);

    async function executeWithRetry(fn, label, retries = 3) {
        for (let i = 0; i < retries; i++) {
            try {
                console.log(`${label} (attempt ${i + 1})`);
                const tx = await fn();
                await tx.wait();
                console.log(`✅ ${label} successful`);
                return;
            } catch (err) {
                console.warn(`❌ ${label} failed: ${err.message}`);
                if (i === retries - 1) throw err;
                await new Promise(r => setTimeout(r, 2000));
                Object.assign(gasOptions, await getGasPrice());
            }
        }
    }

    await executeWithRetry(
        () => sender.setRemote(remoteLzChainId, remoteReceiver, gasOptions),
        "Setting remote receiver"
    );

    currentDeployment.bridgeSetup = {
        setupComplete: true,
        remoteNetwork,
        remoteLzChainId,
        remoteReceiver,
        remoteWTAN,
        setupTimestamp: new Date().toISOString(),
        gasOptionsUsed: gasOptions
    };

    fs.writeFileSync(currentFile, JSON.stringify(currentDeployment, null, 2));

    console.log("🎉 Bridge setup complete.");
    console.log("🔗 Local sender:", senderAddress);
    console.log("📥 Remote receiver:", remoteReceiver);
    console.log("🪙 WTAN (local):", wtanAddress);
    console.log("🪙 WTAN (remote):", remoteWTAN);
    console.log("🌐 Bridged to:", remoteNetwork);
}

main()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error("❌ Error in setup:", err);
        process.exit(1);
    });
