const { ethers } = require("ethers");
const fs = require("fs");
require("dotenv").config();

async function verifyConfig() {
  const SRC_RPC = "https://tan-devnetrpc2.tan.live";
  const DST_RPC = "https://eth-sepolia.g.alchemy.com/v2/B7X9gRjxfPZ9uOYogYWOy";
  
  const srcProvider = new ethers.providers.JsonRpcProvider(SRC_RPC);
  const dstProvider = new ethers.providers.JsonRpcProvider(DST_RPC);
  
  console.log("🔍 Verifying Configuration...");
  
  // Check source chain
  const srcNetwork = await srcProvider.getNetwork();
  console.log("📡 Source Chain ID:", srcNetwork.chainId);
  console.log("📡 Source Chain Name:", srcNetwork.name);
  
  // Check destination chain  
  const dstNetwork = await dstProvider.getNetwork();
  console.log("🎯 Destination Chain ID:", dstNetwork.chainId);
  console.log("🎯 Destination Chain Name:", dstNetwork.name);
  
  // Load deployment data
  const tanData = JSON.parse(fs.readFileSync("deployments/endpoint-tan.json"));
  const sepData = JSON.parse(fs.readFileSync("deployments/endpoint-sepolia.json"));
  
  console.log("\n📋 Deployment Addresses:");
  console.log("Source Sender:", tanData.contracts.sender);
  console.log("Dest Endpoint:", sepData.contracts.endpoint);
  console.log("Dest ULN:", sepData.contracts.uln);
  console.log("Dest Receiver:", sepData.contracts.receiver);
  
  // Check if contracts exist
  console.log("\n🔍 Checking Contract Deployment...");
  
  const senderCode = await srcProvider.getCode(tanData.contracts.sender);
  console.log("Sender deployed:", senderCode !== "0x" ? "✅" : "❌");
  
  const ulnCode = await dstProvider.getCode(sepData.contracts.uln);
  console.log("ULN deployed:", ulnCode !== "0x" ? "✅" : "❌");
  
  const receiverCode = await dstProvider.getCode(sepData.contracts.receiver);
  console.log("Receiver deployed:", receiverCode !== "0x" ? "✅" : "❌");
  
  // Decode the chain ID from your log
  const hexChainId = "0x27b1";
  const decimalChainId = parseInt(hexChainId, 16);
  console.log("\n🔗 Chain ID from your log:");
  console.log("Hex:", hexChainId);
  console.log("Decimal:", decimalChainId);
  console.log("Matches source?", decimalChainId === srcNetwork.chainId ? "✅" : "❌");
}

verifyConfig().catch(console.error);