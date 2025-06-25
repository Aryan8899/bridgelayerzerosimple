const { ethers } = require("hardhat");

async function main() {
  const signer = (await ethers.getSigners())[0];
  const ulnAddress = "0xE6B00376c5Bd4F4941d9cCed15b7Bb541EC29344"; // Your deployed ULN address
  const uln = await ethers.getContractAt("UltraLightNode", ulnAddress);

  const tx = await uln.setOracle(4442, signer.address); // 4442 = TAN chainId
  await tx.wait();
  console.log("✅ Oracle set for chain 4442 to:", signer.address);
}

main().catch(console.error);
