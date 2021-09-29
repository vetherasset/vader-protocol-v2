// SPDX-License-Identifier: Unlicensed

pragma solidity =0.6.8;

import "../interfaces/governance/ITimelock.sol";

contract MockTarget {
    bool public state;
    ITimelock public timelock;

    constructor(address _timelock) public {
        timelock = ITimelock(_timelock);
    }

    function setStateToTrue() external onlyTimelock {
        state = true;
    }

    function changeState(bool _state) external onlyTimelock {
        state = _state;
    }

    modifier onlyTimelock() {
        require(msg.sender == address(timelock), "only timelock can call");
        _;
    }
}
