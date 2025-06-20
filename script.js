const ethers = require("ethers");

const action = 1;  // e.g., 1 = mint
const user = "0xc285D7192174486f038A4de931cb4F99DdaeF4C3";
const amount = ethers.utils.parseEther("0.001"); // or whatever value

const payload = ethers.utils.defaultAbiCoder.encode(
  ["uint8", "address", "uint256"],
  [action, user, amount]
);

console.log("Encoded payload:", payload);
