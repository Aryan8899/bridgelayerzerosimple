// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract WTAN is ERC20 {
    address public receiver;

    constructor() ERC20("Wrapped TAN", "WTAN") {
        // empty
    }

    modifier onlyReceiver() {
        require(msg.sender == receiver, "Not authorized");
        _;
    }

    function setReceiver(address _receiver) external {
        require(receiver == address(0), "Already set");
        receiver = _receiver;
    }

    function mintTo(address to, uint256 amount) external onlyReceiver {
        _mint(to, amount);
    }

     function burn(address from, uint256 amount) external  {
        _burn(from, amount);
    }
}

