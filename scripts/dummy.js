const { ethers } = require('ethers');

// Connect to the Ethereum network
const provider = new ethers.providers.JsonRpcProvider("https://eth-sepolia.g.alchemy.com/v2/v9nJ1WrWkOCwJzsXEB6PRfMcE5UwP3NW");

async function getBlock() {
  // Get block by number
  const blockNumber = "latest";
  const block = await provider.getBlock(blockNumber);

  console.log(block);
}

getBlock().catch(console.error);
