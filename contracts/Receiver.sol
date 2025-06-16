// SPDX-License-Identifier: MIT
pragma solidity ^0.7.6;

import { ILayerZeroReceiver } from "./interfaces/ILayerZeroReceiver.sol";
import "./WTAN.sol";

contract Receiver is ILayerZeroReceiver {
    WTAN public wtan;
    address public endpoint;

    constructor(address _wtan, address _endpoint) {
        wtan = WTAN(_wtan);
        endpoint = _endpoint;
    }

    modifier onlyEndpoint() {
        require(msg.sender == endpoint, "Unauthorized sender");
        _;
    }

    event NativeBridged(address indexed user, uint256 amount);
    event NativeUnwrapped(address indexed user, uint256 amount);

    // This function should be internal or private since only this contract should call it
    // and it should only be called from lzReceive
    function _mintWTAN(address to, uint256 amount) internal {
        wtan.mintThroughReceiver(to, amount);
    }

    function lzReceive(
        uint16, 
        bytes calldata, 
        uint64, 
        bytes calldata payload
    ) external override onlyEndpoint {
        (uint8 payloadType, address user, uint256 amount) = abi.decode(payload, (uint8, address, uint256));

        if (payloadType == 1) {
            // Native TAN -> WTAN: mint WTAN to user
            _mintWTAN(user, amount);
            emit NativeBridged(user, amount);
        } else if (payloadType == 2) {
            // WTAN -> Native TAN: send native TAN to user
            (bool success, ) = user.call{value: amount}("");
            require(success, "Native transfer failed");
            emit NativeUnwrapped(user, amount);
        } else {
            revert("Invalid payloadType");
        }
    }

    receive() external payable {}
}