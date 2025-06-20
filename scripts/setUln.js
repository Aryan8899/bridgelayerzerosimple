const { ethers } = require("hardhat");

async function main() {
  const signer = (await ethers.getSigners())[0];
  console.log("🛠️ Using signer:", signer.address);

  const ulnAddress = "0x8691eFC4cD7d0B7463CE02E815cc0264D04AA2b2"; // ULN on Sepolia
  const relayerAddress = "0xb9C2642d09E1e0697499c746d4dC9725E5671b8e"; // NEW relayer

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
