// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract WTAN is ERC20, Ownable {
    address public receiver;

    constructor(address _receiver) ERC20("Wrapped TAN", "WTAN") {
        receiver = _receiver;
    }

    function burn(address from, uint256 amount) external {
        _burn(from, amount);
    }

    function mintThroughReceiver(address to, uint256 amount) external {
        require(msg.sender == receiver, "Only receiver can mint");
        _mint(to, amount);
    }
}
