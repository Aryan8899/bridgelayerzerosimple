const { ethers } = require("ethers");
require("dotenv").config();
const fs = require("fs");

const DEST_RPC = "https://eth-sepolia.g.alchemy.com/v2/B7X9gRjxfPZ9uOYogYWOy";
const DEST_ENDPOINT_ADDRESS = "0x1C49F708E9C1D89212f143523391A3526162168F";
const APP_ADDRESS = "0x34f22b0E1870de47de1F4b5941887b6a65795B83";
const RELAYER_TO_ADD = "0x3C72718E557A3E60414B2a65D24b559BedcbF3F9";
const DEST_CHAIN_ID = 4442; // TAN chain ID
const CONFIG_TYPE_RELAYER = 3;

const endpointABI = JSON.parse(fs.readFileSync("./abis/Endpoint.json")).abi;
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, new ethers.providers.JsonRpcProvider(DEST_RPC));
const endpoint = new ethers.Contract(DEST_ENDPOINT_ADDRESS, endpointABI, wallet);

async function main() {
    console.log("🔐 Sender Wallet:", wallet.address);
    console.log("📍 Endpoint:", DEST_ENDPOINT_ADDRESS);
    console.log("📦 Relayer to whitelist:", RELAYER_TO_ADD);

    const encodedConfig = ethers.utils.defaultAbiCoder.encode(["address"], [RELAYER_TO_ADD]);

    const tx = await endpoint.setConfig(
        CONFIG_TYPE_RELAYER, // configType (3)
        DEST_CHAIN_ID,       // dstChainId (uint16)
        APP_ADDRESS,         // app address
        encodedConfig        // config
    );

    console.log("📤 Tx submitted:", tx.hash);
    await tx.wait();
    console.log("✅ Relayer whitelisted successfully!");
}

main().catch((e) => console.error("❌ Error:", e));
