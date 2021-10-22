// SPDX-License-Identifier: Unlicense

pragma solidity =0.8.9;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

import "../math/VaderMath.sol";
// import "../queue/SwapQueue.sol";
import "../utils/GasThrottle.sol";

import "../../external/libraries/UQ112x112.sol";

import "../../interfaces/dex/pool/IBasePool.sol";
import "../../interfaces/shared/IERC20Extended.sol";

contract BasePool is IBasePool, GasThrottle, ERC721, Ownable, ReentrancyGuard {
    /* ========== LIBRARIES ========== */

    // Used for safe token transfers
    using SafeERC20 for IERC20;

    // Used by Uniswap-like TWAP mechanism
    using UQ112x112 for uint224;

    /* ========== STATE VARIABLES ========== */

    IERC20 public immutable nativeAsset;
    IERC20 public immutable foreignAsset;
    uint256 public priceNativeCumulativeLast;
    uint256 public priceForeignCumulativeLast;

    mapping(uint256 => Position) public positions;
    uint256 public positionId;
    uint256 public totalSupply;

    string private _name;

    uint112 private _reserveNative; // uses single storage slot, accessible via getReserves
    uint112 private _reserveForeign; // uses single storage slot, accessible via getReserves
    uint32 private _blockTimestampLast; // uses single storage slot, accessible via getReserves

    /* ========== CONSTRUCTOR ========== */

    constructor(IERC20Extended _nativeAsset, IERC20Extended _foreignAsset)
        ERC721("Vader LP", "VLP")
    {
        nativeAsset = IERC20(_nativeAsset);
        foreignAsset = IERC20(_foreignAsset);

        string memory calculatedName = string(
            abi.encodePacked("Vader USDV /", _foreignAsset.symbol(), " LP")
        );
        _name = calculatedName;
    }

    /* ========== VIEWS ========== */

    function getReserves()
        public
        view
        returns (
            uint112 reserveNative,
            uint112 reserveForeign,
            uint32 blockTimestampLast
        )
    {
        reserveNative = _reserveNative;
        reserveForeign = _reserveForeign;
        blockTimestampLast = _blockTimestampLast;
    }

    function name() public view override returns (string memory) {
        return _name;
    }

    /* ========== MUTATIVE FUNCTIONS ========== */

    function mint(address to)
        external
        override
        nonReentrant
        returns (uint256 liquidity)
    {
        (uint112 reserveNative, uint112 reserveForeign, ) = getReserves(); // gas savings
        uint256 balanceNative = nativeAsset.balanceOf(address(this));
        uint256 balanceForeign = foreignAsset.balanceOf(address(this));
        uint256 nativeDeposit = balanceNative - reserveNative;
        uint256 foreignDeposit = balanceForeign - reserveForeign;

        uint256 totalLiquidityUnits = totalSupply;
        if (totalLiquidityUnits == 0)
            liquidity = nativeDeposit; // TODO: Contact ThorChain on proper approach
        else
            liquidity = VaderMath.calculateLiquidityUnits(
                nativeDeposit,
                reserveNative,
                foreignDeposit,
                reserveForeign,
                totalLiquidityUnits
            );

        require(
            liquidity > 0,
            "BasePool::mint: Insufficient Liquidity Provided"
        );

        uint256 id = positionId++;

        totalSupply += liquidity;
        _mint(to, id);

        positions[id] = Position(
            block.timestamp,
            liquidity,
            nativeDeposit,
            foreignDeposit
        );

        _update(balanceNative, balanceForeign, reserveNative, reserveForeign);

        emit Mint(msg.sender, to, nativeDeposit, foreignDeposit);
        emit PositionOpened(msg.sender, id, liquidity);
    }

    function _burn(uint256 id, address to)
        internal
        nonReentrant
        returns (uint256 amountNative, uint256 amountForeign)
    {
        require(
            ownerOf(id) == address(this),
            "BasePool::burn: Incorrect Ownership"
        );

        (uint112 reserveNative, uint112 reserveForeign, ) = getReserves(); // gas savings
        IERC20 _nativeAsset = nativeAsset; // gas savings
        IERC20 _foreignAsset = foreignAsset; // gas savings
        uint256 nativeBalance = IERC20(_nativeAsset).balanceOf(address(this));
        uint256 foreignBalance = IERC20(_foreignAsset).balanceOf(address(this));

        uint256 liquidity = positions[id].liquidity;

        uint256 _totalSupply = totalSupply; // gas savings, must be defined here since totalSupply can update in _mintFee
        amountNative = (liquidity * nativeBalance) / _totalSupply; // using balances ensures pro-rata distribution
        amountForeign = (liquidity * foreignBalance) / _totalSupply; // using balances ensures pro-rata distribution

        require(
            amountNative > 0 && amountForeign > 0,
            "BasePool::burn: Insufficient Liquidity Burned"
        );

        totalSupply -= liquidity;
        _burn(id);

        _nativeAsset.safeTransfer(to, amountNative);
        _foreignAsset.safeTransfer(to, amountForeign);

        nativeBalance = _nativeAsset.balanceOf(address(this));
        foreignBalance = _foreignAsset.balanceOf(address(this));

        _update(nativeBalance, foreignBalance, reserveNative, reserveForeign);

        emit Burn(msg.sender, amountNative, amountForeign, to);
    }

    function swap(
        uint256 nativeAmountIn,
        uint256 foreignAmountIn,
        address to,
        bytes calldata
    ) external override returns (uint256) {
        return swap(nativeAmountIn, foreignAmountIn, to);
    }

    function swap(
        uint256 nativeAmountIn,
        uint256 foreignAmountIn,
        address to
    ) public override nonReentrant validateGas returns (uint256) {
        require(
            (nativeAmountIn > 0 && foreignAmountIn == 0) ||
                (nativeAmountIn == 0 && foreignAmountIn > 0),
            "BasePool::swap: Only One-Sided Swaps Supported"
        );
        (uint112 nativeReserve, uint112 foreignReserve, ) = getReserves(); // gas savings

        uint256 nativeBalance;
        uint256 foreignBalance;
        uint256 nativeAmountOut;
        uint256 foreignAmountOut;
        {
            // scope for _token{0,1}, avoids stack too deep errors
            IERC20 _nativeAsset = nativeAsset;
            IERC20 _foreignAsset = foreignAsset;
            nativeBalance = _nativeAsset.balanceOf(address(this));
            foreignBalance = _foreignAsset.balanceOf(address(this));

            require(
                to != address(_nativeAsset) && to != address(_foreignAsset),
                "BasePool::swap: Invalid Receiver"
            );

            if (foreignAmountIn > 0) {
                require(
                    foreignAmountIn <= foreignBalance - foreignReserve,
                    "BasePool::swap: Insufficient Tokens Provided"
                );
                require(
                    foreignAmountIn <= foreignReserve,
                    "BasePool::swap: Unfavourable Trade"
                );

                nativeAmountOut = VaderMath.calculateSwap(
                    foreignAmountIn,
                    foreignReserve,
                    nativeReserve
                );

                require(
                    nativeAmountOut > 0 && nativeAmountOut <= nativeReserve,
                    "BasePool::swap: Swap Impossible"
                );

                _nativeAsset.safeTransfer(to, nativeAmountOut); // optimistically transfer tokens
            } else {
                require(
                    nativeAmountIn <= nativeBalance - nativeReserve,
                    "BasePool::swap: Insufficient Tokens Provided"
                );
                require(
                    nativeAmountIn <= nativeReserve,
                    "BasePool::swap: Unfavourable Trade"
                );

                foreignAmountOut = VaderMath.calculateSwap(
                    nativeAmountIn,
                    nativeReserve,
                    foreignReserve
                );

                require(
                    foreignAmountOut > 0 && foreignAmountOut <= foreignReserve,
                    "BasePool::swap: Swap Impossible"
                );

                _foreignAsset.safeTransfer(to, foreignAmountOut); // optimistically transfer tokens
            }

            nativeBalance = _nativeAsset.balanceOf(address(this));
            foreignBalance = _foreignAsset.balanceOf(address(this));
        }

        _update(nativeBalance, foreignBalance, nativeReserve, foreignReserve);

        emit Swap(
            msg.sender,
            nativeAmountIn,
            foreignAmountIn,
            nativeAmountOut,
            foreignAmountOut,
            to
        );

        return nativeAmountOut > 0 ? nativeAmountOut : foreignAmountOut;
    }

    /* ========== RESTRICTED FUNCTIONS ========== */

    /* ========== INTERNAL FUNCTIONS ========== */

    function _update(
        uint256 balanceNative,
        uint256 balanceForeign,
        uint112 reserveNative,
        uint112 reserveForeign
    ) internal {
        require(
            balanceNative <= type(uint112).max &&
                balanceForeign <= type(uint112).max,
            "BasePool::_update: Balance Overflow"
        );
        uint32 blockTimestamp = uint32(block.timestamp % 2**32);
        uint32 timeElapsed = blockTimestamp - _blockTimestampLast; // overflow is desired
        if (timeElapsed > 0 && reserveNative != 0 && reserveForeign != 0) {
            // * never overflows, and + overflow is desired
            priceNativeCumulativeLast +=
                uint256(UQ112x112.encode(reserveForeign).uqdiv(reserveNative)) *
                timeElapsed;
            priceForeignCumulativeLast +=
                uint256(UQ112x112.encode(reserveNative).uqdiv(reserveForeign)) *
                timeElapsed;
        }
        _reserveNative = uint112(balanceNative);
        _reserveForeign = uint112(balanceForeign);
        _blockTimestampLast = blockTimestamp;
        emit Sync(balanceNative, balanceForeign);
    }

    /* ========== PRIVATE FUNCTIONS ========== */

    /* ========== MODIFIERS ========== */
}
