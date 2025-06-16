// SPDX-License-Identifier: MIT
pragma solidity ^0.7.6;

import { ILayerZeroReceiver } from "./interfaces/ILayerZeroReceiver.sol";
import "./WTAN.sol";

contract Receiver is ILayerZeroReceiver {
    WTAN public wtan;
    address public endpoint;
    address public owner;

    constructor(address _wtan, address _endpoint) {
        wtan = WTAN(_wtan);
        endpoint = _endpoint;
        owner = msg.sender;  // Assign the deployer as the owner
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

    // Internal mint function - only callable by this contract
    function _mintWTAN(address to, uint256 amount) internal {
        wtan.mint(to, amount);
    }

    function lzReceive(
        uint16, bytes calldata, uint64, bytes calldata payload
    ) external override onlyEndpoint {
        (uint8 payloadType, address user, uint256 amount) = abi.decode(payload, (uint8, address, uint256));

        if (payloadType == 1) {
            // TAN → Sepolia: mint WTAN
            _mintWTAN(user, amount);
            emit NativeBridged(user, amount);
        } else if (payloadType == 2) {
            // Sepolia → TAN: unwrap WTAN and send native
            (bool success, ) = user.call{value: amount}("");
            require(success, "Native transfer failed");
            emit NativeUnwrapped(user, amount);
        } else {
            revert("Invalid payloadType");
        }
    }

    // Emergency mint function (only for testing or special cases)
    function emergencyMint(address to, uint256 amount) external {
        // Add your access control here if needed
        // For example: require(msg.sender == owner, "Only owner");
        _mintWTAN(to, amount);
    }

    receive() external payable {}

    // Function to set the minter after deployment
    function initialize() external onlyOwner {
        wtan.setMinter(address(this));  // Set this contract as the minter for WTAN
    }
}
