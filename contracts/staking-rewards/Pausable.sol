// SPDX-License-Identifier: MIT AND AGPL-3.0-or-later
pragma solidity 0.8.9;

import "./Owned.sol";

abstract contract Pausable is Owned {
    uint256 public lastPauseTime;
    bool public paused;

    constructor() {
        // This contract is abstract, and thus cannot be instantiated directly
        require(owner != address(0), "Owner must be set");
        // Paused will be false, and lastPauseTime will be 0 upon initialisation
    }

    /**
     * @notice Change the paused state of the contract
     * @dev Only the contract owner may call this.
     */
    function setPaused(bool _paused) external onlyOwner {
        // Ensure we're actually changing the state before we do anything
        if (_paused == paused) {
            return;
        }

        // Set our paused state.
        paused = _paused;

        // If applicable, set the last pause time.
        // C4-Audit Fix for Issue # 106
        if (_paused) {
            lastPauseTime = block.timestamp;
        }

        // Let everyone know that our pause state has changed.
        // C4-Audit Fix for Issue # 106
        emit PauseChanged(_paused);
    }

    event PauseChanged(bool isPaused);

    modifier notPaused() {
        require(!paused, "paused");
        _;
    }
}
