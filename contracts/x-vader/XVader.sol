// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract XVader is ERC20("XVader", "xVADER") {
    IERC20 public vader;

    constructor(IERC20 _vader) {
        vader = _vader;
    }

    // Locks vader and mints xVader
    function enter(uint _amount) external {
        // Gets the amount of vader locked in the contract
        uint totalVader = vader.balanceOf(address(this));
        // Gets the amount of xVader in existence
        uint totalShares = totalSupply();
        // If no xVader exists, mint it 1:1 to the amount put in
        if (totalShares == 0 || totalVader == 0) {
            _mint(msg.sender, _amount);
        }
        // Calculate and mint the amount of xVader the vader is worth.
        // The ratio will change overtime, as xVader is burned/minted and
        // vader deposited + gained from fees / withdrawn.
        else {
            uint shares = (_amount * totalShares) / totalVader;
            _mint(msg.sender, shares);
        }
        // Lock the vader in the contract
        vader.transferFrom(msg.sender, address(this), _amount);
    }

    // Claim back your VADER
    // Unlocks the staked + gained vader and burns xVader
    function leave(uint _shares) external {
        // Gets the amount of xVader in existence
        uint totalShares = totalSupply();
        // Calculates the amount of vader the xVader is worth
        uint vaderAmount = (_shares * vader.balanceOf(address(this))) / totalShares;
        _burn(msg.sender, _shares);
        vader.transfer(msg.sender, vaderAmount);
    }
}
