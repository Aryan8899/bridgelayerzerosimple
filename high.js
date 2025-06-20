const { ethers } = require("ethers");

const provider = new ethers.providers.JsonRpcProvider("https://tan-devnetrpc2.tan.live");
const endpointAddress = "0x412bD51F397b951214E04021a2352d8AdB7c3B1B";

const abi = [ "event Send(address indexed sender, uint256 nonce, uint16 dstChainId, bytes dstAddress, bytes payload)" ];

const contract = new ethers.Contract(endpointAddress, abi, provider);

async function main() {
    const latestBlock = await provider.getBlockNumber();
    const logs = await contract.queryFilter("Send", latestBlock - 10, latestBlock);
    console.log("Send events:", logs.length);
    logs.forEach(log => console.log(log));
}

main();
