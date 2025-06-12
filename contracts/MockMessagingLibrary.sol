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

// Receiver.sol
import { ILayerZeroReceiver } from "./interfaces/ILayerZeroReceiver.sol";

contract Receiver is ILayerZeroReceiver {
    event ReceivedMessage(uint16 srcChainId, address from, bytes payload);

    function lzReceive(
        uint16 _srcChainId,
        bytes calldata _srcAddress,
        uint64 _nonce,
        bytes calldata _payload
    ) external override {
        // Convert LayerZero address (bytes) to normal address
        address from = address(uint160(uint256(keccak256(_srcAddress))));
        emit ReceivedMessage(_srcChainId, from, _payload);
    }
}

// Sender.sol
import { ILayerZeroEndpoint } from "./interfaces/ILayerZeroEndpoint.sol";

contract Sender {
    ILayerZeroEndpoint public endpoint;
    mapping(uint16 => address) public remotes;

    constructor(address _endpoint) {
        endpoint = ILayerZeroEndpoint(_endpoint);
    }

    function setRemote(uint16 _dstChainId, address _receiver) external {
        remotes[_dstChainId] = _receiver;
    }

    function getEndpoint() public view returns (address) {
        return address(endpoint);
    }

    function sendMessage(uint16 _dstChainId, bytes calldata _message) external payable {
        require(remotes[_dstChainId] != address(0), "Remote not set");

        endpoint.send{value: msg.value}(
            _dstChainId,
            abi.encodePacked(remotes[_dstChainId]),
            _message,
            payable(msg.sender),
            address(0x0),
            bytes("")
        );
    }
}