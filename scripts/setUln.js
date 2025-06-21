const { ethers } = require("hardhat");

async function main() {
  const signer = (await ethers.getSigners())[0];
  console.log("🛠️ Using signer:", signer.address);

  const ulnAddress = "0x1406dC024F2f5e542b185f5639f12b8d32B725B5"; // ULN on Sepolia
  const relayerAddress = "0xc285D7192174486f038A4de931cb4F99DdaeF4C3"; // NEW relayer

  const uln = await ethers.getContractAt("UltraLightNode", ulnAddress, signer);

  const tx = await uln.setRelayer(relayerAddress);
  console.log("⛓️ TX sent:", tx.hash);
  await tx.wait();
  console.log("✅ ULN now recognizes new relayer.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
