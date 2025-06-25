const { ethers } = require("hardhat");

async function main() {
  const signer = (await ethers.getSigners())[0];

  const ulnAddress = "0xb85F78148f5Dd95f038Dd919292E3DF5750662CF"; // ✅ Your ULN on Sepolia
  const ua = "0xBe59330bc42B8e2d3F5a67CF0B67a2BA49CC1638";         // ✅ Your Receiver contract (UA)
  const srcChainId = 4442;                                        // ✅ TAN chain ID
  const relayer = "0xc285D7192174486f038A4de931cb4F99DdaeF4C3";   // ✅ Your registered relayer
  const oracle = "0xc285D7192174486f038A4de931cb4F99DdaeF4C3"; // ✅ Your Sepolia LayerZero Library
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
