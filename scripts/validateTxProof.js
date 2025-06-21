const { ethers } = require("hardhat");

// === CONFIGURATION ===
const PRIVATE_KEY = "2b12cb7d0171802df82fc69aca38ad8356343c91ec246a4b2e9d665a6206d4ee";
const RPC_URL = "https://eth-sepolia.g.alchemy.com/v2/B7X9gRjxfPZ9uOYogYWOy";

const ULN_ADDRESS = "0x1406dC024F2f5e542b185f5639f12b8d32B725B5";
const DEST_CHAIN_ID = 4442;
const DEST_ADDRESS = "0xfc2e86f487E0B85A9022dF0ad1d307870f54d3f9";
const GAS_LIMIT = 500_000;

const LOOKUP_HASH = "0x58333e5097e8011af1b9b14092e71ad76ac9612c5cb8ed4b95281bfcd2637a45";
const TRANSACTION_PROOF = "0xf8f2b853f851a002e56ebbe3b7db2191c1155d2c9a45284a5463819b3b35398b403f661f6e50d380808080808080a0dd658c72091e8aea695438b8c5656ca3fa3db028546cd7a3817021eb166b83038080808080808080b89bf89930b896f8948206318504a817c80083011ae294981fc49a3739fe41969c84788700cc7775aea08087038d7ea4c68000a411e1980300000000000000000000000000000000000000000000000000000000000027b18222d8a0ae2ad71ae19cf1129b8eb2563122fa1e0b1b2542deddfb918766ff0f26ce907ea0261e357756224f260f5b8e7d2a851b0b52b526f8fde5453d4920dba140fcafd4";

// === MAIN FUNCTION ===
async function main() {
  const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

  const uln = await ethers.getContractAt("UltraLightNode", ULN_ADDRESS, wallet);

  console.log("🧪 Calling validateTransactionProof...");
  const tx = await uln.validateTransactionProof(
    DEST_CHAIN_ID,
    DEST_ADDRESS,
    GAS_LIMIT,
    LOOKUP_HASH,
    TRANSACTION_PROOF
  );

  console.log("✅ TX sent:", tx.hash);
  await tx.wait();
  console.log("🎉 TX confirmed: Proof validated.");
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
