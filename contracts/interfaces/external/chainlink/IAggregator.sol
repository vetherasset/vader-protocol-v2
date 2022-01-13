// SPDX-License-Identifier: MIT AND AGPL-3.0-or-later

pragma solidity =0.8.9;

interface IAggregator {
    function latestAnswer() external view returns (int256);
}
