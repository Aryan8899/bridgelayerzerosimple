const { ethers } = require("hardhat");

async function main() {
  const signer = (await ethers.getSigners())[0];
  console.log("🛠️ Using signer:", signer.address);

  const ulnAddress = "0x6E2281a9af767213723695F8fF5f400FBEac5562"; // ULN on TAN
  const relayerAddress = "0x6Bc438E7477345A3973E4564aDF535928Af967C3"; // Relayer on TAN

  const uln = await ethers.getContractAt("UltraLightNode", ulnAddress, signer);

  const tx = await uln.setRelayer(relayerAddress, {
    gasPrice: ethers.utils.parseUnits("10", "gwei"), // TAN custom gas
  });

  console.log("⛓️ TX sent:", tx.hash);
  await tx.wait();

  const savedRelayer = await uln.relayer();
  console.log("✅ ULN relayer on TAN is now:", savedRelayer);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
