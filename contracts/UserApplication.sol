// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.7.6;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/ILayerZeroEndpoint.sol";

contract UserApplication is Ownable {

    ILayerZeroEndpoint public endpoint;

    constructor(address _endpoint) {
        endpoint = ILayerZeroEndpoint(_endpoint);
    }

    // Function to set default app config
    function setDefaultConfig(
        uint16 _chainId,
        uint16 _inboundProofLibraryVersion,
        uint64 _inboundBlockConfirmations,
        address _relayer,
        uint16 _outboundProofType,
        uint64 _outboundBlockConfirmations,
        address _oracle
    ) external onlyOwner {
        // Ensure you're calling the correct function in the Endpoint contract
        // The Endpoint contract is responsible for defining setDefaultConfigForChainId
        (endpoint).setDefaultConfigForChainId( // Cast the endpoint to the correct implementation
            _chainId,
            _inboundProofLibraryVersion,
            _inboundBlockConfirmations,
            _relayer,
            _outboundProofType,
            _outboundBlockConfirmations,
            _oracle
        );
        emit DefaultConfigSet(_chainId, _relayer, _oracle);
    }

    // Event emitted once default config is set
    event DefaultConfigSet(
        uint16 indexed _chainId,
        address indexed _relayer,
        address indexed _oracle
    );
}
