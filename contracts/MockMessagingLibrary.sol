// SPDX-License-Identifier: MIT
pragma solidity ^0.7.6;

import "./interfaces/ILayerZeroMessagingLibrary.sol";

// MockMessagingLibrary.sol
contract MockMessagingLibrary is ILayerZeroMessagingLibrary {
    event MessageSent(address ua, uint64 nonce, uint16 dstChainId, bytes dst, bytes payload);
    event MessageDelivered(address ua, uint16 srcChainId, bytes src, uint64 nonce, bytes payload);

    function send(
        address _ua,
        uint64 _nonce,
        uint16 _dstChainId,
        bytes calldata _destination,
        bytes calldata _payload,
        address payable /* _refundAddress */,
        address /* _zroPaymentAddress */,
        bytes calldata /* _adapterParams */
    ) external payable override {
        emit MessageSent(_ua, _nonce, _dstChainId, _destination, _payload);
    }

    function setConfig(
        uint16 /* _chainId */,
        address /* _ua */,
        uint /* _configType */,
        bytes calldata /* _config */
    ) external override {}

    function getConfig(
        uint16 /* _chainId */,
        address /* _ua */,
        uint /* _configType */
    ) external pure override returns (bytes memory) {
        return "";
    }

    function estimateFees(
        uint16 /* _dstChainId */,
        address /* _ua */,
        bytes calldata /* _payload */,
        bool /* _payInZRO */,
        bytes calldata /* _adapterParams */
    ) external pure override returns (uint nativeFee, uint zroFee) {
        return (0, 0);
    }
}