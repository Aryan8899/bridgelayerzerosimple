const { ethers } = require("hardhat");

// === CONFIGURATION ===
const PRIVATE_KEY = "2b12cb7d0171802df82fc69aca38ad8356343c91ec246a4b2e9d665a6206d4ee";
const RPC_URL = "https://eth-sepolia.g.alchemy.com/v2/B7X9gRjxfPZ9uOYogYWOy";

const ULN_ADDRESS = "0xE6B00376c5Bd4F4941d9cCed15b7Bb541EC29344";
const DEST_CHAIN_ID = 4442;
const DEST_ADDRESS = "0xc0721D2e8939f1b6EB0ee2B1D9E0955f93fa6C8B";
const GAS_LIMIT = 500000;

const LOOKUP_HASH = "0x982742eb77a8ab7e6ca6355a0ef2ff340de7ff8c8de1706708855910a2994087";
const TRANSACTION_PROOF = "0xf8cab853f851a0afac94deda6e7477d712361801a84d669a8bf02f681a21d09a09b5e598b4139080808080808080a0f89ee1f0f41b87dbd7382fdd912c0162a448df766444b4c0c938cd401ad336278080808080808080b873f87130b86ef86c8206418506fc23ac0082520894c285d7192174486f038a4de931cb4f99ddaef4c38609184e72a000801ca039e8b3f0ea0f7d3066410f043bcca1670e49a51c0495fbf4449bf4e6e810ddc1a037e0b4468cad6a9f3435ddb42fdeab02990ec85f69552f6d702491bb6ad73ba5";

// === MAIN FUNCTION ===
async function main() {
  const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
  //const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

  const wallet = new ethers.Wallet(PRIVATE_KEY, provider); // Check that PRIVATE_KEY matches relayer
  

  console.log("Signer:", wallet.address);

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
