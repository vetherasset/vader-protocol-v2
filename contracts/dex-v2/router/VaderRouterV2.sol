// SPDX-License-Identifier: Unlicense

pragma solidity =0.8.9;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "../../shared/ProtocolConstants.sol";

import "../../dex/math/VaderMath.sol";

import "../../interfaces/reserve/IVaderReserve.sol";
import "../../interfaces/dex-v2/router/IVaderRouterV2.sol";
import "../../interfaces/dex-v2/pool/IVaderPoolV2.sol";

contract VaderRouterV2 is IVaderRouterV2, ProtocolConstants, Ownable {
    /* ========== LIBRARIES ========== */

    // Used for safe token transfers
    using SafeERC20 for IERC20;

    /* ========== STATE VARIABLES ========== */

    IVaderPoolV2 public immutable pool;
    IERC20 public immutable nativeAsset;
    IVaderReserve public reserve;

    /* ========== CONSTRUCTOR ========== */

    constructor(IVaderPoolV2 _pool) {
        require(
            _pool != IVaderPoolV2(_ZERO_ADDRESS),
            "VaderRouterV2::constructor: Incorrect Arguments"
        );

        pool = _pool;
        nativeAsset = pool.nativeAsset();
    }

    /* ========== VIEWS ========== */

    /* ========== MUTATIVE FUNCTIONS ========== */

    // NOTE: For Uniswap V2 compliancy, necessary due to stack too deep
    function addLiquidity(
        IERC20 tokenA,
        IERC20 tokenB,
        uint256 amountADesired,
        uint256 amountBDesired,
        uint256, // amountAMin = unused
        uint256, // amountBMin = unused
        address to,
        uint256 deadline
    ) external override returns (uint256 liquidity) {
        return
            addLiquidity(
                tokenA,
                tokenB,
                amountADesired,
                amountBDesired,
                to,
                deadline
            );
    }

    function addLiquidity(
        IERC20 tokenA,
        IERC20 tokenB,
        uint256 amountADesired,
        uint256 amountBDesired,
        address to,
        uint256 deadline
    ) public override ensure(deadline) returns (uint256 liquidity) {
        IERC20 foreignAsset;
        uint256 nativeDeposit;
        uint256 foreignDeposit;

        if (tokenA == nativeAsset) {
            require(
                pool.supported(tokenB),
                "VaderRouterV2::addLiquidity: Unsupported Assets Specified"
            );
            foreignAsset = tokenB;
            foreignDeposit = amountBDesired;
            nativeDeposit = amountADesired;
        } else {
            require(
                tokenB == nativeAsset && pool.supported(tokenA),
                "VaderRouterV2::addLiquidity: Unsupported Assets Specified"
            );
            foreignAsset = tokenA;
            foreignDeposit = amountADesired;
            nativeDeposit = amountBDesired;
        }

        liquidity = pool.mint(
            foreignAsset,
            nativeDeposit,
            foreignDeposit,
            msg.sender,
            to
        );
    }

    function removeLiquidity(
        address tokenA,
        address tokenB,
        uint256 id,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256 deadline
    )
        public
        override
        ensure(deadline)
        returns (uint256 amountA, uint256 amountB)
    {
        IERC20 _foreignAsset = pool.positionForeignAsset(id);
        IERC20 _nativeAsset = nativeAsset;

        bool isNativeA = _nativeAsset == IERC20(tokenA);

        if (isNativeA) {
            require(
                IERC20(tokenB) == _foreignAsset,
                "VaderRouterV2::removeLiquidity: Incorrect Addresses Specified"
            );
        } else {
            require(
                IERC20(tokenA) == _foreignAsset &&
                    IERC20(tokenB) == _nativeAsset,
                "VaderRouterV2::removeLiquidity: Incorrect Addresses Specified"
            );
        }

        pool.transferFrom(msg.sender, address(pool), id);

        (
            uint256 amountNative,
            uint256 amountForeign,
            uint256 coveredLoss
        ) = pool.burn(id, to);

        (amountA, amountB) = isNativeA
            ? (amountNative, amountForeign)
            : (amountForeign, amountNative);

        require(
            amountA >= amountAMin,
            "VaderRouterV2: INSUFFICIENT_A_AMOUNT"
        );
        require(
            amountB >= amountBMin,
            "VaderRouterV2: INSUFFICIENT_B_AMOUNT"
        );

        reserve.reimburseImpermanentLoss(msg.sender, coveredLoss);
    }

    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        IERC20[] calldata path,
        address to,
        uint256 deadline
    ) external virtual override ensure(deadline) returns (uint256 amountOut) {
        amountOut = _swap(amountIn, path, to);

        require(
            amountOut >= amountOutMin,
            "VaderRouterV2::swapExactTokensForTokens: Insufficient Trade Output"
        );
    }

    /* ========== RESTRICTED FUNCTIONS ========== */

    function initialize(IVaderReserve _reserve) external onlyOwner {
        require(
            _reserve != IVaderReserve(_ZERO_ADDRESS),
            "VaderRouterV2::initialize: Incorrect Reserve Specified"
        );

        reserve = _reserve;

        renounceOwnership();
    }

    /* ========== INTERNAL FUNCTIONS ========== */

    /* ========== PRIVATE FUNCTIONS ========== */

    function _swap(
        uint256 amountIn,
        IERC20[] calldata path,
        address to
    ) private returns (uint256 amountOut) {
        if (path.length == 3) {
            require(
                path[0] != path[1] &&
                    path[1] == pool.nativeAsset() &&
                    path[2] != path[1],
                "VaderRouterV2::_swap: Incorrect Path"
            );

            path[0].safeTransferFrom(msg.sender, address(pool), amountIn);

            return pool.doubleSwap(path[0], path[2], amountIn, to);
        } else {
            require(
                path.length == 2,
                "VaderRouterV2::_swap: Incorrect Path Length"
            );
            IERC20 _nativeAsset = nativeAsset;
            require(path[0] != path[1], "VaderRouterV2::_swap: Incorrect Path");

            path[0].safeTransferFrom(msg.sender, address(pool), amountIn);
            if (path[0] == _nativeAsset) {
                return pool.swap(path[1], amountIn, 0, to);
            } else {
                require(
                    path[1] == _nativeAsset,
                    "VaderRouterV2::_swap: Incorrect Path"
                );
                return pool.swap(path[0], 0, amountIn, to);
            }
        }
    }

    /* ========== MODIFIERS ========== */

    modifier ensure(uint256 deadline) {
        require(deadline >= block.timestamp, "VaderRouterV2::ensure: Expired");
        _;
    }
}
