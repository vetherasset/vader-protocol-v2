// SPDX-License-Identifier: MIT AND AGPL-3.0-or-later
pragma solidity =0.8.9;

import "../../shared/IERC20Extended.sol";

interface ILPToken {
    function mint(address to, uint256 amount) external;

    function burn(uint256 amount) external;
}
