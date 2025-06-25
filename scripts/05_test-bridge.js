const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("🔍 Testing bridge with account:", deployer.address);

    const network = await ethers.provider.getNetwork();
    const chainId = network.chainId.toString();
    const isTan = chainId === "4442";
    const filename = `deployments/endpoint-${isTan ? "tan" : "sepolia"}.json`;
    const remoteLzChainId = isTan ? 10161 : 4442;

    if (!fs.existsSync(filename)) throw new Error(`Missing: ${filename}`);
    const deployment = JSON.parse(fs.readFileSync(filename, "utf8"));

    const sender = await ethers.getContractAt("contracts/Sender.sol:Sender", deployment.contracts.sender);
    const receiver = await ethers.getContractAt("contracts/Receiver.sol:Receiver", deployment.contracts.receiver);
    const wtan = await ethers.getContractAt("WTAN", deployment.contracts.wtan);

    const value = ethers.utils.parseEther("0.001");

    if (isTan) {
        console.log("➡️ Bridging native TAN → Sepolia (WTAN mint)");
        
        // Correct: sendNativeToRemote expects (chainId, amount) + transaction options
        const tx = await sender.sendNativeToRemote(remoteLzChainId, value, {
            value: value,
            gasPrice: ethers.utils.parseUnits("20", "gwei")
        });
        
        const receipt = await tx.wait();
        console.log("✅ Sent TAN → TX:", tx.hash, "Gas used:", receipt.gasUsed.toString());
    } else {
        console.log("🔓 Approving Sender to use WTAN...");
        const approveTx = await wtan.approve(sender.address, value);
        await approveTx.wait();

        console.log("➡️ Bridging WTAN → TAN (unwrap to native)");
        const tx = await sender.bridgeWTANTo(remoteLzChainId, value, {
            gasPrice: ethers.utils.parseUnits("20", "gwei")
        });
        const receipt = await tx.wait();
        console.log("✅ Sent WTAN → TX:", tx.hash, "Gas used:", receipt.gasUsed.toString());
    }

    console.log("🎉 Bridge test complete.");
}

main().catch((err) => {
    console.error("❌ Bridge test failed:", err);
    process.exit(1);
});