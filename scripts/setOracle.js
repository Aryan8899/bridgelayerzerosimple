const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const signer = (await ethers.getSigners())[0];
  console.log("🛠️ Using signer:", signer.address);

  const ulnAddress = "0x6338cc0F690E9eF6F962c5792D983Ba020A87026"; // ULN contract address
  const chainId = 4442;
  const newOracle = signer.address;
console.log(signer.address)
  // Correct ABI path — this should point to the actual artifact JSON file
  const abiPath = path.join(
    __dirname,
    "../artifacts/contracts/UltraLightNode.sol/UltraLightNode.json"
  );
  const abi = JSON.parse(fs.readFileSync(abiPath, "utf8")).abi;

  const uln = new ethers.Contract(ulnAddress, abi, signer);
  console.log("📡 Calling setOracle...");

  const tx = await uln.setOracle(chainId, newOracle);
  console.log("⛓️ TX sent:", tx.hash);
  await tx.wait();
  console.log(`✅ Oracle for chain ${chainId} is now set to ${newOracle}`);
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
