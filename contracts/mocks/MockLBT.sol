// SPDX-License-Identifier: MIT AND AGPL-3.0-or-later

pragma solidity =0.8.9;

contract MockLBT {
    // 1e18 = 1 USD
    uint256 private vaderUsdPrice = (8 * 1e18) / 100;

    uint256 private x;

    function getVaderPrice() external returns (uint256) {
        // Write something to suppress compiler warning
        x += 1;
        return vaderUsdPrice;
    }

    // test helpers
    function _setVaderUsdPrice_(uint256 _vaderUsdPrice) external {
        vaderUsdPrice = _vaderUsdPrice;
    }

    function _getVaderUsdPrice_() external view returns (uint256) {
        return vaderUsdPrice;
    }
}
