// Fix 1: Update oracle.js to match the correct ULN method signature
// oracle.js
const { ethers } = require("ethers");
require("dotenv").config();
const ulnABI = require("./abis/UltraLightNode.json").abi;
const sepData = require("./deployments/endpoint-sepolia.json");

const DST_RPC = "https://eth-sepolia.g.alchemy.com/v2/B7X9gRjxfPZ9uOYogYWOy";
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const ulnAddress = sepData.contracts.uln;
const wallet = new ethers.Wallet(PRIVATE_KEY, new ethers.providers.JsonRpcProvider(DST_RPC));
const uln = new ethers.Contract(ulnAddress, ulnABI, wallet);

async function submitBlockHash(srcChainId, blockHash, blockNumber, confirmations) {
  try {
    console.log("🛰 Submitting block hash to ULN:");
    console.log("  - srcChainId:", srcChainId);
    console.log("  - blockHash:", blockHash);
    console.log("  - blockNumber:", blockNumber);
    console.log("  - confirmations:", confirmations);
    
    // Fix: Use correct parameter order - srcChainId first, then blockHash
    const tx = await uln.submitBlock(srcChainId, blockHash, blockNumber, confirmations, {
      gasLimit: 1_000_000
    });
    await tx.wait();
    console.log("✅ Block hash submitted");
  } catch (err) {
    console.error("❌ Oracle submitBlock error:", err.message);
    throw err; // Re-throw so the main function knows it failed
  }
}

module.exports = {
  submitBlockHash
};