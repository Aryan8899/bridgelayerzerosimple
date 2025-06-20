const { ethers } = require("hardhat");

async function main() {
  const ULN = await ethers.getContractAt("UltraLightNode", "0x8691eFC4cD7d0B7463CE02E815cc0264D04AA2b2");
  const tx = await ULN.setDefaultConfigForChainId(
  4442, // srcChainId
  1,    // inboundProofLibraryVersion
  2,    // inboundBlockConfirmations
  "0xc285D7192174486f038A4de931cb4F99DdaeF4C3", // relayer
  1,    // outboundProofType
  2,    // outboundBlockConfirmations
  "0x2fEC9110A30712B7f7D6ccE478d8FE2dFeAFB5DD"  // oracle
);
await tx.wait();
console.log("✅ Default config set.");

}

main();
