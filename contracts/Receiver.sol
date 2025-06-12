// SPDX-License-Identifier: MIT
pragma solidity ^0.7.6;

import { ILayerZeroReceiver } from "./interfaces/ILayerZeroReceiver.sol";

contract Receiver is ILayerZeroReceiver {
    string public lastReceivedMessage;

    event ReceivedMessage(uint16 srcChainId, address from, string message);

    function lzReceive(
        uint16 _srcChainId,
        bytes calldata _srcAddress,
        uint64 _nonce,
        bytes calldata _payload
    ) external override {
        // Convert LayerZero address (bytes) to address
        address from = address(uint160(uint256(keccak256(_srcAddress))));

        // Decode the payload from bytes to string
        string memory message = abi.decode(_payload, (string));

        // Store and emit decoded message
        lastReceivedMessage = message;
        emit ReceivedMessage(_srcChainId, from, message);
    }
}
