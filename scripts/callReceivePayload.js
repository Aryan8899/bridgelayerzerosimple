const { ethers } = require("hardhat");

async function main() {
  const endpointAddress = "0x29590c5Cdb29060d14097A6EFaE9719D46b8B979"; // Sepolia Endpoint
  const senderAddress = "0x8e2c89d09E2d3B82564CE354187569CAd9cCF7F2";  // TAN Sender
  const receiverAddress = "0x20e737f36af470877D96778b68D9E42bA1509e5b"; // Sepolia Receiver

  const signer = (await ethers.getSigners())[0];
  const endpoint = await ethers.getContractAt("Endpoint", endpointAddress, signer);

  const srcChainId = 4442;
  const paddedSender = ethers.utils.hexZeroPad(senderAddress, 32); // 32-byte padded address
  const dstAddress = receiverAddress;
  const nonce = 1;
  const gasLimit = 500000;

 const user = ethers.utils.getAddress("0xc285d7192174486f038a4de931cb4f99ddaef4c3");

const payload = ethers.utils.defaultAbiCoder.encode(
  ["uint8", "address", "uint256"],
  [1, user, ethers.utils.parseEther("0.1")]
);


  console.log("Calling receivePayload...");
   await endpoint.callStatic.receivePayload(
    srcChainId,
    paddedSender,
    dstAddress,
    nonce,
    gasLimit,
    payload
  );

  console.log("✅ Transaction sent:", tx.hash);
  await tx.wait();
  console.log("🎉 Payload received successfully!");
}

main().catch((error) => {
  console.error("❌ Error:", error);
  process.exit(1);
});
