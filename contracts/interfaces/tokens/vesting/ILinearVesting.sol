// SPDX-License-Identifier: Unlicense

pragma solidity =0.6.8;

interface ILinearVesting {
    /* ========== STRUCTS ========== */

    // Struct of a vesting member, tight-packed to 256-bits
    struct Vester {
        uint192 amount;
        uint64 lastClaim;
    }

    /* ========== FUNCTIONS ========== */

    function getClaim() external view returns (uint256 vestedAmount);

    function claim() external returns (uint256 vestedAmount);

    function begin() external;

    /* ========== EVENTS ========== */

    event VestingInitialized(uint256 duration);

    event Vested(address indexed from, uint256 amount);
}
