// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

import { ILayerZeroEndpoint } from "./interfaces/ILayerZeroEndpoint.sol";

contract Sender {
    ILayerZeroEndpoint public endpoint;
    mapping(uint16 => address) public remotes;

    event Send(address indexed sender, uint64 nonce, uint16 dstChainId, bytes dstAddress, bytes payload);

    constructor(address _endpoint) {
        endpoint = ILayerZeroEndpoint(_endpoint);
    }

    function setRemote(uint16 _dstChainId, address _receiver) external {
        remotes[_dstChainId] = _receiver;
    }

    function getEndpoint() public view returns (address) {
        return address(endpoint);
    }

    function sendNativeToRemote(uint16 _dstChainId) external payable {
        require(msg.value > 0, "No TAN sent");
        require(remotes[_dstChainId] != address(0), "Remote not set");

        // 🔥 Burn TAN by sending to a burn address (irrecoverable)
        (bool success, ) = address(0x000000000000000000000000000000000000dEaD).call{value: msg.value}("");
        require(success, "Burn failed");

        // Prepare payload
        bytes memory payload = abi.encode(uint8(1), msg.sender, msg.value);

        // Fetch outbound nonce
        uint64 nonce = endpoint.getOutboundNonce(_dstChainId, address(this));

        // Send the payload with 0 value (already burned)
        endpoint.send{value: 0}(
            _dstChainId,
            abi.encodePacked(remotes[_dstChainId]),
            payload,
            msg.sender,
            address(0x0),
            bytes("")
        );

        emit Send(msg.sender, nonce, _dstChainId, abi.encodePacked(remotes[_dstChainId]), payload);
    }
}
