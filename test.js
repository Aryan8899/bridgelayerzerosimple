const { ethers } = require("ethers");
const provider = new ethers.providers.JsonRpcProvider("https://tan-devnetrpc2.tan.live");
provider.getBlockNumber().then(console.log).catch(console.error);
