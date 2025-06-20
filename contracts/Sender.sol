// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

import { ILayerZeroEndpoint } from "./interfaces/ILayerZeroEndpoint.sol";

contract Sender {
    ILayerZeroEndpoint public endpoint;
    mapping(uint16 => address) public remotes;

    event Send(address indexed sender, uint64 nonce, uint16 dstChainId, bytes dstAddress, bytes payload); // ADD THIS

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

        bytes memory payload = abi.encode(uint8(1), msg.sender, msg.value);

        uint64 nonce = endpoint.getOutboundNonce(_dstChainId, address(this)); // GET NONCE

        endpoint.send{value: msg.value}(
            _dstChainId,
            abi.encodePacked(remotes[_dstChainId]),
            payload,
            msg.sender,
            address(0x0),
            bytes("")
        );

        emit Send(msg.sender, nonce, _dstChainId, abi.encodePacked(remotes[_dstChainId]), payload); // EMIT IT
    }
}
