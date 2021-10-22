// SPDX-License-Identifier: Unlicense

pragma solidity =0.8.9;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "../../shared/ProtocolConstants.sol";

import "../math/VaderMath.sol";

import "../../interfaces/reserve/IVaderReserve.sol";
import "../../interfaces/dex/router/IVaderRouter.sol";
import "../../interfaces/dex/pool/IVaderPoolFactory.sol";

contract VaderRouter is IVaderRouter, ProtocolConstants, Ownable {
    /* ========== LIBRARIES ========== */

    // Used for safe token transfers
    using SafeERC20 for IERC20;

    /* ========== STATE VARIABLES ========== */

    IVaderPoolFactory public immutable factory;
    IVaderReserve public reserve;

    /* ========== CONSTRUCTOR ========== */

    constructor(IVaderPoolFactory _factory) {
        require(
            _factory != IVaderPoolFactory(_ZERO_ADDRESS),
            "VaderRouter::constructor: Incorrect Arguments"
        );

        factory = _factory;
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
    )
        external
        override
        returns (
            uint256 amountA,
            uint256 amountB,
            uint256 liquidity
        )
    {
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
    )
        public
        override
        ensure(deadline)
        returns (
            uint256 amountA,
            uint256 amountB,
            uint256 liquidity
        )
    {
        IVaderPool pool;
        (pool, amountA, amountB) = _addLiquidity(
            address(tokenA),
            address(tokenB),
            amountADesired,
            amountBDesired
        );
        tokenA.safeTransferFrom(msg.sender, address(pool), amountA);
        tokenB.safeTransferFrom(msg.sender, address(pool), amountB);
        liquidity = pool.mint(to);
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
        IVaderPool pool = factory.getPool(tokenA, tokenB);

        pool.transferFrom(msg.sender, address(pool), id);

        (
            uint256 amountNative,
            uint256 amountForeign,
            uint256 coveredLoss
        ) = pool.burn(id, to);

        (amountA, amountB) = tokenA == factory.nativeAsset()
            ? (amountNative, amountForeign)
            : (amountForeign, amountNative);

        require(
            amountA >= amountAMin,
            "UniswapV2Router: INSUFFICIENT_A_AMOUNT"
        );
        require(
            amountB >= amountBMin,
            "UniswapV2Router: INSUFFICIENT_B_AMOUNT"
        );

        reserve.reimburseImpermanentLoss(msg.sender, coveredLoss);
    }

    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external virtual override ensure(deadline) returns (uint256 amountOut) {
        amountOut = _swap(amountIn, path, to);

        require(
            amountOut >= amountOutMin,
            "VaderRouter::swapExactTokensForTokens: Insufficient Trade Output"
        );
    }

    function swapTokensForExactTokens(
        uint256 amountOut,
        uint256 amountInMax,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external virtual ensure(deadline) returns (uint256 amountIn) {
        amountIn = calculateInGivenOut(amountOut, path);

        require(
            amountInMax >= amountIn,
            "VaderRouter::swapTokensForExactTokens: Large Trade Input"
        );

        _swap(amountIn, path, to);
    }

    /* ========== RESTRICTED FUNCTIONS ========== */

    function initialize(IVaderReserve _reserve) external onlyOwner {
        require(
            _reserve != IVaderReserve(_ZERO_ADDRESS),
            "VaderRouter::initialize: Incorrect Reserve Specified"
        );

        reserve = _reserve;

        renounceOwnership();
    }

    /* ========== INTERNAL FUNCTIONS ========== */

    /* ========== PRIVATE FUNCTIONS ========== */

    // TODO: Refactor with central pool, perhaps diminishes security? would need directSwap & bridgeSwap
    function _swap(
        uint256 amountIn,
        address[] calldata path,
        address to
    ) private returns (uint256 amountOut) {
        if (path.length == 3) {
            require(
                path[0] != path[1] &&
                    path[1] == factory.nativeAsset() &&
                    path[2] != path[1],
                "VaderRouter::_swap: Incorrect Path"
            );

            IVaderPool pool0 = factory.getPool(path[0], path[1]);
            IVaderPool pool1 = factory.getPool(path[1], path[2]);

            IERC20(path[0]).safeTransferFrom(
                msg.sender,
                address(pool0),
                amountIn
            );

            return pool1.swap(0, pool0.swap(amountIn, 0, address(pool1)), to);
        } else {
            require(
                path.length == 2,
                "VaderRouter::_swap: Incorrect Path Length"
            );
            address nativeAsset = factory.nativeAsset();
            require(path[0] != path[1], "VaderRouter::_swap: Incorrect Path");

            IVaderPool pool = factory.getPool(path[0], path[1]);
            IERC20(path[0]).safeTransferFrom(
                msg.sender,
                address(pool),
                amountIn
            );
            if (path[0] == nativeAsset) {
                return pool.swap(amountIn, 0, to);
            } else {
                require(
                    path[1] == nativeAsset,
                    "VaderRouter::_swap: Incorrect Path"
                );
                return pool.swap(0, amountIn, to);
            }
        }
    }

    // NOTE: DEX allows asymmetric deposits
    function _addLiquidity(
        address tokenA,
        address tokenB,
        uint256 amountADesired,
        uint256 amountBDesired
    )
        private
        returns (
            IVaderPool pool,
            uint256 amountA,
            uint256 amountB
        )
    {
        // create the pair if it doesn't exist yet
        pool = factory.getPool(tokenA, tokenB);
        if (pool == IVaderPool(_ZERO_ADDRESS)) {
            pool = factory.createPool(tokenA, tokenB);
        }

        (amountA, amountB) = (amountADesired, amountBDesired);
    }

    function calculateInGivenOut(uint256 amountOut, address[] calldata path)
        public
        view
        returns (uint256 amountIn)
    {
        if (path.length == 2) {
            address nativeAsset = factory.nativeAsset();
            IVaderPool pool = factory.getPool(path[0], path[1]);
            (uint256 nativeReserve, uint256 foreignReserve, ) = pool
                .getReserves();
            if (path[0] == nativeAsset) {
                return
                    VaderMath.calculateSwapReverse(
                        amountOut,
                        nativeReserve,
                        foreignReserve
                    );
            } else {
                return
                    VaderMath.calculateSwapReverse(
                        amountOut,
                        foreignReserve,
                        nativeReserve
                    );
            }
        } else {
            IVaderPool pool0 = factory.getPool(path[0], path[1]);
            IVaderPool pool1 = factory.getPool(path[1], path[2]);
            (uint256 nativeReserve0, uint256 foreignReserve0, ) = pool0
                .getReserves();
            (uint256 nativeReserve1, uint256 foreignReserve1, ) = pool1
                .getReserves();

            return
                VaderMath.calculateSwapReverse(
                    VaderMath.calculateSwapReverse(
                        amountOut,
                        nativeReserve1,
                        foreignReserve1
                    ),
                    foreignReserve0,
                    nativeReserve0
                );
        }
    }

    function calculateOutGivenIn(uint256 amountIn, address[] calldata path)
        external
        view
        returns (uint256 amountOut)
    {
        if (path.length == 2) {
            address nativeAsset = factory.nativeAsset();
            IVaderPool pool = factory.getPool(path[0], path[1]);
            (uint256 nativeReserve, uint256 foreignReserve, ) = pool
                .getReserves();
            if (path[0] == nativeAsset) {
                return
                    VaderMath.calculateSwap(
                        amountIn,
                        nativeReserve,
                        foreignReserve
                    );
            } else {
                return
                    VaderMath.calculateSwap(
                        amountIn,
                        foreignReserve,
                        nativeReserve
                    );
            }
        } else {
            IVaderPool pool0 = factory.getPool(path[0], path[1]);
            IVaderPool pool1 = factory.getPool(path[1], path[2]);
            (uint256 nativeReserve0, uint256 foreignReserve0, ) = pool0
                .getReserves();
            (uint256 nativeReserve1, uint256 foreignReserve1, ) = pool1
                .getReserves();

            return
                VaderMath.calculateSwap(
                    VaderMath.calculateSwap(
                        amountIn,
                        nativeReserve1,
                        foreignReserve1
                    ),
                    foreignReserve0,
                    nativeReserve0
                );
        }
    }

    /* ========== MODIFIERS ========== */

    modifier ensure(uint256 deadline) {
        require(deadline >= block.timestamp, "VaderRouter::ensure: Expired");
        _;
    }
}
