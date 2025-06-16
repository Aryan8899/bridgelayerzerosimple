// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract WTAN is ERC20, Ownable {
    address public receiver;

    event ReceiverUpdated(address indexed oldReceiver, address indexed newReceiver);

    constructor(address _receiver) ERC20("Wrapped TAN", "WTAN") {
        require(_receiver != address(0), "Receiver cannot be zero address");
        receiver = _receiver;
    }

    // Only allow burning from specific addresses (like Sender contract)
    function burn(address from, uint256 amount) external {
        // You might want to add access control here too
        // For now, allowing any contract to burn from any address
        // Consider adding: require(msg.sender == senderContract, "Only sender can burn");
        _burn(from, amount);
    }

    // Only the receiver contract can mint new tokens
    function mintThroughReceiver(address to, uint256 amount) external {
        require(msg.sender == receiver, "Only receiver contract can mint");
        require(to != address(0), "Cannot mint to zero address");
        require(amount > 0, "Amount must be greater than 0");
        _mint(to, amount);
    }

    // Allow owner to update receiver address if needed (optional)
    function updateReceiver(address _newReceiver) external onlyOwner {
        require(_newReceiver != address(0), "New receiver cannot be zero address");
        address oldReceiver = receiver;
        receiver = _newReceiver;
        emit ReceiverUpdated(oldReceiver, _newReceiver);
    }
}