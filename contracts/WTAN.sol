// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract WTAN is ERC20, Ownable {
    address public minter;
    
    constructor() ERC20("Wrapped TAN", "WTAN") {

        _mint(msg.sender, 1000000 * 10 ** decimals());
    }

   
    function setMinter(address _minter) external onlyOwner {
        minter = _minter;
    }

    // Minter can mint new tokens
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    // Any address can burn their own tokens
    function burn(address from, uint256 amount) external {
        _burn(from, amount);
    }
}
