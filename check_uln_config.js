const { ethers } = require("ethers");
const fs = require("fs");
require("dotenv").config();

async function fixLayerZeroSetup() {
    console.log("🔧 Enhanced LayerZero Setup Fix...");
    
    const DST_RPC = "https://eth-sepolia.g.alchemy.com/v2/B7X9gRjxfPZ9uOYogYWOy";
    const PRIVATE_KEY = process.env.PRIVATE_KEY;
    
    const dstProvider = new ethers.providers.JsonRpcProvider(DST_RPC);
    const wallet = new ethers.Wallet(PRIVATE_KEY, dstProvider);
    
    const sepData = JSON.parse(fs.readFileSync("deployments/endpoint-sepolia.json"));
    const ulnAddress = sepData.contracts.uln;
    const endpointAddress = sepData.contracts.endpoint;
    const receiverAddress = sepData.contracts.receiver;
    const libraryAddress = sepData.contracts.library;
    
    console.log("📍 Contract addresses:");
    console.log("  ULN:", ulnAddress);
    console.log("  Endpoint:", endpointAddress);
    console.log("  Receiver:", receiverAddress);
    console.log("  Library:", libraryAddress);
    console.log("  Your wallet:", wallet.address);
    
    // Enhanced ABIs with additional method signatures
    const ulnABI = [
        "function setRelayer(address _relayer) external",
        "function relayer() external view returns (address)",
        "function owner() external view returns (address)"
    ];
    
    const endpointABI = [
        "function latestVersion() external view returns (uint16)",
        "function defaultSendVersion() external view returns (uint16)",
        "function defaultReceiveVersion() external view returns (uint16)",
        "function defaultSendLibrary() external view returns (address)",
        "function defaultReceiveLibrary(uint16 _version) external view returns (address)",
        "function setConfig(uint16 _version, uint16 _chainId, uint256 _configType, bytes calldata _config) external",
        "function getConfig(uint16 _version, uint16 _chainId, address _ua, uint256 _configType) external view returns (bytes memory)",
        "function uaConfigLookup(address _ua) external view returns (tuple(uint16 sendVersion, uint16 receiveVersion, address receiveLibraryAddress, address sendLibrary))",
        "function setSendVersion(address _ua, uint16 _version) external",
        "function setReceiveVersion(address _ua, uint16 _version) external"
    ];
    
    // Enhanced receiver ABI with proper method signatures
    const receiverABI = [
        "function owner() external view returns (address)",
        "function lzEndpoint() external view returns (address)",
        "function setTrustedRemote(uint16 _srcChainId, bytes calldata _path) external",
        "function setTrustedRemoteAddress(uint16 _remoteChainId, address _remoteAddress) external",
        "function trustedRemoteLookup(uint16) external view returns (bytes memory)",
        "function isTrustedRemote(uint16 _srcChainId, bytes calldata _srcAddress) external view returns (bool)",
        "function getTrustedRemoteAddress(uint16 _remoteChainId) external view returns (bytes memory)",
        // Alternative method signatures that might exist
        "function setTrustedRemote(uint16,address) external",
        "function addTrustedRemote(uint16,bytes) external",
        "function configureTrustedRemote(uint16,address) external"
    ];
    
    const uln = new ethers.Contract(ulnAddress, ulnABI, wallet);
    const endpoint = new ethers.Contract(endpointAddress, endpointABI, wallet);
    const receiver = new ethers.Contract(receiverAddress, receiverABI, wallet);
    
    // Dynamic gas estimation with fallback
    const getGasOptions = async (contract, method, params) => {
        try {
            const estimatedGas = await contract.estimateGas[method](...params);
            return {
                gasLimit: estimatedGas.mul(120).div(100), // 20% buffer
                gasPrice: ethers.utils.parseUnits("25", "gwei")
            };
        } catch (error) {
            return {
                gasLimit: 500000,
                gasPrice: ethers.utils.parseUnits("25", "gwei")
            };
        }
    };
    
    let setupResults = {
        relayerConfigured: false,
        uaVersionsConfigured: false,
        trustedRemoteConfigured: false,
        advancedConfigsSet: []
    };
    
    // Step 1: Configure ULN Relayer (same as before)
    try {
        console.log("\n🔥 Step 1: Configuring ULN Relayer...");
        const currentRelayer = await uln.relayer();
        
        if (currentRelayer.toLowerCase() !== wallet.address.toLowerCase()) {
            console.log("📝 Setting relayer to your wallet address...");
            const gasOptions = await getGasOptions(uln, "setRelayer", [wallet.address]);
            const setRelayerTx = await uln.setRelayer(wallet.address, gasOptions);
            const receipt = await setRelayerTx.wait();
            
            if (receipt.status === 1) {
                console.log("✅ Relayer successfully configured");
                setupResults.relayerConfigured = true;
            }
        } else {
            console.log("✅ Relayer already configured correctly");
            setupResults.relayerConfigured = true;
        }
        
        console.log("🔍 Current relayer:", await uln.relayer());
        
    } catch (error) {
        console.error("❌ Relayer configuration failed:", error.message);
    }
    
    // Step 2: Enhanced UA Version Configuration
    try {
        console.log("\n📚 Step 2: Enhanced UA Version Configuration...");
        
        const latestVersion = await endpoint.latestVersion();
        const defaultSendVersion = await endpoint.defaultSendVersion();
        const defaultReceiveVersion = await endpoint.defaultReceiveVersion();
        
        console.log("📦 Available versions:");
        console.log("  Latest:", latestVersion.toString());
        console.log("  Default Send:", defaultSendVersion.toString());
        console.log("  Default Receive:", defaultReceiveVersion.toString());
        
        const currentConfig = await endpoint.uaConfigLookup(receiverAddress);
        console.log("📋 Current UA Config:");
        console.log("  Send version:", currentConfig.sendVersion.toString());
        console.log("  Receive version:", currentConfig.receiveVersion.toString());
        
        // Try endpoint-level configuration first
        let versionsSet = false;
        try {
            console.log("🔧 Attempting endpoint-level version configuration...");
            
            if (currentConfig.sendVersion.toString() === "0") {
                try {
                    const gasOptions = await getGasOptions(endpoint, "setSendVersion", [receiverAddress, defaultSendVersion]);
                    const setSendTx = await endpoint.setSendVersion(receiverAddress, defaultSendVersion, gasOptions);
                    await setSendTx.wait();
                    console.log("✅ Send version configured via endpoint");
                    versionsSet = true;
                } catch (e) {
                    console.log("ℹ️ Endpoint setSendVersion not available");
                }
            }
            
            if (currentConfig.receiveVersion.toString() === "0") {
                try {
                    const gasOptions = await getGasOptions(endpoint, "setReceiveVersion", [receiverAddress, defaultReceiveVersion]);
                    const setReceiveTx = await endpoint.setReceiveVersion(receiverAddress, defaultReceiveVersion, gasOptions);
                    await setReceiveTx.wait();
                    console.log("✅ Receive version configured via endpoint");
                    versionsSet = true;
                } catch (e) {
                    console.log("ℹ️ Endpoint setReceiveVersion not available");
                }
            }
            
        } catch (error) {
            console.log("ℹ️ Endpoint version configuration not supported");
        }
        
        setupResults.uaVersionsConfigured = versionsSet;
        
    } catch (error) {
        console.error("❌ UA version configuration failed:", error.message);
    }
    
    // Step 3: Enhanced Trusted Remote Configuration
    try {
        console.log("\n🛠️ Step 3: Enhanced Trusted Remote Configuration...");
        
        const TAN_CHAIN_ID = 4442;
        const tanData = JSON.parse(fs.readFileSync("deployments/endpoint-tan.json"));
        const senderAddress = tanData.contracts.sender;
        
        console.log("📤 TAN Sender Address:", senderAddress);
        console.log("🔗 TAN Chain ID:", TAN_CHAIN_ID);
        
        // Check if receiver is owned by our wallet
        let isOwner = false;
        try {
            const ownerAddress = await receiver.owner();
            isOwner = ownerAddress.toLowerCase() === wallet.address.toLowerCase();
            console.log("👤 Contract owner:", ownerAddress);
            console.log("🔑 You are owner:", isOwner);
        } catch (e) {
            console.log("ℹ️ Could not check ownership");
        }
        
        if (!isOwner) {
            console.log("⚠️ Warning: You may not be the contract owner. Trusted remote configuration might fail.");
        }
        
        // Try multiple trusted remote configuration methods
        const configMethods = [
            {
                name: "setTrustedRemote with packed path",
                execute: async () => {
                    const trustedRemotePath = ethers.utils.solidityPack(
                        ['address', 'address'],
                        [senderAddress, receiverAddress]
                    );
                    console.log("📦 Packed path:", trustedRemotePath);
                    const gasOptions = await getGasOptions(receiver, "setTrustedRemote", [TAN_CHAIN_ID, trustedRemotePath]);
                    const tx = await receiver.setTrustedRemote(TAN_CHAIN_ID, trustedRemotePath, gasOptions);
                    return await tx.wait();
                }
            },
            {
                name: "setTrustedRemoteAddress",
                execute: async () => {
                    const gasOptions = await getGasOptions(receiver, "setTrustedRemoteAddress", [TAN_CHAIN_ID, senderAddress]);
                    const tx = await receiver.setTrustedRemoteAddress(TAN_CHAIN_ID, senderAddress, gasOptions);
                    return await tx.wait();
                }
            },
            {
                name: "setTrustedRemote with sender only",
                execute: async () => {
                    const senderBytes = ethers.utils.hexZeroPad(senderAddress, 32);
                    const gasOptions = await getGasOptions(receiver, "setTrustedRemote", [TAN_CHAIN_ID, senderBytes]);
                    const tx = await receiver.setTrustedRemote(TAN_CHAIN_ID, senderBytes, gasOptions);
                    return await tx.wait();
                }
            }
        ];
        
        let trustedRemoteConfigured = false;
        for (const method of configMethods) {
            if (trustedRemoteConfigured) break;
            
            try {
                console.log(`🔧 Trying: ${method.name}...`);
                const receipt = await method.execute();
                
                if (receipt.status === 1) {
                    console.log(`✅ ${method.name} successful!`);
                    trustedRemoteConfigured = true;
                    setupResults.trustedRemoteConfigured = true;
                    
                    // Verify configuration
                    try {
                        const trustedRemote = await receiver.trustedRemoteLookup(TAN_CHAIN_ID);
                        console.log("✅ Verified trusted remote:", trustedRemote);
                    } catch (e) {
                        console.log("ℹ️ Could not verify but transaction succeeded");
                    }
                    break;
                }
            } catch (error) {
                console.log(`❌ ${method.name} failed:`, error.message.substring(0, 100));
                
                // If it's a revert with data, try to decode it
                if (error.data) {
                    try {
                        const reason = ethers.utils.toUtf8String("0x" + error.data.substring(138));
                        console.log("   Revert reason:", reason);
                    } catch (e) {
                        console.log("   Raw error data:", error.data.substring(0, 50));
                    }
                }
            }
        }
        
        if (!trustedRemoteConfigured) {
            console.log("❌ All trusted remote configuration methods failed");
            console.log("💡 Possible issues:");
            console.log("   - Contract may not be owned by your wallet");
            console.log("   - Contract may not implement standard LayerZero UA interface");
            console.log("   - Chain ID or address format may be incorrect");
        }
        
    } catch (error) {
        console.error("❌ Trusted remote configuration failed:", error.message);
    }
    
    // Step 4: Advanced Configuration (same as before but with better error handling)
    try {
        console.log("\n🔧 Step 4: Advanced LayerZero Configuration...");
        
        const TAN_CHAIN_ID = 4442;
        const VERSION = 1;
        
        const configs = [
            {
                type: 6, // CONFIG_TYPE_ORACLE
                name: "Oracle",
                data: ethers.utils.defaultAbiCoder.encode(["address"], [wallet.address])
            },
            {
                type: 3, // CONFIG_TYPE_RELAYER
                name: "Relayer",
                data: ethers.utils.defaultAbiCoder.encode(["address"], [wallet.address])
            },
            {
                type: 2, // CONFIG_TYPE_INBOUND_BLOCK_CONFIRMATIONS
                name: "Inbound Block Confirmations",
                data: ethers.utils.defaultAbiCoder.encode(["uint16"], [2])
            },
            {
                type: 5, // CONFIG_TYPE_OUTBOUND_BLOCK_CONFIRMATIONS
                name: "Outbound Block Confirmations",
                data: ethers.utils.defaultAbiCoder.encode(["uint16"], [2])
            },
            {
                type: 4, // CONFIG_TYPE_OUTBOUND_PROOF_TYPE
                name: "Outbound Proof Type",
                data: ethers.utils.defaultAbiCoder.encode(["uint16"], [1])
            },
            {
                type: 1, // CONFIG_TYPE_INBOUND_PROOF_LIBRARY_VERSION
                name: "Inbound Proof Library",
                data: ethers.utils.defaultAbiCoder.encode(["address"], [libraryAddress])
            }
        ];
        
        for (const config of configs) {
            try {
                console.log(`🔧 Setting ${config.name}...`);
                
                const gasOptions = await getGasOptions(endpoint, "setConfig", [VERSION, TAN_CHAIN_ID, config.type, config.data]);
                const setConfigTx = await endpoint.setConfig(
                    VERSION,
                    TAN_CHAIN_ID,
                    config.type,
                    config.data,
                    gasOptions
                );
                const receipt = await setConfigTx.wait();
                
                if (receipt.status === 1) {
                    console.log(`✅ ${config.name} configured successfully`);
                    setupResults.advancedConfigsSet.push(config.name);
                }
                
            } catch (error) {
                console.log(`ℹ️ ${config.name} config failed:`, error.message.substring(0, 60));
            }
        }
        
    } catch (error) {
        console.error("❌ Advanced configuration failed:", error.message);
    }
    
    // Step 5: Final Verification and Recommendations
    try {
        console.log("\n🔍 Step 5: Final Verification and Recommendations...");
        
        // Check configurations
        const relayer = await uln.relayer();
        const isRelayerCorrect = relayer.toLowerCase() === wallet.address.toLowerCase();
        
        const finalConfig = await endpoint.uaConfigLookup(receiverAddress);
        const isUAConfigured = (
            finalConfig.sendVersion.toString() !== "0" ||
            finalConfig.receiveVersion.toString() !== "0"
        );
        
        // Enhanced trusted remote check
        const TAN_CHAIN_ID = 4442;
        let trustedRemoteSet = false;
        let trustedRemoteData = "";
        try {
            const trustedRemote = await receiver.trustedRemoteLookup(TAN_CHAIN_ID);
            trustedRemoteSet = trustedRemote && trustedRemote !== "0x" && trustedRemote.length > 2;
            trustedRemoteData = trustedRemote;
        } catch (error) {
            console.log("❓ Could not verify trusted remote");
        }
        
        // Calculate final score
        const score = [
            setupResults.relayerConfigured,
            isUAConfigured,
            setupResults.trustedRemoteConfigured,
            setupResults.advancedConfigsSet.length > 0
        ].filter(Boolean).length;
        
        console.log("\n" + "=".repeat(60));
        
        if (score === 4) {
            console.log("🎉 COMPLETE SETUP! All configurations successful.");
        } else if (score >= 2) {
            console.log("⚠️ PARTIAL SETUP! Some configurations successful.");
            console.log(`✅ ${score}/4 major components configured`);
        } else {
            console.log("❌ SETUP INCOMPLETE! Critical issues remain.");
        }
        
        console.log("\n📊 Detailed Setup Summary:");
        console.log("✅ Relayer configured:", setupResults.relayerConfigured);
        console.log("✅ UA versions configured:", isUAConfigured);
        console.log("✅ Trusted remote configured:", setupResults.trustedRemoteConfigured);
        console.log("✅ Advanced configs set:", setupResults.advancedConfigsSet.length);
        
        if (trustedRemoteSet) {
            console.log("🔗 Trusted remote data:", trustedRemoteData);
        }
        
        // Recommendations
        console.log("\n💡 Next Steps and Recommendations:");
        
        if (!setupResults.trustedRemoteConfigured) {
            console.log("🔧 CRITICAL: Trusted remote not configured!");
            console.log("   - Verify you own the receiver contract");
            console.log("   - Check if receiver implements LayerZero UA standard");
            console.log("   - Consider manual configuration through contract interface");
        }
        
        if (!isUAConfigured) {
            console.log("⚠️ UA versions not set - this may affect message routing");
            console.log("   - Try configuring through LayerZero endpoint directly");
            console.log("   - Check if your UA contract supports version setting");
        }
        
        if (setupResults.advancedConfigsSet.length < 3) {
            console.log("ℹ️ Limited advanced configuration - may affect reliability");
            console.log("   - Some configs may require contract owner permissions");
            console.log("   - Consider setting up proper oracle and relayer configs");
        }
        
        console.log("\n💰 Wallet balance:", ethers.utils.formatEther(await wallet.getBalance()), "ETH");
        console.log("=".repeat(60));
        
    } catch (error) {
        console.error("❌ Verification failed:", error.message);
    }
}

