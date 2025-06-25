// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

import { ILayerZeroEndpoint } from "./interfaces/ILayerZeroEndpoint.sol";
import "./WTAN.sol";

contract Sender {
    ILayerZeroEndpoint public endpoint;
    WTAN public wtan;
    mapping(uint16 => address) public remotes;

    // FIXED: Add event declaration
    event Send(address indexed sender, uint64 nonce, uint16 dstChainId, address dstAddress, bytes payload);

    constructor(address _endpoint, address _wtan) {
        endpoint = ILayerZeroEndpoint(_endpoint);
        wtan = WTAN(_wtan);
    }

    function setRemote(uint16 _dstChainId, address _receiver) external {
        remotes[_dstChainId] = _receiver;
    }

    function getEndpoint() public view returns (address) {
        return address(endpoint);
    }

    // Send arbitrary message
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

    // FIXED: Native TAN → WTAN (payloadType = 1) - match the test call
    function sendNativeToRemote(uint16 _dstChainId) external payable {
        require(msg.value > 0, "No TAN sent");
        require(remotes[_dstChainId] != address(0), "Remote not set");

        bytes memory payload = abi.encode(uint8(1), msg.sender, msg.value);

        // FIXED: Emit the Send event that your bot is listening for
        emit Send(msg.sender, 0, _dstChainId, remotes[_dstChainId], payload);

        endpoint.send{value: msg.value}(
            _dstChainId,
            abi.encodePacked(remotes[_dstChainId]),
            payload,
            msg.sender,
            address(0x0),
            bytes("")
        );
    }

    // WTAN → Native TAN (payloadType = 2)
    function bridgeWTANTo(uint16 _dstChainId, uint256 amount) external {
        require(remotes[_dstChainId] != address(0), "Remote not set");

        wtan.transferFrom(msg.sender, address(this), amount);
        wtan.burn(address(this), amount);

        bytes memory payload = abi.encode(uint8(2), msg.sender, amount);

        // FIXED: Emit the Send event that your bot is listening for
        emit Send(msg.sender, 0, _dstChainId, remotes[_dstChainId], payload);

        endpoint.send{value: 0}(
            _dstChainId,
            abi.encodePacked(remotes[_dstChainId]),
            payload,
            msg.sender,
            address(0x0),
            bytes("")
        );
    }
}