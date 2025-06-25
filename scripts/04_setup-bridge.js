const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("🔧 Setting up bridge connection with account:", deployer.address);

    const network = await ethers.provider.getNetwork();
    const chainId = network.chainId;
    console.log("🌐 Current network:", network.name, "Chain ID:", chainId);

    let filenameNetworkName;
    if (chainId === 4442) {
        filenameNetworkName = "tan";
    } else if (chainId === 11155111) {
        filenameNetworkName = "sepolia";
    } else {
        throw new Error("Unsupported network");
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
                return { gasPrice: feeData.gasPrice.mul(120).div(100) };
            } else {
                return { gasPrice: ethers.utils.parseUnits("50", "gwei") };
            }
        } catch (err) {
            console.warn("Gas price error:", err.message);
            return { gasPrice: ethers.utils.parseUnits("50", "gwei") };
        }
    };

    const gasOptions = await getGasPrice();

    const localPath = `deployments/endpoint-${filenameNetworkName}.json`;
    if (!fs.existsSync(localPath)) throw new Error(`Missing local deployment file: ${localPath}`);
    const localDeployment = JSON.parse(fs.readFileSync(localPath, "utf8"));

    const senderAddress = localDeployment.contracts?.sender;
    const wtanAddress = localDeployment.contracts?.wtan;

    if (!senderAddress || !wtanAddress) throw new Error("Missing sender or WTAN address in local deployment.");

    let remoteNetwork, remotePath, remoteLzChainId;
    if (chainId === 11155111) {
        remoteNetwork = "tan";
        remotePath = `deployments/endpoint-tan.json`;
        remoteLzChainId = 4442;
    } else {
        remoteNetwork = "sepolia";
        remotePath = `deployments/endpoint-sepolia.json`;
        remoteLzChainId = 10161;
    }

    if (!fs.existsSync(remotePath)) {
        console.warn(`❌ Remote deployment not found: ${remotePath}`);
        localDeployment.bridgeSetup = {
            remoteNetwork,
            remoteLzChainId,
            remotePath,
            instructions: [
                "1. Deploy contracts on remote network.",
                "2. Rerun this script after receiver is deployed."
            ]
        };
        fs.writeFileSync(localPath, JSON.stringify(localDeployment, null, 2));
        return;
    }

    const remoteDeployment = JSON.parse(fs.readFileSync(remotePath, "utf8"));
    const remoteReceiver = remoteDeployment.contracts?.receiver;
    const remoteWTAN = remoteDeployment.contracts?.wtan;

    if (!remoteReceiver || !remoteWTAN) throw new Error("Remote deployment missing receiver or WTAN address.");

    const sender = await ethers.getContractAt("contracts/Sender.sol:Sender", senderAddress);

    async function executeWithRetry(fn, label, retries = 3) {
        for (let i = 0; i < retries; i++) {
            try {
                console.log(`${label} (attempt ${i + 1}/${retries})`);
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

    localDeployment.bridgeSetup = {
        setupComplete: true,
        remoteNetwork,
        remoteLzChainId,
        remoteReceiver,
        remoteWTAN,
        setupTimestamp: new Date().toISOString(),
        gasOptionsUsed: gasOptions
    };

    fs.writeFileSync(localPath, JSON.stringify(localDeployment, null, 2));

    console.log("🎉 Bridge setup complete");
    console.log("🔗 Sender:", senderAddress);
    console.log("📥 Receiver:", remoteReceiver);
    console.log("🪙 WTAN (local):", wtanAddress);
    console.log("🪙 WTAN (remote):", remoteWTAN);
    console.log("🌐 Remote:", remoteNetwork);
}

main()
    .then(() => process.exit(0))
    .catch(err => {
        console.error("❌ Setup error:", err);
        process.exit(1);
    });
