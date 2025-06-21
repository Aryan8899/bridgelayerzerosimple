const { ethers } = require("hardhat");

async function main() {
  const uln = await ethers.getContractAt("UltraLightNode", "0x6338cc0F690E9eF6F962c5792D983Ba020A87026");
  const signer = (await ethers.getSigners())[0];

  const srcChainId = 4442; // TAN
  const dstAddress = "0xc0721D2e8939f1b6EB0ee2B1D9E0955f93fa6C8B"; // Receiver contract on Sepolia
  const relayer = signer.address;
  const oracle = await uln.oracle();
  const inboundBlockConfirmations = 1;
  const version = 1;

  const config = ethers.utils.solidityPack(
    ["address", "address", "uint16", "uint16"],
    [relayer, oracle, inboundBlockConfirmations, version]
  );

  const endpoint = await ethers.getContractAt("Endpoint", "0x427B732Da96775A2BB4578b08c3D276141265fDd");
  const tx = await endpoint.setConfig(srcChainId, dstAddress, 1, config);
  await tx.wait();
  

  console.log("✅ UA config updated with relayer:", relayer);
}

main().catch((error) => {
  console.error("❌ Error:", error);
  process.exit(1);
});
