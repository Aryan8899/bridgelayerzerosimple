const { ethers } = require("hardhat");

async function main() {
  const signer = (await ethers.getSigners())[0];
  const UltraLightNode = await ethers.getContractFactory("UltraLightNode");
  const endpointAddress = "0x427B732Da96775A2BB4578b08c3D276141265fDd"; // Sepolia Endpoint address you control or mock

  const uln = await UltraLightNode.deploy(endpointAddress);
  await uln.deployed();

  console.log("✅ ULN deployed at:", uln.address);
}

main().catch(console.error);
