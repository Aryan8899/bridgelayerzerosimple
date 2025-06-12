// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

import { ILayerZeroEndpoint } from "./interfaces/ILayerZeroEndpoint.sol";

contract Sender {
    ILayerZeroEndpoint public endpoint;
    mapping(uint16 => address) public remotes;  // <-- uint16

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
            msg.sender,
            address(0x0),
            bytes("")
        );
    }
}
