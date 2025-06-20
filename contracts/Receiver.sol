// SPDX-License-Identifier: MIT
pragma solidity ^0.7.6;

import { ILayerZeroReceiver } from "./interfaces/ILayerZeroReceiver.sol";
import { ILayerZeroEndpoint } from "./interfaces/ILayerZeroEndpoint.sol";
import "./WTAN.sol";

contract Receiver is ILayerZeroReceiver {
    WTAN public wtan;
    address public endpoint;
    address public owner;

    constructor(address _wtan, address _endpoint) {
        wtan = WTAN(_wtan);
        endpoint = _endpoint;
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this");
        _;
    }

    modifier onlyEndpoint() {
        require(msg.sender == endpoint, "Unauthorized sender");
        _;
    }

    event NativeBridged(address indexed user, uint256 amount);
    event NativeUnwrapped(address indexed user, uint256 amount);

    /// @notice Called by the app owner to whitelist a relayer
    function whitelistRelayer(
        address _endpoint,
        uint16 dstChainId,
        address relayer
    ) external onlyOwner {
        bytes memory config = abi.encode(relayer);
        ILayerZeroEndpoint(_endpoint).setConfig(
            3, // CONFIG_TYPE_RELAYER
            dstChainId,
uint256(uint160(address(this))),

            config
        );
    }

    /// @notice Called by LayerZero endpoint to mint WTAN or unwrap native
    function lzReceive(
        uint16,              // _srcChainId
        bytes calldata,      // _srcAddress
        uint64,              // _nonce
        bytes calldata payload
    ) external override onlyEndpoint {
        (uint8 payloadType, address user, uint256 amount) = abi.decode(payload, (uint8, address, uint256));

        if (payloadType == 1) {
            wtan.mint(user, amount);
            emit NativeBridged(user, amount);
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
