// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.7.6;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/ILayerZeroOracle.sol";
import "./interfaces/ILayerZeroUltraLightNodeV1.sol";

contract LayerZeroOracle is ILayerZeroOracle, Ownable, ReentrancyGuard {
    mapping(address => bool) public approvedAddresses;
    mapping(uint16 => mapping(uint16 => uint)) public chainPriceLookup;
    uint public fee;
    ILayerZeroUltraLightNodeV1 public uln; // ultraLightNode instance

    event OracleNotified(uint16 dstChainId, uint16 _outboundProofType, uint blockConfirmations);
    event Withdraw(address to, uint amount);

    constructor() {
        approvedAddresses[msg.sender] = true;
    }

    // Notify Oracle when new data is received
    function notifyOracle(uint16 _dstChainId, uint16 _outboundProofType, uint64 _outboundBlockConfirmations) external override {
        emit OracleNotified(_dstChainId, _outboundProofType, _outboundBlockConfirmations);
    }

    // Update the hash of a specific block for cross-chain data
    function updateHash(uint16 _remoteChainId, bytes32 _blockHash, uint _confirmations, bytes32 _data) external {
        require(approvedAddresses[msg.sender], "LayerZeroOracle: caller must be approved");
        // Use updated variable names for clarity
        uln.updateHash(_remoteChainId, _blockHash, _confirmations, _data);
    }

    // Withdraw funds from the Oracle contract
    function withdraw(address payable _to, uint _amount) public onlyOwner nonReentrant {
        (bool success, ) = _to.call{value: _amount}("");
        require(success, "failed to withdraw");
        emit Withdraw(_to, _amount);
    }

    // Set the UltraLightNode contract address
    function setUln(address ulnAddress) external onlyOwner {
        uln = ILayerZeroUltraLightNodeV1(ulnAddress);
    }

    // Set an approved Oracle address
    function setApprovedAddress(address _oracleAddress, bool _approve) external {
        approvedAddresses[_oracleAddress] = _approve;
    }

    // Return the price for a given destination chain and outbound proof type
    function getPrice(uint16 _destinationChainId, uint16 _outboundProofType) external view override returns (uint) {
        return chainPriceLookup[_outboundProofType][_destinationChainId];
    }

    // Check if an address is approved to interact with the Oracle contract
    function isApproved(address _address) external view override returns (bool) {
        return approvedAddresses[_address];
    }

    fallback() external payable {}

    receive() external payable {}
}
