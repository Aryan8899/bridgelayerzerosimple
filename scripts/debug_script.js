const { ethers } = require("hardhat");

async function main() {
    console.log("🚀 Starting debug script...");
    
    try {
        const [deployer] = await ethers.getSigners();
        console.log("Deployer address:", deployer.address);
        console.log("Deployer balance:", ethers.utils.formatEther(await deployer.getBalance()), "ETH");
        
        // Your contract details
        const receiverAddress = "0xe1Cd39b54e3984b3D3faEa988f48C8A57fb199E4";
        const receiverABI = 
            [
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "_wtan",
          "type": "address"
        },
        {
          "internalType": "address",
          "name": "_endpoint",
          "type": "address"
        }
      ],
      "stateMutability": "nonpayable",
      "type": "constructor"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "address",
          "name": "user",
          "type": "address"
        },
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "amount",
          "type": "uint256"
        }
      ],
      "name": "NativeBridged",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "address",
          "name": "user",
          "type": "address"
        },
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "amount",
          "type": "uint256"
        }
      ],
      "name": "NativeUnwrapped",
      "type": "event"
    },
    {
      "inputs": [],
      "name": "endpoint",
      "outputs": [
        {
          "internalType": "address",
          "name": "",
          "type": "address"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "initialize",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint16",
          "name": "",
          "type": "uint16"
        },
        {
          "internalType": "bytes",
          "name": "",
          "type": "bytes"
        },
        {
          "internalType": "uint64",
          "name": "",
          "type": "uint64"
        },
        {
          "internalType": "bytes",
          "name": "payload",
          "type": "bytes"
        }
      ],
      "name": "lzReceive",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "owner",
      "outputs": [
        {
          "internalType": "address",
          "name": "",
          "type": "address"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "wtan",
      "outputs": [
        {
          "internalType": "contract WTAN",
          "name": "",
          "type": "address"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "stateMutability": "payable",
      "type": "receive"
    }
  ];
            // Add other functions you need

        
        console.log("📋 Contract address:", receiverAddress);
        
        // Create contract instance
        const receiverContract = new ethers.Contract(receiverAddress, receiverABI, deployer);
        
        // Check current state
        try {
            const owner = await receiverContract.owner();
            console.log("Current owner:", owner);
            
            if (owner === ethers.constants.AddressZero) {
                console.log("✅ Contract not initialized yet, proceeding...");
                
                // Call initialize
                console.log("🔄 Calling initialize function...");
                const tx = await receiverContract.initialize();
                console.log("Transaction hash:", tx.hash);
                
                const receipt = await tx.wait();
                console.log("✅ Transaction confirmed!");
                console.log("Block number:", receipt.blockNumber);
                console.log("Gas used:", receipt.gasUsed.toString());
                
            } else {
                console.log("⚠️ Contract already initialized with owner:", owner);
            }
            
        } catch (error) {
            console.error("❌ Error:", error.message);
        }
        
    } catch (error) {
        console.error("❌ Script failed:", error);
    }
}

// Make sure to call main() and handle the promise
main()
    .then(() => {
        console.log("✅ Script completed");
        process.exit(0);
    })
    .catch((error) => {
        console.error("❌ Script failed:", error);
        process.exit(1);
    });