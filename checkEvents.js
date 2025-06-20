const { ethers } = require("ethers");
require("dotenv").config();

async function main() {
    const provider = new ethers.providers.JsonRpcProvider("https://tan-devnetrpc2.tan.live");

    const endpointABI = require("./abis/Endpoint.json").abi;
    const endpoint = new ethers.Contract("0x412bD51F397b951214E04021a2352d8AdB7c3B1B", endpointABI, provider);

    const txHash = "0x88a7ff3445bf7b0217d875c500c2a1caffe86dd9714bee78c2b106aaeeb59c1c"; // Replace if needed

    const receipt = await provider.getTransactionReceipt(txHash);
    if (!receipt) {
        console.error("❌ Transaction receipt not found");
        return;
    }

    console.log("📦 Raw Logs:", receipt.logs.length);

    const parsed = receipt.logs.map(log => {
        try {
            return endpoint.interface.parseLog(log);
        } catch {
            return null;
        }
    }).filter(Boolean);

    if (parsed.length === 0) {
        console.log("❌ No logs matched Endpoint ABI");
    } else {
        console.log("✅ Parsed Logs:");
        for (const e of parsed) {
            console.log(`🧠 Event: ${e.name}`);
            console.log(e.args);
        }
    }
}

main().catch(console.error);
