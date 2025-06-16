
const { ethers, network } = require("hardhat");
const fs = require("fs");

async function deployWithGasEstimation(label, factory, args = [], overrides = {}) {
  const estimatedGas = await factory.signer.estimateGas(factory.getDeployTransaction(...args));
  const gasLimit = estimatedGas.mul(110).div(100); // Add 10% buffer
  const contract = await factory.deploy(...args, {
    ...overrides,
    gasLimit,
  });
  const receipt = await contract.deployTransaction.wait();
  console.log(`✅ ${label} deployed to: ${contract.address}`);
  console.log(`Gas used: ${receipt.gasUsed.toString()}`);
  return { contract, gasUsed: receipt.gasUsed };
}

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);
  console.log("Balance:", (await deployer.getBalance()).toString());

  const CHAIN_IDS = {
    sepolia: 10161,
    tan: 4442,
  };

  const currentNetwork = await ethers.provider.getNetwork();
  const lzChainId = currentNetwork.chainId === 11155111 ? CHAIN_IDS.sepolia : CHAIN_IDS.tan;
  const networkName = currentNetwork.chainId === 11155111 ? "sepolia" : "tan";

  const gasOverrides = {
    maxFeePerGas: ethers.utils.parseUnits("0.5", "gwei"),
    maxPriorityFeePerGas: ethers.utils.parseUnits("0.05", "gwei"),
  };

  const deploymentData = {
    contracts: {}
  };

  const MockLib = await ethers.getContractFactory("MockMessagingLibrary");
  const { contract: mockLib, gasUsed: g1 } = await deployWithGasEstimation("MockMessagingLibrary", MockLib, [], gasOverrides);
  deploymentData.contracts.library = mockLib.address;

  const Endpoint = await ethers.getContractFactory("Endpoint");
  const { contract: endpoint, gasUsed: g2 } = await deployWithGasEstimation("Endpoint", Endpoint, [lzChainId], gasOverrides);
  deploymentData.contracts.endpoint = endpoint.address;

  const UltraLightNode = await ethers.getContractFactory("UltraLightNode");
  const { contract: uln, gasUsed: g3 } = await deployWithGasEstimation("UltraLightNode", UltraLightNode, [endpoint.address], gasOverrides);
  deploymentData.contracts.uln = uln.address;

  const Relayer = await ethers.getContractFactory("Relayer");
  const { contract: relayer, gasUsed: g4 } = await deployWithGasEstimation("Relayer", Relayer, [], gasOverrides);
  deploymentData.contracts.relayer = relayer.address;

  const tx1 = await uln.setRelayer(relayer.address, gasOverrides);
  const rc1 = await tx1.wait();
  console.log(`✅ ULN setRelayer: Gas used: ${rc1.gasUsed.toString()}`);

  const tx2 = await endpoint.setULN(uln.address, gasOverrides);
  const rc2 = await tx2.wait();
  console.log(`✅ Endpoint linked to ULN: Gas used: ${rc2.gasUsed.toString()}`);

  // ✅ Deploy WTAN
  const WTAN = await ethers.getContractFactory("WTAN");
  const { contract: wtan, gasUsed: g5 } = await deployWithGasEstimation("WTAN", WTAN, [], gasOverrides);
  deploymentData.contracts.wtan = wtan.address;

  const totalGas = g1.add(g2).add(g3).add(g4).add(g5).add(rc1.gasUsed).add(rc2.gasUsed);
  const deploymentPath = `deployments/endpoint-${networkName}.json`;

  fs.mkdirSync("deployments", { recursive: true });
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentData, null, 2));
  console.log(`\n📦 Saved to: ${deploymentPath}`);
  console.log(`💸 Total estimated gas: ${totalGas.toString()}`);
  console.log(`💰 Total cost (ETH): ~${ethers.utils.formatUnits(totalGas.mul(gasOverrides.maxFeePerGas), "ether")} ETH`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});