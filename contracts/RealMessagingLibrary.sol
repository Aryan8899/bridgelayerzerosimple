// SPDX-License-Identifier: MIT
pragma solidity ^0.7.6;

import "./interfaces/ILayerZeroMessagingLibrary.sol";

contract RealMessagingLibrary is ILayerZeroMessagingLibrary {
    address public endpoint;

    constructor(address _endpoint) {
        endpoint = _endpoint;
    }

    function send(
        address sender,
        uint64 nonce,
        uint16 dstChainId,
        bytes calldata destination,
        bytes calldata payload,
        address payable, // refundAddress
        address,         // zroPaymentAddress
        bytes calldata   // adapterParams
    ) external payable override {
        emit MessageSent(sender, dstChainId, nonce);
        // Bot watches for this event and acts accordingly
    }

    function estimateFees(
        uint16, address, bytes calldata, bool, bytes calldata
    ) external pure override returns (uint nativeFee, uint zroFee) {
        return (0, 0);
    }

    function getConfig(
        uint16, address, uint
    ) external pure override returns (bytes memory) {
        return "";
    }

    function setConfig(
        uint16, address, uint, bytes calldata
    ) external pure override {}

    event MessageSent(
        address indexed sender,
        uint16 indexed dstChainId,
        uint64 nonce
    );
}
