// SPDX-License-Identifier: Unlicense

pragma solidity =0.8.9;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "./IBasePoolV2.sol";

interface IVaderPoolV2 is IBasePoolV2, IERC721 {
    /* ========== STRUCTS ========== */
    /* ========== FUNCTIONS ========== */

    function burn(uint256 id, address to)
        external
        returns (
            uint256 amountNative,
            uint256 amountForeign,
            uint256 coveredLoss
        );

    function toggleQueue() external;

    function setTokenSupport(IERC20 foreignAsset, bool support) external;

    /* ========== EVENTS ========== */

    event QueueActive(bool activated);
}
