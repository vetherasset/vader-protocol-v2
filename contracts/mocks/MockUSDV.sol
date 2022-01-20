// SPDX-License-Identifier: MIT AND AGPL-3.0-or-later

pragma solidity =0.8.9;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockUSDV is ERC20 {
    constructor() ERC20("Fake USDV", "USDV") {}

    function mint(
        address account,
        uint256,
        uint256 uAmount,
        uint256,
        uint256
    ) external returns (uint256) {
        _mint(account, uAmount);
        return uAmount;
    }

    function burn(
        address account,
        uint256 uAmount,
        uint256 vAmount,
        uint256,
        uint256
    ) external returns (uint256) {
        _burn(account, uAmount);
        return vAmount;
    }
}
