const fs = require("fs");
const { ethers } = require("hardhat");

async function setConfig() {
  const network = await ethers.provider.getNetwork();
  console.log("🌐 Current network:", network.name, "Chain ID:", network.chainId);

  // Get the signer
  const [signer] = await ethers.getSigners();
  console.log("📝 Using signer:", signer.address);

  let filenameNetworkName;
  if (network.chainId.toString() === "4442") {
    filenameNetworkName = "tan";
  } else if (network.chainId.toString() === "11155111") {
    filenameNetworkName = "sepolia";
  } else {
    filenameNetworkName = network.name || network.chainId.toString();
  }

  const deploymentFileName = `deployments/endpoint-${filenameNetworkName}.json`;

  // Check if deployment file exists
  if (!fs.existsSync(deploymentFileName)) {
    throw new Error(`Deployment file ${deploymentFileName} not found. Deploy endpoint first.`);
  }

  // Load deployment information
  const deploymentInfo = JSON.parse(fs.readFileSync(deploymentFileName, "utf8"));
  console.log("📦 Loaded deployment info:", deploymentInfo);

  // Debug: Check if contract addresses exist
  console.log("🔍 Debugging contract addresses:");
  console.log("Contracts object:", deploymentInfo.contracts);
  console.log("Endpoint address:", deploymentInfo.contracts?.endpoint);
  console.log("Oracle address:", deploymentInfo.contracts?.oracle);
  console.log("Relayer address:", deploymentInfo.contracts?.relayer);

  // Get the Endpoint contract
  const endpointAddress = deploymentInfo.contracts?.endpoint;
  if (!endpointAddress) {
    throw new Error("Endpoint contract address not found in deployment info.");
  }

  const endpoint = await ethers.getContractAt("Endpoint", endpointAddress);

  // Get the Oracle and Relayer addresses
  const oracleAddress = deploymentInfo.contracts?.oracle;
  const relayerAddress = deploymentInfo.contracts?.relayer;
  const ulnAddress = deploymentInfo.contracts?.uln;
  
  if (!oracleAddress || !relayerAddress) {
    throw new Error("Oracle or Relayer address is missing in deployment info.");
  }

  // Check if the signer is the owner of the endpoint contract
  try {
    const owner = await endpoint.owner();
    console.log("📋 Endpoint contract owner:", owner);
    console.log("📋 Current signer:", signer.address);
    if (owner.toLowerCase() !== signer.address.toLowerCase()) {
      console.warn("⚠️  WARNING: Current signer is not the owner of the endpoint contract!");
      console.warn("⚠️  This might cause the transaction to fail.");
    }
  } catch (error) {
    console.log("ℹ️  Could not check contract owner (contract might not have owner function)");
  }

  // Ensure the chainId is passed as a uint16
  const chainId = network.chainId === 11155111 ? 10161 : network.chainId; // Sepolia -> 10161 or Tan network chainId
  console.log("🔗 Using chain ID for config:", chainId);

  // Debug library setup
  try {
    const defaultSendVersion = await endpoint.defaultSendVersion();
    const defaultReceiveVersion = await endpoint.defaultReceiveVersion();
    const latestVersion = await endpoint.latestVersion();
    
    console.log("📊 Default send version:", defaultSendVersion.toString());
    console.log("📊 Default receive version:", defaultReceiveVersion.toString());
    console.log("📊 Latest version:", latestVersion.toString());
    
    // Check if we need to set up the library first
    if (latestVersion.toString() === "0") {
      console.log("🔧 No library found, setting up ULN as default library...");
      
      if (!ulnAddress) {
        throw new Error("ULN address not found in deployment info");
      }
      
      // Step 1: Add ULN as the first library version
      console.log("🔧 Adding ULN as library version 1...");
      const newVersionTx = await endpoint.newVersion(ulnAddress, {
        gasLimit: 500000,
        gasPrice: ethers.utils.parseUnits('20', 'gwei')
      });
      console.log("⏳ Adding new library version:", newVersionTx.hash);
      await newVersionTx.wait();
      console.log("✅ Library version 1 added");
      
      // Step 2: Set it as default send version
      console.log("🔧 Setting default send version to 1...");
      const setDefaultSendTx = await endpoint.setDefaultSendVersion(1, {
        gasLimit: 500000,
        gasPrice: ethers.utils.parseUnits('20', 'gwei')
      });
      console.log("⏳ Setting default send version:", setDefaultSendTx.hash);
      await setDefaultSendTx.wait();
      console.log("✅ Default send version set to 1");
      
      // Step 3: Set it as default receive version
      console.log("🔧 Setting default receive version to 1...");
      const setDefaultReceiveTx = await endpoint.setDefaultReceiveVersion(1, {
        gasLimit: 500000,
        gasPrice: ethers.utils.parseUnits('20', 'gwei')
      });
      console.log("⏳ Setting default receive version:", setDefaultReceiveTx.hash);
      await setDefaultReceiveTx.wait();
      console.log("✅ Default receive version set to 1");
    }
    
    // Check if library is properly set up now
    const updatedDefaultSendVersion = await endpoint.defaultSendVersion();
    if (updatedDefaultSendVersion.toString() !== "0") {
      const libraryAddress = await endpoint.libraryLookup(updatedDefaultSendVersion);
      console.log("📊 Library address for version", updatedDefaultSendVersion.toString() + ":", libraryAddress);
    }
    
  } catch (error) {
    console.error("❌ Error setting up library:", error.message);
  }

  // Alternative approach: Try setting ULN directly if the functions exist
  try {
    if (ulnAddress) {
      console.log("🔧 Setting ULN address directly...");
      const setULNTx = await endpoint.setULN(ulnAddress, {
        gasLimit: 200000,
        gasPrice: ethers.utils.parseUnits('20', 'gwei')
      });
      console.log("⏳ Setting ULN:", setULNTx.hash);
      await setULNTx.wait();
      console.log("✅ ULN address set directly");
    }
  } catch (error) {
    console.log("ℹ️  Could not set ULN directly:", error.message);
  }

  // Get the current version to use for configs
  let configVersion = 1; // Default to version 1 since we set it up above
  try {
    const currentSendVersion = await endpoint.defaultSendVersion();
    if (currentSendVersion.toString() !== "0") {
      configVersion = parseInt(currentSendVersion.toString());
    }
    console.log("🔧 Using version", configVersion, "for configurations");
  } catch (error) {
    console.log("ℹ️  Using default version 1 for configurations");
  }

  // Now try to set Oracle config
  try {
    // Set Oracle Config
    const encodedOracleConfig = ethers.utils.defaultAbiCoder.encode(
      ['address'],
      [oracleAddress]
    );
    console.log(`🔧 Setting Oracle config for network ${filenameNetworkName} (${chainId})`);
    console.log("🔧 Encoded Oracle config:", encodedOracleConfig);
    
    const oracleTx = await endpoint.setConfig(configVersion, chainId, 6, encodedOracleConfig, {
      gasLimit: 500000,
      gasPrice: ethers.utils.parseUnits('20', 'gwei')
    });
    
    console.log("⏳ Oracle config transaction sent:", oracleTx.hash);
    await oracleTx.wait();
    console.log("✅ Oracle config set successfully.");
  } catch (error) {
    console.error("❌ Error setting Oracle config:", error.message);
    
    // Try with version 0 if version 1 fails
    try {
      console.log("🔧 Trying Oracle config with version 0...");
      const encodedOracleConfig = ethers.utils.defaultAbiCoder.encode(
        ['address'],
        [oracleAddress]
      );
      
      const oracleTx = await endpoint.setConfig(0, chainId, 6, encodedOracleConfig, {
        gasLimit: 500000,
        gasPrice: ethers.utils.parseUnits('20', 'gwei')
      });
      
      console.log("⏳ Oracle config (v0) transaction sent:", oracleTx.hash);
      await oracleTx.wait();
      console.log("✅ Oracle config (v0) set successfully.");
    } catch (error2) {
      console.error("❌ Error setting Oracle config with version 0:", error2.message);
    }
  }

  // Now try to set Relayer config
  try {
    // Set Relayer Config
    const encodedRelayerConfig = ethers.utils.defaultAbiCoder.encode(
      ['address'],
      [relayerAddress]
    );
    console.log(`🔧 Setting Relayer config for network ${filenameNetworkName} (${chainId})`);
    console.log("🔧 Encoded Relayer config:", encodedRelayerConfig);
    
    const relayerTx = await endpoint.setConfig(configVersion, chainId, 3, encodedRelayerConfig, {
      gasLimit: 500000,
      gasPrice: ethers.utils.parseUnits('20', 'gwei')
    });
    
    console.log("⏳ Relayer config transaction sent:", relayerTx.hash);
    await relayerTx.wait();
    console.log("✅ Relayer config set successfully.");
  } catch (error) {
    console.error("❌ Error setting Relayer config:", error.message);
    
    // Try with version 0 if version 1 fails
    try {
      console.log("🔧 Trying Relayer config with version 0...");
      const encodedRelayerConfig = ethers.utils.defaultAbiCoder.encode(
        ['address'],
        [relayerAddress]
      );
      
      const relayerTx = await endpoint.setConfig(0, chainId, 3, encodedRelayerConfig, {
        gasLimit: 500000,
        gasPrice: ethers.utils.parseUnits('20', 'gwei')
      });
      
      console.log("⏳ Relayer config (v0) transaction sent:", relayerTx.hash);
      await relayerTx.wait();
      console.log("✅ Relayer config (v0) set successfully.");
    } catch (error2) {
      console.error("❌ Error setting Relayer config with version 0:", error2.message);
    }
  }

  // REMOVED: The problematic configureULN function call
  // This was causing the transaction to revert - removing it since the configs are set above
  console.log("ℹ️  Skipping configureULN function (configs set individually above)");

  // Enhanced verification with better error handling
  console.log("\n🔍 Verifying configurations...");
  
  // Function to safely attempt config reading
  async function tryReadConfig(version, chainId, configType, typeName) {
    try {
      const config = await endpoint.getConfig(version, chainId, configType);
      console.log(`📊 ${typeName} config (v${version}):`, config);
      
      if (config && config !== "0x") {
        const decoded = ethers.utils.defaultAbiCoder.decode(['address'], config);
        console.log(`🔍 Decoded ${typeName} address:`, decoded[0]);
        return decoded[0];
      }
      return null;
    } catch (error) {
      console.log(`ℹ️  Could not read ${typeName} config v${version}:`, error.message);
      return null;
    }
  }

  // Try reading configs with different versions
  let oracleConfigFound = false;
  let relayerConfigFound = false;

  for (let version of [configVersion, 0, 1]) {
    if (!oracleConfigFound) {
      const oracleResult = await tryReadConfig(version, chainId, 6, "Oracle");
      if (oracleResult && oracleResult.toLowerCase() === oracleAddress.toLowerCase()) {
        console.log("✅ Oracle configuration verified successfully!");
        oracleConfigFound = true;
      }
    }
    
    if (!relayerConfigFound) {
      const relayerResult = await tryReadConfig(version, chainId, 3, "Relayer");
      if (relayerResult && relayerResult.toLowerCase() === relayerAddress.toLowerCase()) {
        console.log("✅ Relayer configuration verified successfully!");
        relayerConfigFound = true;
      }
    }
    
    if (oracleConfigFound && relayerConfigFound) break;
  }

  if (!oracleConfigFound) {
    console.log("❌ Oracle configuration could not be verified!");
  }
  if (!relayerConfigFound) {
    console.log("❌ Relayer configuration could not be verified!");
  }

  // Additional debug info
  try {
    const currentVersion = await endpoint.defaultSendVersion();
    const libraryAddr = await endpoint.libraryLookup(currentVersion);
    console.log("📊 Current send version:", currentVersion.toString());
    console.log("📊 Library address for current version:", libraryAddr);
  } catch (error) {
    console.log("ℹ️  Could not get current version info:", error.message);
  }
}

async function main() {
  try {
    await setConfig();
    console.log("\n🎉 Configuration process completed!");
  } catch (error) {
    console.error("💥 Error setting config:", error);
    process.exit(1);
  }
}

main();