const { ethers } = require("hardhat");

async function main() {
  const signer = (await ethers.getSigners())[0];
  console.log("🔑 Using account:", signer.address);

  const oracleAddress = "0x3e262F8bB827235c658012Fe6eCa420927823EBB"; // Your Oracle address for Sepolia
  const encodedOracleConfig = ethers.utils.defaultAbiCoder.encode(
    ['address'],
    [oracleAddress]
  );
  
  // Set the Oracle config for Sepolia (chainId 10161)
 
  console.log(encodedOracleConfig)
  
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });