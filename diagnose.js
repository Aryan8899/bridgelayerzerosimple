const { ethers } = require("ethers");
const fs = require("fs");
require("dotenv").config();

async function diagnoseSystem() {
  const SRC_RPC = "https://tan-devnetrpc2.tan.live";
  const DST_RPC = "https://eth-sepolia.g.alchemy.com/v2/B7X9gRjxfPZ9uOYogYWOy";
  const PRIVATE_KEY = process.env.PRIVATE_KEY;
  
  const srcProvider = new ethers.providers.JsonRpcProvider(SRC_RPC);
  const dstProvider = new ethers.providers.JsonRpcProvider(DST_RPC);
  const wallet = new ethers.Wallet(PRIVATE_KEY, dstProvider);
  
  console.log("🔍 Enhanced System Diagnosis");
  console.log("=" .repeat(50));
  
  // Load deployment data
  const sepData = JSON.parse(fs.readFileSync("deployments/endpoint-sepolia.json"));
  const ulnAddress = sepData.contracts.uln;
  
  console.log("📋 Your Wallet Address:", await wallet.getAddress());
  console.log("📋 ULN Address:", ulnAddress);
  
  // Test different function signatures to see what exists
  const testFunctions = [
    { name: "oracle", sig: "0x9a8a0592" },
    { name: "chainId", sig: "0x9a8a0592" }, // This might be wrong
    { name: "owner", sig: "0x8da5cb5b" },
    { name: "admin", sig: "0xf851a440" },
    { name: "getOracle", sig: "0x833b1fce" },
  ];
  
  console.log("\n🧪 Testing Contract Functions:");
  for (const func of testFunctions) {
    try {
      const result = await dstProvider.call({
        to: ulnAddress,
        data: func.sig
      });
      console.log(`✅ ${func.name}(): ${result}`);
      
      // If it's an address, decode it
      if (result.length === 66) { // 0x + 64 chars = address
        const addr = ethers.utils.getAddress("0x" + result.slice(-40));
        console.log(`   Decoded address: ${addr}`);
      }
    } catch (error) {
      console.log(`❌ ${func.name}(): REVERTED`);
    }
  }
  
  // Check if we can call submitBlock (this will tell us about access control)
  console.log("\n🧪 Testing Oracle Functions:");
  
  const ULN_ABI = [
    "function submitBlock(uint16 srcChainId, uint64 blockNumber, bytes32 blockHash, uint64 timestamp) external",
    "function setOracle(address _oracle) external",
    "function initialize(address _oracle) external",
  ];
  
  const uln = new ethers.Contract(ulnAddress, ULN_ABI, wallet);
  
  // Test if we can call submitBlock
  try {
    // Get latest block from source
    const latestBlock = await srcProvider.getBlock("latest");
    
    // Try to estimate gas for submitBlock (this will fail if not authorized)
    const gasEstimate = await uln.estimateGas.submitBlock(
      4442,
      latestBlock.number,
      latestBlock.hash,
      latestBlock.timestamp
    );
    console.log("✅ submitBlock gas estimate:", gasEstimate.toString());
    console.log("✅ You are authorized to submit blocks!");
  } catch (error) {
    console.log("❌ submitBlock failed:", error.reason || error.message);
    if (error.message.includes("not authorized") || error.message.includes("Ownable")) {
      console.log("💡 You are not the authorized oracle");
    }
  }
  
  // Check if setOracle function exists
  try {
    const gasEstimate = await uln.estimateGas.setOracle(await wallet.getAddress());
    console.log("✅ setOracle function exists, gas estimate:", gasEstimate.toString());
    console.log("💡 You can set yourself as oracle using setOracle()");
  } catch (error) {
    console.log("❌ setOracle failed:", error.reason || error.message);
  }
  
  // Check if initialize function exists
  try {
    const gasEstimate = await uln.estimateGas.initialize(await wallet.getAddress());
    console.log("✅ initialize function exists, gas estimate:", gasEstimate.toString());
    console.log("💡 Contract might need initialization");
  } catch (error) {
    console.log("❌ initialize failed:", error.reason || error.message);
  }
  
  // Check contract bytecode to understand what functions exist
  console.log("\n🔍 Contract Analysis:");
  const bytecode = await dstProvider.getCode(ulnAddress);
  console.log("Contract size:", bytecode.length, "bytes");
  
  // Look for common function selectors in bytecode
  const commonSelectors = {
    "8da5cb5b": "owner()",
    "f851a440": "admin()", 
    "9a8a0592": "oracle()",
    "3659cfe6": "setOracle(address)",
    "c4d66de8": "initialize(address)",
    "715018a6": "renounceOwnership()",
    "f2fde38b": "transferOwnership(address)"
  };
  
  console.log("Function selectors found:");
  for (const [selector, funcName] of Object.entries(commonSelectors)) {
    if (bytecode.includes(selector)) {
      console.log(`✅ ${funcName} - selector: 0x${selector}`);
    }
  }
}

diagnoseSystem().catch(console.error);