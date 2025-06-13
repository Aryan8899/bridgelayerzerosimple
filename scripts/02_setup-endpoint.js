
const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("🔧 Setting up Endpoint with account:", deployer.address);

  const network = await ethers.provider.getNetwork();
  console.log("🌐 Current network:", network.name, "Chain ID:", network.chainId);

  let filenameNetworkName;
  if (network.chainId.toString() === "4442") {
    filenameNetworkName = "tan";
  } else if (network.chainId.toString() === "11155111") {
    filenameNetworkName = "sepolia";
  } else {
    filenameNetworkName = network.name || network.chainId.toString();
  }

  
  async function getGasPrice() {
    try {
      const feeData = await ethers.provider.getFeeData();
      console.log("Current fee data:", {
        gasPrice: feeData.gasPrice?.toString(),
        maxFeePerGas: feeData.maxFeePerGas?.toString(),
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas?.toString()
      });
      
      // For EIP-1559 networks, use maxFeePerGas with a buffer
      if (feeData.maxFeePerGas) {
        return {
          maxFeePerGas: feeData.maxFeePerGas.mul(120).div(100), // 20% buffer
          maxPriorityFeePerGas: feeData.maxPriorityFeePerGas?.mul(110).div(100) || ethers.utils.parseUnits("2", "gwei")
        };
      } else if (feeData.gasPrice) {
        // For legacy networks, use gasPrice with buffer
        return {
          gasPrice: feeData.gasPrice.mul(120).div(100) // 20% buffer
        };
      } else {
        // Fallback to higher gas price
        return {
          gasPrice: ethers.utils.parseUnits("50", "gwei")
        };
      }
    } catch (error) {
      console.log("Error getting fee data, using fallback gas price:", error.message);
      return {
        gasPrice: ethers.utils.parseUnits("50", "gwei")
      };
    }
  }

  const gasOptions = await getGasPrice();
  console.log("Using gas options:", gasOptions);

  // Load endpoint deployment data
  const deploymentFileName = `deployments/endpoint-${filenameNetworkName}.json`;
  if (!fs.existsSync(deploymentFileName)) {
    throw new Error(`Deployment file ${deploymentFileName} not found. Deploy endpoint first.`);
  }

  const deploymentInfo = JSON.parse(fs.readFileSync(deploymentFileName, "utf8"));
  console.log("📦 Loaded deployment info:", deploymentInfo);

  // Debug: Check if contract addresses exist
  console.log("🔍 Debugging contract addresses:");
  console.log("Contracts object:", deploymentInfo.contracts);
  console.log("Endpoint address:", deploymentInfo.contracts?.endpoint);
  console.log("Library address:", deploymentInfo.contracts?.library);


  if (!deploymentInfo.contracts || !deploymentInfo.contracts.endpoint) {
    throw new Error("Endpoint address not found in deployment info");
  }
  if (!deploymentInfo.contracts.library) {
    throw new Error("Library address not found in deployment info");
  }

  // Get contract instances with proper error handling
  let endpoint, library;
  try {
    endpoint = await ethers.getContractAt("Endpoint", deploymentInfo.contracts.endpoint);
    console.log("✅ Endpoint contract loaded at:", deploymentInfo.contracts.endpoint);
  } catch (error) {
    throw new Error(`Failed to load Endpoint contract: ${error.message}`);
  }

  try {
    library = await ethers.getContractAt("MockMessagingLibrary", deploymentInfo.contracts.library);
    console.log("✅ Library contract loaded at:", deploymentInfo.contracts.library);
  } catch (error) {
    throw new Error(`Failed to load Library contract: ${error.message}`);
  }

  console.log("📚 Setting up messaging library...");


  async function executeWithRetry(txFunction, description, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        console.log(`${description} (attempt ${i + 1}/${maxRetries})`);
        const tx = await txFunction();
        const receipt = await tx.wait();
        console.log(`✅ ${description} completed. Gas used: ${receipt.gasUsed.toString()}`);
        return receipt;
      } catch (error) {
        console.log(`❌ ${description} failed:`, error.message);
        if (i === maxRetries - 1) throw error;
        
       
        console.log("⏱️ Waiting 2 seconds before retry...");
        await new Promise(resolve => setTimeout(resolve, 2000));
        const newGasOptions = await getGasPrice();
        Object.assign(gasOptions, newGasOptions);
        console.log("🔄 Retrying with updated gas options:", newGasOptions);
      }
    }
  }

 
  await executeWithRetry(
    () => endpoint.newVersion(library.address, gasOptions),
    "Library version registration"
  );

  const latestVersion = await endpoint.latestVersion();
  console.log("🔢 Latest version is:", latestVersion.toString());

 
  await executeWithRetry(
    () => endpoint.setDefaultSendVersion(latestVersion, gasOptions),
    "Setting default send version"
  );


  await executeWithRetry(
    () => endpoint.setDefaultReceiveVersion(latestVersion, gasOptions),
    "Setting default receive version"
  );

  
  deploymentInfo.setupComplete = true;
  deploymentInfo.libraryVersion = latestVersion.toString();
  deploymentInfo.setupTimestamp = new Date().toISOString();
  deploymentInfo.gasOptionsUsed = gasOptions;
  
  try {
    fs.writeFileSync(deploymentFileName, JSON.stringify(deploymentInfo, null, 2));
    console.log(`✅ Updated deployment info saved to ${deploymentFileName}`);
  } catch (error) {
    console.log("⚠️ Warning: Could not save updated deployment info:", error.message);
  }

  console.log("\n🎉 Endpoint setup completed successfully!");
  console.log("📍 Contract addresses:");
  console.log("  Endpoint:", endpoint.address);
  console.log("  Library:", library.address);
  console.log("  Version:", latestVersion.toString());
  console.log("🌐 Network:", network.name, "Chain ID:", network.chainId);
}

main().catch((err) => {
  console.error("❌ Error during setup:", err);
  process.exit(1);
});