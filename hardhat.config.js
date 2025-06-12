require("@nomiclabs/hardhat-ethers");

module.exports = {
  solidity: "0.7.6",
  networks: {
    sepolia: {
      url: "https://eth-sepolia.g.alchemy.com/v2/B7X9gRjxfPZ9uOYogYWOy",
      accounts: ["2b12cb7d0171802df82fc69aca38ad8356343c91ec246a4b2e9d665a6206d4ee"]
    },
    tan: {
      url: "https://tan-devnetrpc2.tan.live",
      accounts: ["2b12cb7d0171802df82fc69aca38ad8356343c91ec246a4b2e9d665a6206d4ee"]
    }
  }
};

