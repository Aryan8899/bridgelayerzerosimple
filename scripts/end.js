const { ethers } = require("hardhat");

async function main() {
  const signer = (await ethers.getSigners())[0];
  console.log("🔑 Using account:", signer.address);

  const uln = await ethers.getContractAt(
    "UltraLightNode",
    "0xE6B00376c5Bd4F4941d9cCed15b7Bb541EC29344",
    signer
  );

  // Original problematic hash (33 bytes)
  const originalHash = "0x0f89ee1f0f41b87dbd7382fdd912c0162a448df766444b4c0c938cd401ad336278";
  
  // Option 1: Remove last 2 characters (1 byte)
  const fixedHash1 = "0x0f89ee1f0f41b87dbd7382fdd912c0162a448df766444b4c0c938cd401ad3362";
  
  // Option 2: Remove first 2 characters after 0x (1 byte from start)
  const fixedHash2 = "0x89ee1f0f41b87dbd7382fdd912c0162a448df766444b4c0c938cd401ad336278";
  
  // Option 3: Use ethers utility to ensure proper 32-byte format
  const fixedHash3 = ethers.utils.hexZeroPad(
    "0x0f89ee1f0f41b87dbd7382fdd912c0162a448df766444b4c0c938cd401ad3362", 
    32
  );

  console.log("🔍 Original hash:", originalHash);
  console.log("🔍 Original length:", originalHash.length);
  
  const hashOptions = [
    { name: "Fixed Hash 1 (remove end)", hash: fixedHash1 },
    { name: "Fixed Hash 2 (remove start)", hash: fixedHash2 },
    { name: "Fixed Hash 3 (zero-padded)", hash: fixedHash3 }
  ];

  // Parameters
  const oracle = "0x0000000000000000000000000000000000000000";
  const remoteChainId = 4442;

  for (const option of hashOptions) {
    try {
      console.log(`\n🔍 Testing ${option.name}...`);
      console.log(`Hash: ${option.hash}`);
      console.log(`Length: ${option.hash.length}`);
      console.log(`Bytes: ${ethers.utils.arrayify(option.hash).length}`);
      
      const result = await uln.getBlockHeaderData(
        oracle,
        remoteChainId,
        option.hash
      );

      console.log(`✅ Success with ${option.name}!`);
      console.log("Confirmations:", result.confirmations.toString());
      console.log("Data:", result.data);
      console.log("Timestamp:", result.timestamp.toString());
      
      // If successful, break out of loop
      break;

    } catch (error) {
      console.log(`❌ ${option.name} failed:`, error.message);
    }
  }

  // If all options fail, try to understand the original hash better
  console.log("\n🔬 Hash Analysis:");
  console.log("Original hex (without 0x):", originalHash.slice(2));
  console.log("Length without 0x:", originalHash.slice(2).length);
  console.log("Is valid hex?", /^[0-9a-fA-F]+$/.test(originalHash.slice(2)));
  
  // Try to create different valid 32-byte versions
  const hexWithout0x = originalHash.slice(2);
  
  // Method 1: Take first 64 characters (32 bytes)
  const method1 = "0x" + hexWithout0x.slice(0, 64);
  
  // Method 2: Take last 64 characters (32 bytes)  
  const method2 = "0x" + hexWithout0x.slice(-64);
  
  console.log("\n🧪 Additional Methods:");
  console.log("Method 1 (first 32 bytes):", method1);
  console.log("Method 2 (last 32 bytes):", method2);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });