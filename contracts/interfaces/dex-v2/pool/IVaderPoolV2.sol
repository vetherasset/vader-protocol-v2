// SPDX-License-Identifier: MIT AND AGPL-3.0-or-later

pragma solidity =0.8.9;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "./IBasePoolV2.sol";

interface IVaderPoolV2 is IBasePoolV2, IERC721 {
    /* ========== STRUCTS ========== */
    /* ========== FUNCTIONS ========== */

    function cumulativePrices(IERC20 foreignAsset)
        external
        view
        returns (
            uint256 price0CumulativeLast,
            uint256 price1CumulativeLast,
            uint32 blockTimestampLast
        );

    function mintFungible(
        IERC20 foreignAsset,
        uint256 nativeDeposit,
        uint256 foreignDeposit,
        address from,
        address to
    ) external returns (uint256 liquidity);

    function burnFungible(
        IERC20 foreignAsset,
        uint256 liquidity,
        address to
    ) external returns (uint256 amountNative, uint256 amountForeign);

    function burn(uint256 id, address to)
        external
        returns (
            uint256 amountNative,
            uint256 amountForeign,
            uint256 coveredLoss
        );

    function setQueue(bool _queueActive) external;

    function setTokenSupport(
        IERC20 foreignAsset,
        bool support,
        uint256 nativeDeposit,
        uint256 foreignDeposit,
        address from,
        address to
    ) external returns (uint256 liquidity);

    function setFungibleTokenSupport(IERC20 foreignAsset) external;

    function setGasThrottle(bool _gasThrottleEnabled) external;

    /* ========== EVENTS ========== */

    event QueueActive(bool activated);
}
