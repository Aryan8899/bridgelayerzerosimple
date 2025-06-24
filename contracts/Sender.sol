// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

import { ILayerZeroEndpoint } from "./interfaces/ILayerZeroEndpoint.sol";
import "./WTAN.sol";

contract Sender {
    ILayerZeroEndpoint public endpoint;
    mapping(uint16 => address) public remotes;
    WTAN public wtan;  // WTAN token contract

    event Send(address indexed sender, uint64 nonce, uint16 dstChainId, bytes dstAddress, bytes payload);

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

    function sendNativeToRemote(uint16 _dstChainId, uint256 _amount) external payable {
        require(msg.value > 0, "No TAN sent");
        require(remotes[_dstChainId] != address(0), "Remote not set");

        // 🔥 Burn TAN tokens by calling burn on the WTAN token contract
        wtan.burn(msg.sender, _amount);

        // Prepare payload (sender address and amount)
        bytes memory payload = abi.encode(uint8(1), msg.sender, _amount);

        // Fetch outbound nonce for LayerZero
        uint64 nonce = endpoint.getOutboundNonce(_dstChainId, address(this));

        // Send the payload with zero value (already burned tokens)
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
