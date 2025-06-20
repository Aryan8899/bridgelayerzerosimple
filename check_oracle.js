const { ethers } = require("ethers");
const fs = require("fs");
require("dotenv").config();

async function checkOracleStatus() {
  const DST_RPC = "https://eth-sepolia.g.alchemy.com/v2/B7X9gRjxfPZ9uOYogYWOy";
  const provider = new ethers.providers.JsonRpcProvider(DST_RPC);
  
  const sepData = JSON.parse(fs.readFileSync("deployments/endpoint-sepolia.json"));
  const ulnAddress = sepData.contracts.uln;
  
  // ULN ABI with block checking functions
  const ULN_ABI = [
    "function submittedBlocks(bytes32) view returns (uint64)",
    "function oracle() view returns (address)",
    "function chainId() view returns (uint16)"
  ];
  
  const uln = new ethers.Contract(ulnAddress, ULN_ABI, provider);
  
  console.log("🔍 Checking Oracle Status...");
  console.log("ULN Address:", ulnAddress);
  
  try {
    // Check oracle address
    const oracleAddr = await uln.oracle();
    console.log("👤 Oracle Address:", oracleAddr);
    
    // Check chain ID
    const chainId = await uln.chainId();
    console.log("🔗 ULN Chain ID:", chainId.toString());
    
    // Check a specific block hash (from your error log)
    const blockHash = "0xbc3afcd3dc82e0c428dd8d1d7d041996ec46e6d17c27e6f3755bd0b3e5c3e9d6";
    const blockTimestamp = await uln.submittedBlocks(blockHash);
    
    console.log("📦 Block Hash:", blockHash);
    console.log("⏰ Block Timestamp:", blockTimestamp.toString());
    
    if (blockTimestamp.eq(0)) {
      console.log("❌ Block NOT submitted to ULN - Oracle needs to submit it first");
      console.log("💡 Make sure your Oracle bot is running and submitting blocks");
    } else {
      console.log("✅ Block is submitted to ULN");
    }
    
  } catch (error) {
    console.error("❌ Error checking oracle status:", error.message);
  }
}

checkOracleStatus().catch(console.error);