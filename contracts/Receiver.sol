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
    

    event DebugPayload(uint8 payloadType, address user, uint256 amount);
event LzReceiveTriggered();

function lzReceive(
    uint16, bytes calldata, uint64, bytes calldata payload
) external override onlyEndpoint {
    emit LzReceiveTriggered();

    (uint8 payloadType, address user, uint256 amount) = abi.decode(payload, (uint8, address, uint256));
    emit DebugPayload(payloadType, user, amount);

    if (payloadType == 1) {
        try wtan.mintTo(user, amount) {
            emit NativeBridged(user, amount);
        } catch Error(string memory reason) {
            revert(string(abi.encodePacked("Mint failed: ", reason)));
        } catch {
            revert("Mint failed: unknown error");
        }
    } else if (payloadType == 2) {
        (bool success, ) = user.call{value: amount}("");
        require(success, "Native transfer failed");
        emit NativeUnwrapped(user, amount);
    } else {
        revert("Invalid payloadType");
    }
}


    receive() external payable {}
}
