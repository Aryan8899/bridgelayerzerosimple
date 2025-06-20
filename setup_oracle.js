const { ethers } = require("ethers");
const fs = require("fs");
require("dotenv").config();

async function setupOracle() {
  const DST_RPC = "https://eth-sepolia.g.alchemy.com/v2/B7X9gRjxfPZ9uOYogYWOy";
  const PRIVATE_KEY = process.env.PRIVATE_KEY;
  
  const dstProvider = new ethers.providers.JsonRpcProvider(DST_RPC);
  const wallet = new ethers.Wallet(PRIVATE_KEY, dstProvider);
  
  const sepData = JSON.parse(fs.readFileSync("deployments/endpoint-sepolia.json"));
  const ulnAddress = sepData.contracts.uln;
  
  console.log("🔧 Setting up Oracle...");
  console.log("ULN Address:", ulnAddress);
  console.log("Your Address:", await wallet.getAddress());
  
  // Extended ABI with possible oracle setup functions
  const ULN_ABI = [
    "function setOracle(address _oracle) external",
    "function initialize(address _oracle) external", 
    "function initialize(address _oracle, address _admin) external",
    "function oracle() view returns (address)",
    "function owner() view returns (address)",
    "function admin() view returns (address)",
    "function submitBlock(uint16 srcChainId, uint64 blockNumber, bytes32 blockHash, uint64 timestamp) external"
  ];
  
  const uln = new ethers.Contract(ulnAddress, ULN_ABI, wallet);
  
  try {
    // First, try to check current oracle
    console.log("\n📋 Checking current state...");
    
    let currentOracle;
    try {
      currentOracle = await uln.oracle();
      console.log("Current Oracle:", currentOracle);
    } catch (e) {
      console.log("❌ Cannot read oracle address");
    }
    
    let owner;
    try {
      owner = await uln.owner();
      console.log("Contract Owner:", owner);
    } catch (e) {
      console.log("❌ Cannot read owner address");
    }
    
    const yourAddress = await wallet.getAddress();
    
    // If oracle is zero address, try to set it
    if (currentOracle === "0x0000000000000000000000000000000000000000") {
      console.log("\n🔧 Oracle not set, attempting to set...");
      
      // Try setOracle first
      try {
        console.log("Trying setOracle()...");
        const tx = await uln.setOracle(yourAddress, {
          gasLimit: 200000
        });
        console.log("Transaction hash:", tx.hash);
        await tx.wait();
        console.log("✅ Oracle set successfully!");
        return;
      } catch (error) {
        console.log("❌ setOracle failed:", error.reason || error.message);
      }
      
      // Try initialize with single parameter
      try {
        console.log("Trying initialize(address)...");
        const tx = await uln.initialize(yourAddress, {
          gasLimit: 200000
        });
        console.log("Transaction hash:", tx.hash);
        await tx.wait();
        console.log("✅ Contract initialized with oracle!");
        return;
      } catch (error) {
        console.log("❌ initialize(address) failed:", error.reason || error.message);
      }
      
      // Try initialize with two parameters
      try {
        console.log("Trying initialize(address, address)...");
        const tx = await uln["initialize(address,address)"](yourAddress, yourAddress, {
          gasLimit: 200000
        });
        console.log("Transaction hash:", tx.hash);
        await tx.wait();
        console.log("✅ Contract initialized with oracle and admin!");
        return;
      } catch (error) {
        console.log("❌ initialize(address,address) failed:", error.reason || error.message);
      }
      
    } else if (currentOracle === yourAddress) {
      console.log("✅ You are already the oracle!");
    } else {
      console.log("⚠️ Oracle is set to different address:", currentOracle);
      console.log("💡 You may need to use a different wallet or ask current oracle to transfer");
    }
    
  } catch (error) {
    console.error("❌ Setup failed:", error.message);
  }
  
  // Final verification
  console.log("\n🔍 Final verification...");
  try {
    const finalOracle = await uln.oracle();
    console.log("Final Oracle Address:", finalOracle);
    
    if (finalOracle === await wallet.getAddress()) {
      console.log("✅ SUCCESS: You are now the oracle!");
    } else if (finalOracle === "0x0000000000000000000000000000000000000000") {
      console.log("❌ Oracle still not set");
      console.log("💡 The contract may not have oracle setup functions");
      console.log("💡 You may need to redeploy with proper initialization");
    } else {
      console.log("⚠️ Oracle is set to:", finalOracle);
    }
  } catch (error) {
    console.log("❌ Cannot verify oracle status");
  }
}

setupOracle().catch(console.error);