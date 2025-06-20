const { ethers } = require("ethers");
const fs = require("fs");
require("dotenv").config();
const { Trie } = require("@ethereumjs/trie");
const { TransactionFactory } = require("@ethereumjs/tx");

// === Config ===
const SRC_RPC = "https://tan-devnetrpc2.tan.live";
const DST_RPC = "https://eth-sepolia.g.alchemy.com/v2/B7X9gRjxfPZ9uOYogYWOy";
const PRIVATE_KEY = process.env.PRIVATE_KEY;

// === Load ABIs & Deployment Info ===
const senderABI = require("./abis/Sender.json").abi;
const endpointABI = require("./abis/Endpoint.json").abi;
const ulnABI = require("./abis/UltraLightNode.json").abi;

const tanData = JSON.parse(fs.readFileSync("deployments/endpoint-tan.json"));
const sepData = JSON.parse(fs.readFileSync("deployments/endpoint-sepolia.json"));
const senderAddr = tanData.contracts.sender;
const endpointDstAddr = sepData.contracts.endpoint;
const ulnAddress = sepData.contracts.uln;
const receiverAddr = sepData.contracts.receiver;

// === Setup Providers & Contracts ===
const provSrc = new ethers.providers.JsonRpcProvider(SRC_RPC);
const walletDst = new ethers.Wallet(PRIVATE_KEY, new ethers.providers.JsonRpcProvider(DST_RPC));
const sender = new ethers.Contract(senderAddr, senderABI, provSrc);
const endpointDst = new ethers.Contract(endpointDstAddr, endpointABI, walletDst);
const uln = new ethers.Contract(ulnAddress, ulnABI, walletDst);

// === Logger ===
console.log("🟢 Relayer bot running…");

// === Helper Functions ===
function encodeIndex(index) {
  if (index === 0) return Buffer.from([0x80]);
  if (index < 128) return Buffer.from([index]);
  const hex = index.toString(16);
  const paddedHex = hex.length % 2 === 0 ? hex : '0' + hex;
  return Buffer.from(paddedHex, 'hex');
}

function serializeTx(txData) {
  const tx = TransactionFactory.fromTxData({
    nonce: txData.nonce,
    gasLimit: txData.gas,
    to: txData.to,
    value: txData.value,
    data: txData.input,
    v: txData.v,
    r: txData.r,
    s: txData.s,
    type: txData.type,
    gasPrice: txData.gasPrice,
    maxFeePerGas: txData.maxFeePerGas,
    maxPriorityFeePerGas: txData.maxPriorityFeePerGas,
    chainId: txData.chainId,
  });
  return tx.serialize();
}

// === Get Dynamic Gas Prices ===
async function getGasParams() {
  try {
    const provider = walletDst.provider;
    const feeData = await provider.getFeeData();
    
    // Increase gas prices by 20% to avoid replacement issues
    const gasPrice = feeData.gasPrice ? feeData.gasPrice.mul(120).div(100) : null;
    const maxFeePerGas = feeData.maxFeePerGas ? feeData.maxFeePerGas.mul(120).div(100) : null;
    const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas ? feeData.maxPriorityFeePerGas.mul(120).div(100) : null;

    // EIP-1559 transaction (preferred)
    if (maxFeePerGas && maxPriorityFeePerGas) {
      return {
        maxFeePerGas,
        maxPriorityFeePerGas,
        type: 2
      };
    }
    
    // Legacy transaction fallback
    return {
      gasPrice: gasPrice || ethers.utils.parseUnits("20", "gwei"),
      type: 0
    };
  } catch (error) {
    console.warn("⚠️ Could not fetch gas prices, using defaults");
    return {
      gasPrice: ethers.utils.parseUnits("20", "gwei"),
      type: 0
    };
  }
}

// === Event Listener ===
sender.on("Send", async (...args) => {
  const event = args[args.length - 1];
  const { sender: from, nonce, dstChainId, dstAddress: to, payload } = event.args;

  console.log("📨 New message TX:", event.transactionHash);

  try {
    const txHash = event.transactionHash;
    const receipt = await provSrc.getTransactionReceipt(txHash);
    const blockNum = receipt.blockNumber;

    const raw = await provSrc.send("eth_getBlockByNumber", [
      ethers.utils.hexValue(blockNum), true
    ]);

    // Step 1: Create proof
    const serializedTxs = raw.transactions.map(serializeTx);
    const trie = new Trie();
    for (let idx = 0; idx < serializedTxs.length; idx++) {
      await trie.put(encodeIndex(idx), serializedTxs[idx]);
    }

    const txIndex = receipt.transactionIndex;
    const proof = await trie.createProof(encodeIndex(txIndex));
    const proofBytes = ethers.utils.concat(proof.map(p => ethers.utils.hexlify(p)));

    console.log(`🔍 Generated proof with ${proof.length} nodes`);
    console.log("BlockHash:", receipt.blockHash);
    console.log("UA (from):", from);
    console.log("Nonce:", nonce.toString());
    console.log("Payload (hex):", ethers.utils.hexlify(payload));
    console.log("Proof (hex):", ethers.utils.hexlify(proofBytes));

    // Get current gas parameters
    const gasParams = await getGasParams();

    // Step 2: Validate transaction proof on ULN
    const validateTx = await uln.validateTransactionProof(
      dstChainId,
      receiverAddr,
      500000,
      receipt.blockHash,
      proofBytes,
      { 
        gasLimit: 1_000_000,
        ...gasParams
      }
    );
    await validateTx.wait();
    console.log("✅ Proof validated on ULN");

    // Wait a bit to avoid nonce conflicts
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Get fresh gas params for second transaction
    const gasParams2 = await getGasParams();

    // Step 3: Deliver payload to receiver
    const rx = await endpointDst.receivePayload(
      dstChainId,
      from,           // ✅ Correct srcUA
      receiverAddr,
      nonce,
      payload,
      { 
        gasLimit: 1_000_000,
        ...gasParams2
      }
    );
    await rx.wait();
    console.log("✅ Payload delivered to Receiver UA");

  } catch (err) {
    console.error("❌ Relay failed:", err.message || err);
    if (err.code === 'REPLACEMENT_UNDERPRICED') {
      console.error("💡 Tip: This usually means there's a pending transaction with the same nonce");
      console.error("   Wait for pending transactions to complete or increase gas prices");
    }
    if (err.stack) console.error("Stack:", err.stack);
  }
});

// Add graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down relayer bot...');
  process.exit(0);
});