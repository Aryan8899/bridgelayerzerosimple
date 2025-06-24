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

// Nonce management
let localNonce = null;

async function getNextNonce() {
  const networkNonce = await walletSrc.getTransactionCount("pending");
  
  if (localNonce === null || networkNonce > localNonce) {
    localNonce = networkNonce;
  }
  
  return localNonce;
}

function incrementNonce() {
  if (localNonce !== null) {
    localNonce++;
  }
}

// Track pending transactions to avoid duplicates
const pendingTxs = new Set();

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

async function sendTransactionWithRetry(txData, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const tx = await walletSrc.sendTransaction(txData);
      return tx;
    } catch (error) {
      if (error.code === 'SERVER_ERROR' && error.body && error.body.includes('already known')) {
        console.log(`⚠️ Transaction already known (nonce ${txData.nonce}), skipping...`);
        return null; // Transaction already submitted
      }
      
      if (error.code === 'NONCE_EXPIRED' || error.message.includes('nonce too low')) {
        console.log(`⚠️ Nonce too low, refreshing nonce and retrying... (attempt ${attempt + 1})`);
        // Reset local nonce to force refresh
        localNonce = null;
        txData.nonce = await getNextNonce();
        incrementNonce();
        continue;
      }
      
      if (attempt === maxRetries - 1) {
        throw error; // Last attempt, throw the error
      }
      
      console.log(`⚠️ Transaction failed (attempt ${attempt + 1}), retrying...`, error.message);
      await new Promise(r => setTimeout(r, 2000)); // Wait 2 seconds before retry
    }
  }
}

async function bundleDummyTxsInSameBlock() {
  const gasPrice = ethers.utils.parseUnits("30", "gwei");
  const currentNonce = await getNextNonce();

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

  // Create unique identifiers for transactions
  const tx1Hash = ethers.utils.keccak256(ethers.utils.RLP.encode([
    ethers.utils.hexlify(tx1.nonce),
    ethers.utils.hexlify(tx1.gasPrice),
    ethers.utils.hexlify(tx1.gasLimit),
    tx1.to,
    ethers.utils.hexlify(tx1.value),
    '0x'
  ]));
  const tx2Hash = ethers.utils.keccak256(ethers.utils.RLP.encode([
    ethers.utils.hexlify(tx2.nonce),
    ethers.utils.hexlify(tx2.gasPrice),
    ethers.utils.hexlify(tx2.gasLimit),
    tx2.to,
    ethers.utils.hexlify(tx2.value),
    '0x'
  ]));

  // Check if transactions are already pending
  if (pendingTxs.has(tx1Hash) || pendingTxs.has(tx2Hash)) {
    console.log('⚠️ Dummy transactions already pending, skipping...');
    return;
  }

  pendingTxs.add(tx1Hash);
  pendingTxs.add(tx2Hash);

  try {
    const signedTx1 = await walletSrc.signTransaction(tx1);
    const signedTx2 = await walletSrc.signTransaction(tx2);

    await sendTransactionWithRetry(tx1);
    await sendTransactionWithRetry(tx2);

    // Update local nonce
    localNonce = currentNonce + 2;

    console.log(`📤 Bundled dummy txs with nonce ${currentNonce} and ${currentNonce + 1}`);
    
    // Clean up pending transactions after some time
    setTimeout(() => {
      pendingTxs.delete(tx1Hash);
      pendingTxs.delete(tx2Hash);
    }, 60000); // Remove after 1 minute
    
  } catch (error) {
    pendingTxs.delete(tx1Hash);
    pendingTxs.delete(tx2Hash);
    console.error('❌ Failed to send dummy transactions:', error.message);
    throw error;
  }
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
      try {
        await bundleDummyTxsInSameBlock();
      } catch (error) {
        console.error(`❌ Failed to bundle dummy txs (attempt ${i + 1}):`, error.message);
        // Continue to next iteration instead of breaking
      }
      
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
  console.log("reciver add is", receiverAddr);
  console.log("the 2nd thins is ", blockHash);
  console.log("the proff bytes", proofBytes);

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
  } catch (error) {
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
  
  // Initialize nonce
  await getNextNonce();
  console.log(`🔧 Initial nonce: ${localNonce}`);
})();