const { ethers } = require("hardhat");

async function main() {
  const signer = (await ethers.getSigners())[0];

  const ulnAddress = "0xE6B00376c5Bd4F4941d9cCed15b7Bb541EC29344"; // ✅ Your ULN on Sepolia
  const ua = "0xc0721D2e8939f1b6EB0ee2B1D9E0955f93fa6C8B";         // ✅ Your Receiver contract (UA)
  const srcChainId = 4442;                                        // ✅ TAN chain ID
  const relayer = "0xc285D7192174486f038A4de931cb4F99DdaeF4C3";   // ✅ Your registered relayer
  const oracle = "0x639EbfE1206c31767489c580f293995805840430"; // ✅ Your Sepolia LayerZero Library
  const confirmations = 1;
  const confirmations2 = 2

  const uln = await ethers.getContractAt("UltraLightNode", ulnAddress, signer);

  console.log("🛠️ Setting App Config with:");
  console.log(`   UA:       ${ua}`);
  console.log(`   Chain ID: ${srcChainId}`);
  //console.log(`   Library:  ${libraryAddress}`);
  console.log(`   Relayer:  ${relayer}`);
  console.log(`   Confirmations: ${confirmations}`);

  const tx = await uln.setAppConfig(
    srcChainId,
    ua,
    relayer,
    oracle,
    confirmations,
    confirmations2

  );

  await tx.wait();
  console.log("✅ App Config set successfully.");
}

main().catch((error) => {
  console.error("❌ Failed to set app config:", error);
});
