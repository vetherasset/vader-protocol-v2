// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.8.9;

interface IUniswapTWAP {
    function maxUpdateWindow() external view returns (uint);

    function getVaderPrice() external returns (uint);

    function syncVaderPrice() external;
}