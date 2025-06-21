const { ethers } = require("ethers");
const fs = require("fs");
require("dotenv").config();

async function main() {
  const PRIVATE_KEY = "2b12cb7d0171802df82fc69aca38ad8356343c91ec246a4b2e9d665a6206d4ee";
  const SEPOLIA_RPC = "https://eth-sepolia.g.alchemy.com/v2/B7X9gRjxfPZ9uOYogYWOy";
  const provider = new ethers.providers.JsonRpcProvider(SEPOLIA_RPC);
  const signer = new ethers.Wallet(PRIVATE_KEY, provider);
  console.log("🛠️ Using signer:", signer.address);

  const ulnAddress = "0x6338cc0F690E9eF6F962c5792D983Ba020A87026";
  const chainId = 4442;
  const newOracle = signer.address; // Or hardcode any other address

  // ✅ Load ABI from compiled artifact
  const ulnAbi = JSON.parse(
    fs.readFileSync("./artifacts/contracts/UltraLightNode.sol/UltraLightNode.json", "utf8")
  ).abi;

  const uln = new ethers.Contract(ulnAddress, ulnAbi, signer);

  console.log("📡 Calling setOracle...");
  const tx = await uln.setOracle(chainId, newOracle);
  console.log("⛓️ TX sent:", tx.hash);
  await tx.wait();

  console.log(`✅ Oracle for chain ${chainId} is now set to ${newOracle}`);
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
