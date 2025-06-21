const { ethers } = require("ethers");
const fs = require("fs");
require("dotenv").config();
const { Trie } = require("@ethereumjs/trie");
const { TransactionFactory } = require("@ethereumjs/tx");
const { submitBlockHash } = require("./oracle");

const SRC_RPC = "https://tan-devnetrpc2.tan.live";
const DST_RPC = "https://eth-sepolia.g.alchemy.com/v2/B7X9gRjxfPZ9uOYogYWOy";
const PRIVATE_KEY = process.env.PRIVATE_KEY;

const senderABI = require("./abis/Sender.json").abi;
const endpointABI = require("./abis/Endpoint.json").abi;
const ulnABI = require("./abis/UltraLightNode.json").abi;

const tanData = JSON.parse(fs.readFileSync("deployments/endpoint-tan.json"));
const sepData = JSON.parse(fs.readFileSync("deployments/endpoint-sepolia.json"));
const senderAddr = tanData.contracts.sender;
const endpointDstAddr = sepData.contracts.endpoint;
const ulnAddress = sepData.contracts.uln;
const receiverAddr = sepData.contracts.receiver;

const provSrc = new ethers.providers.JsonRpcProvider(SRC_RPC);
const walletSrc = new ethers.Wallet(PRIVATE_KEY, provSrc);
const walletDst = new ethers.Wallet(PRIVATE_KEY, new ethers.providers.JsonRpcProvider(DST_RPC));
const sender = new ethers.Contract(senderAddr, senderABI, provSrc);
const endpointDst = new ethers.Contract(endpointDstAddr, endpointABI, walletDst);
const uln = new ethers.Contract(ulnAddress, ulnABI, walletDst);

function encodeIndex(index) {
  if (index === 0) return Buffer.from([0x80]);
  if (index < 128) return Buffer.from([index]);
  const hex = index.toString(16);
  const paddedHex = hex.length % 2 === 0 ? hex : '0' + hex;
  const bytes = Buffer.from(paddedHex, 'hex');
  return Buffer.concat([Buffer.from([0x80 + bytes.length]), bytes]);
}

function serializeTx(txData) {
  const cleanTxData = {
    nonce: txData.nonce,
    gasLimit: txData.gas,
    to: txData.to,
    value: txData.value,
    data: txData.input,
    chainId: txData.chainId,
    v: txData.v,
    r: txData.r,
    s: txData.s
  };

  if (txData.type === '0x2' || txData.type === 2) {
    cleanTxData.type = 2;
    cleanTxData.maxFeePerGas = txData.maxFeePerGas;
    cleanTxData.maxPriorityFeePerGas = txData.maxPriorityFeePerGas;
    cleanTxData.accessList = txData.accessList || [];
  } else {
    cleanTxData.type = 0;
    cleanTxData.gasPrice = txData.gasPrice;
  }

  return TransactionFactory.fromTxData(cleanTxData).serialize();
}

async function getGasParams() {
  const feeData = await walletDst.provider.getFeeData();
  return feeData.maxFeePerGas && feeData.maxPriorityFeePerGas
    ? { type: 2, maxFeePerGas: feeData.maxFeePerGas, maxPriorityFeePerGas: feeData.maxPriorityFeePerGas }
    : { type: 0, gasPrice: feeData.gasPrice || ethers.utils.parseUnits("30", "gwei") };
}

let lastNonceUsed = null;

async function bundleDummyTxsInSameBlock() {
  const gasPrice = ethers.utils.parseUnits("30", "gwei");
  const currentNonce = await walletSrc.getTransactionCount("pending"); // <-- MOVE this INSIDE function call

  const tx1 = {
    to: walletSrc.address,
    value: ethers.utils.parseEther("0.00001"),
    gasLimit: 21000,
    gasPrice,
    nonce: currentNonce,
    type: 0,
  };

  const tx2 = {
    to: walletSrc.address,
    value: ethers.utils.parseEther("0.00002"),
    gasLimit: 21000,
    gasPrice,
    nonce: currentNonce + 1,
    type: 0,
  };

  const signedTx1 = await walletSrc.signTransaction(tx1);
  const signedTx2 = await walletSrc.signTransaction(tx2);

  await provSrc.sendTransaction(signedTx1);
  await provSrc.sendTransaction(signedTx2);

  console.log(`📤 Bundled dummy txs with nonce ${currentNonce} and ${currentNonce + 1}`);
}



