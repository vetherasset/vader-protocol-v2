// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.6.8;

import "../governance/Timelock.sol";

contract MockTimelock is Timelock {
    constructor(address admin_, uint256 delay_)
        public
        Timelock(admin_, delay_)
    {}

    function GRACE_PERIOD() public pure override returns (uint256) {
        return 1 days;
    }

    function MINIMUM_DELAY() public pure override returns (uint256) {
        return 5 minutes;
    }

    function MAXIMUM_DELAY() public pure override returns (uint256) {
        return 15 minutes;
    }
}
