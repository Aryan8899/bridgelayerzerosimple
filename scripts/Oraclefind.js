const { ethers } = require("hardhat");

async function main() {
  const signer = (await ethers.getSigners())[0];

  const ulnAddress = "0x1406dC024F2f5e542b185f5639f12b8d32B725B5"; // UltraLightNode on Sepolia
  const uln = await ethers.getContractAt("UltraLightNode", ulnAddress, signer);

  const srcChainId = 4442; // Your custom chain ID (TAN)
  const dstAddress = "0xc0721D2e8939f1b6EB0ee2B1D9E0955f93fa6C8B"; // Your destination app/endpoint

  const config = {
    relayer: signer.address,
    oracle: signer.address,
    inboundProofLibraryVersion: 1,
    inboundBlockConfirmations: 1
  };

  console.log("📦 Setting AppConfig with:");
  console.log("  Relayer:", config.relayer);
  console.log("  Oracle:", config.oracle);

  const tx = await uln.setAppConfig(srcChainId, dstAddress, config);
  console.log("⛓️ TX sent:", tx.hash);
  await tx.wait();
  console.log("✅ AppConfig set successfully.");
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