// Enhanced contract analysis with bytecode inspection
async function analyzeContracts() {
    console.log("\n🔬 Enhanced Contract Analysis...");
    
    const DST_RPC = "https://eth-sepolia.g.alchemy.com/v2/B7X9gRjxfPZ9uOYogYWOy";
    const PRIVATE_KEY = process.env.PRIVATE_KEY;
    
    const dstProvider = new ethers.providers.JsonRpcProvider(DST_RPC);
    const wallet = new ethers.Wallet(PRIVATE_KEY, dstProvider);
    
    const sepData = JSON.parse(fs.readFileSync("deployments/endpoint-sepolia.json"));
    const receiverAddress = sepData.contracts.receiver;
    
    // Enhanced bytecode analysis
    const receiverCode = await dstProvider.getCode(receiverAddress);
    console.log("📝 Receiver contract size:", receiverCode.length, "bytes");
    
    // More comprehensive method signature analysis
    const methodSignatures = [
        { sig: "0x8da5cb5b", name: "owner()", critical: true },
        { sig: "0xb353aaa7", name: "lzEndpoint()", critical: true },
        { sig: "0xeb8d72b7", name: "setTrustedRemote(uint16,bytes)", critical: true },
        { sig: "0xa6c3d165", name: "setTrustedRemoteAddress(uint16,address)", critical: true },
        { sig: "0x7533d788", name: "trustedRemoteLookup(uint16)", critical: true },
        { sig: "0x07e0db17", name: "setSendVersion(uint16)", critical: false },
        { sig: "0x10ddb137", name: "setReceiveVersion(uint16)", critical: false },
        { sig: "0x001d3567", name: "lzReceive(uint16,bytes,uint64,bytes)", critical: true },
        { sig: "0x42d65a8d", name: "forceResumeReceive(uint16,bytes)", critical: false }
    ];
    
    console.log("\n🔍 Method Signature Analysis:");
    let criticalMethodsFound = 0;
    let totalCriticalMethods = 0;
    
    for (const method of methodSignatures) {
        const hasMethod = receiverCode.includes(method.sig.slice(2).toLowerCase()) || 
                         receiverCode.includes(method.sig.slice(2).toUpperCase());
        const status = hasMethod ? '✅' : '❌';
        console.log(`${status} ${method.name}`);
        
        if (method.critical) {
            totalCriticalMethods++;
            if (hasMethod) criticalMethodsFound++;
        }
    }
    
    console.log(`\n📊 LayerZero UA Compliance: ${criticalMethodsFound}/${totalCriticalMethods} critical methods found`);
    
    if (criticalMethodsFound < totalCriticalMethods) {
        console.log("⚠️ Contract may not fully implement LayerZero UA standard");
        console.log("💡 This could explain why some configurations are failing");
    }
    
    // Check for common LayerZero patterns in bytecode
    const patterns = [
        { pattern: "LayerZero", name: "LayerZero string reference" },
        { pattern: "trusted", name: "Trusted remote references" },
        { pattern: "endpoint", name: "Endpoint references" }
    ];
    
    console.log("\n🔍 Bytecode Pattern Analysis:");
    for (const pattern of patterns) {
        const hasPattern = receiverCode.toLowerCase().includes(Buffer.from(pattern.pattern).toString('hex'));
        console.log(`${hasPattern ? '✅' : '❌'} ${pattern.name}`);
    }
}

// Main execution
console.log("🚀 Starting Enhanced LayerZero Setup Fix...");
fixLayerZeroSetup()
    .then(() => analyzeContracts())
    .catch((error) => {
        console.error("💥 Setup failed with error:", error);
        console.log("\n🔧 Troubleshooting suggestions:");
        console.log("1. Verify all contract addresses are correct");
        console.log("2. Ensure you have enough ETH for gas fees");
        console.log("3. Check that you own the receiver contract");
        console.log("4. Verify the receiver contract implements LayerZero UA interface");
        console.log("5. Try running individual configuration steps manually");
        process.exit(1);
    });