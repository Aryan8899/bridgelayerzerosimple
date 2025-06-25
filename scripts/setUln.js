const { ethers } = require("hardhat");

async function main() {
  const signer = (await ethers.getSigners())[0]; // Your wallet
  const ulnAddress = "0x6338cc0F690E9eF6F962c5792D983Ba020A87026"; // UltraLightNode on Sepolia
  const srcChainId = 4442; // TAN chainId
  const relayer = signer.address;

  const uln = await ethers.getContractAt("UltraLightNode", ulnAddress, signer);

  console.log(`🛠️ Setting relayer ${relayer} for srcChainId ${srcChainId}...`);
  const tx = await uln.setRelayer(srcChainId, relayer);
  await tx.wait();
  console.log("✅ Relayer successfully set.");
}

main().catch((error) => {
  console.error("❌ Failed to set relayer:", error);
});
