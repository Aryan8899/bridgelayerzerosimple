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

  // Deploy MockMessagingLibrary
  const MockLib = await ethers.getContractFactory("MockMessagingLibrary");
  const { contract: mockLib, gasUsed: g1 } = await deployWithGasEstimation("MockMessagingLibrary", MockLib, [], gasOverrides);
  deploymentData.contracts.library = mockLib.address;

  // Deploy LayerZero Endpoint
  const Endpoint = await ethers.getContractFactory("Endpoint");
  const { contract: endpoint, gasUsed: g2 } = await deployWithGasEstimation("Endpoint", Endpoint, [lzChainId], gasOverrides);
  deploymentData.contracts.endpoint = endpoint.address;

  // Deploy NonceContract
  const NonceContract = await ethers.getContractFactory("NonceContract");
  const { contract: nonce, gasUsed: g7 } = await deployWithGasEstimation("NonceContract", NonceContract, [endpoint.address], gasOverrides);
  deploymentData.contracts.nonce = nonce.address;

  // Deploy UltraLightNodeV2
  const UltraLightNode = await ethers.getContractFactory("UltraLightNodeV2");
  const { contract: uln, gasUsed: g3 } = await deployWithGasEstimation("UltraLightNodeV2", UltraLightNode, [endpoint.address, nonce.address, lzChainId], gasOverrides);
  deploymentData.contracts.uln = uln.address;

  // Deploy RelayerV2
  const Relayer = await ethers.getContractFactory("RelayerV2");
  const { contract: relayer, gasUsed: g4 } = await deployWithGasEstimation("Relayer", Relayer, [], gasOverrides);
  deploymentData.contracts.relayer = relayer.address;

  // Deploy LayerZeroOracle
  const oracle = await ethers.getContractFactory("LayerZeroOracle");
  const { contract: LayerZeroOracle, gasUsed: g6 } = await deployWithGasEstimation("LayerZeroOracle", oracle, [], gasOverrides);
  deploymentData.contracts.oracle = LayerZeroOracle.address;

  // Deploy WTAN (Wrapped Token)
  const WTAN = await ethers.getContractFactory("WTAN");
  const { contract: wtan, gasUsed: g5 } = await deployWithGasEstimation("WTAN", WTAN, [], gasOverrides);
  deploymentData.contracts.wtan = wtan.address;

  const totalGas = g1.add(g2).add(g3).add(g4).add(g5).add(g6).add(g7);
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