sender.on("Send", async (...args) => {
  const event = args[args.length - 1];
  const { sender: from, nonce, dstChainId, dstAddress: to, payload } = event.args;
  const txHash = event.transactionHash;

  console.log("📨 New message TX:", txHash);
  const receipt = await provSrc.getTransactionReceipt(txHash);
  const initialBlock = await provSrc.getBlock(receipt.blockNumber);

  let block = initialBlock;

  if (block.transactions.length < 2) {
    console.warn(`⚠️ Block ${block.number} has ${block.transactions.length} txs. Sending bundled dummy txs...`);
    let found = false;

    for (let i = 0; i < 10; i++) {
      await bundleDummyTxsInSameBlock();
      console.log("⏳ Waiting 15s for new block...");
      await new Promise(r => setTimeout(r, 15000));

      const newBlock = await provSrc.getBlock("latest");
      if (newBlock.transactions.length >= 2) {
        block = newBlock;
        console.log(`✅ Found block with >=2 txs: ${block.number}`);
        found = true;
        break;
      }
    }

    if (!found) {
      console.error("❌ Could not get a block with >=2 txs.");
      return;
    }
  }

  const blockHash = block.hash;
  const confirmations = await provSrc.getBlockNumber() - block.number;
  if (confirmations < 3) {
    console.log("⏳ Waiting for 3 confirmations...");
    await new Promise(r => setTimeout(r, 30000));
  }

  const timestamp = block.timestamp;
  await submitBlockHash(4442, block.number, blockHash, timestamp);

  const raw = await provSrc.send("eth_getBlockByNumber", [ethers.utils.hexValue(block.number), true]);
  const serializedTxs = raw.transactions.map(serializeTx);
  const trie = new Trie();
  for (let i = 0; i < serializedTxs.length; i++) {
    await trie.put(encodeIndex(i), serializedTxs[i]);
  }

  const proof = await trie.createProof(encodeIndex(receipt.transactionIndex));
  let proofBytes = ethers.utils.RLP.encode(proof);
  let gasParams = await getGasParams();

  console.log("trans");
  console.log(block.transactions.length);
  console.log("reciver add is",receiverAddr);
  console.log("the 2nd thins is ",blockHash);
  console.log("the proff bytes",proofBytes);

  try {
    const tx = await uln.validateTransactionProof(
      4442,
      receiverAddr,
      500000,
      blockHash,
      proofBytes,
      { gasLimit: 2_000_000, ...gasParams }
    );
    await tx.wait();
  } catch {
  console.warn("⚠️ RLP failed — trying encoded fallback...");
const fallbackProof = proof.map(p => ethers.utils.hexlify(p));
proofBytes = ethers.utils.RLP.encode(fallbackProof);
const tx = await uln.validateTransactionProof(
  4442,
  receiverAddr,
  500000,
  blockHash,
  proofBytes,
  { gasLimit: 2_000_000, ...await getGasParams() }
);
await tx.wait();


  }

  const rx = await endpointDst.receivePayload(4442, from, receiverAddr, nonce, payload, {
    gasLimit: 2_000_000,
    ...await getGasParams()
  });
  await rx.wait();
  console.log("✅ Payload delivered to Receiver UA");
});

(async () => {
  console.log("🟢 Relayer bot running…");
  console.log("🔧 Configuration:");
  console.log("  - Source Chain:", SRC_RPC);
  console.log("  - Destination Chain:", DST_RPC);
  console.log("  - Sender Address:", senderAddr);
  console.log("  - Receiver Address:", receiverAddr);
  console.log("  - ULN Address:", ulnAddress);
  console.log("  - Endpoint Address:", endpointDstAddr);
})();
