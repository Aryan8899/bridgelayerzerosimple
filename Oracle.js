const { ethers } = require("ethers");
const fs = require("fs");
require("dotenv").config();

// --- ENV & CONFIG ---
const SRC_RPC = "https://tan-devnetrpc2.tan.live";
const DST_RPC = "https://eth-sepolia.g.alchemy.com/v2/B7X9gRjxfPZ9uOYogYWOy";
const PRIVATE_KEY = process.env.PRIVATE_KEY;

const tanData = JSON.parse(fs.readFileSync("deployments/endpoint-tan.json"));
const sepData = JSON.parse(fs.readFileSync("deployments/endpoint-sepolia.json"));

const endpointDstAddr = sepData.contracts.endpoint;
const senderAddr = tanData.contracts.sender;

// --- ULN ABI ---
const ULN_ABI = [
  "function submitBlock(uint16 srcChainId, uint64 blockNumber, bytes32 blockHash, uint64 timestamp) external",
 
];

async function main() {
  const srcProvider = new ethers.providers.JsonRpcProvider(SRC_RPC);
  const dstProvider = new ethers.providers.JsonRpcProvider(DST_RPC);
  const signer = new ethers.Wallet(PRIVATE_KEY, dstProvider);
  const ulnAddress = sepData.contracts.uln; // 0x1406dC024F2f5e542b185f5639f12b8d32B725B5
  const uln = new ethers.Contract(ulnAddress, ULN_ABI, signer);

  console.log("📡 Oracle Bot Started");
  console.log("🔗 TAN Sender:", senderAddr);
  console.log("🎯 ULN on Sepolia:", endpointDstAddr);

  // 🔐 Check Oracle authorization
//   const onchainOracle = await uln.oracle();
  //const signerAddr = await signer.getAddress();
//   if (onchainOracle.toLowerCase() !== signerAddr.toLowerCase()) {
//     console.error("❌ Signer is not the authorized oracle");
//     console.error("ULN Oracle:", onchainOracle);
//     console.error("Your Wallet:", signerAddr);
//     process.exit(1);
//   } else {
//     console.log("✅ Authorized oracle:", signerAddr);
//   }

  let lastSubmitted = 0;

  while (true) {
    const latestBlock = await srcProvider.getBlock("latest");
    if (latestBlock.number <= lastSubmitted) {
      await sleep(6000);
      continue;
    }

    try {
      const blockNumber = BigInt(latestBlock.number);     // fits uint64
      const timestamp = BigInt(latestBlock.timestamp);     // fits uint64
      const blockHash = latestBlock.hash;

      const tx = await uln.submitBlock(
        4442,
        blockNumber,
        blockHash,
        timestamp,
        { gasLimit: 500000 }
      );

      console.log(`✅ Submitted block ${blockNumber}: ${tx.hash}`);
      lastSubmitted = latestBlock.number;
    } catch (err) {
      console.error("❌ Submission failed:", err.reason || err.message);
    }

    await sleep(12000);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((e) => {
  console.error("Fatal Oracle Error:", e);
});
