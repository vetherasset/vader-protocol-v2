// SPDX-License-Identifier: Unlicense

pragma solidity =0.6.8;

interface IConverter {
    /* ========== FUNCTIONS ========== */

    function convert(uint256 amount) external returns (uint256);

    /* ========== EVENTS ========== */

    event Conversion(
        address indexed user,
        uint256 vetherAmount,
        uint256 vaderAmount
    );
}
