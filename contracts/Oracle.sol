// SPDX-License-Identifier: MIT
pragma solidity ^0.7.6;
pragma abicoder v2;

contract Oracle {
    struct BlockData {
        bytes32 blockHash;
        uint256 confirmations; // Use block.number - blockNumber to determine confirmations
    }

    // Mapping: chainId => lookupHash => BlockData
    mapping(uint16 => mapping(bytes32 => BlockData)) public hashLookup;

    address public owner;
    mapping(address => bool) public relayers;

    event BlockSubmitted(uint16 indexed chainId, bytes32 indexed lookupHash, bytes32 blockHash, uint256 confirmations);

    modifier onlyRelayer() {
        require(relayers[msg.sender], "Not approved relayer");
        _;
    }

    constructor() {
        owner = msg.sender;
        relayers[msg.sender] = true;
    }

    function setRelayer(address relayer, bool approved) external {
        require(msg.sender == owner, "Only owner");
        relayers[relayer] = approved;
    }

    function submitBlock(
        uint16 srcChainId,
        bytes32 blockHash,
        uint256 blockNumber
    ) external onlyRelayer {
        bytes32 lookupHash = keccak256(abi.encode(blockHash, blockNumber));
        hashLookup[srcChainId][lookupHash] = BlockData({
            blockHash: blockHash,
            confirmations: block.number
        });

        emit BlockSubmitted(srcChainId, lookupHash, blockHash, block.number);
    }

    function getBlockData(uint16 chainId, bytes32 lookupHash) external view returns (BlockData memory) {
        return hashLookup[chainId][lookupHash];
    }
}
