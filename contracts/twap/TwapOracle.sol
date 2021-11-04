// SPDX-License-Identifier: Unlicense

pragma solidity =0.8.9;

import "../external/interfaces/IUniswapV2Factory.sol";
import "../external/interfaces/IUniswapV2Pair.sol";

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "../external/libraries/FixedPoint.sol";
import "../external/libraries/UniswapV2OracleLibrary.sol";
import "../external/libraries/UniswapV2Library.sol";
import "../interfaces/dex-v2/pool/IVaderPoolV2.sol";

contract TwapOracle is Ownable {
    /* ========== LIBRARIES ========== */

    using FixedPoint for *;

    /* ========== CONSTANTS ========== */

    address constant VADER =
        address(
            0 /* TODO */
        );
    address constant USDV =
        address(
            0 /* TODO */
        );

    /* ========== STRUCTURES ========== */

    struct PairData {
        // The address of the pair interface (IUniswapV2Pair or IVaderPoolV2)
        address pair;
        // The first token of the pair.
        address token0;
        // The second token of the pair.
        address token1;
        // The last cumulative price of the first token.
        uint256 price0CumulativeLast;
        // The last cumulative price of the second token.
        uint256 price1CumulativeLast;
        // The block timestamp of the last update.
        uint32 blockTimestampLast;
        // The average price of the first token.
        FixedPoint.uq112x112 price0Average;
        // The average price of the second token.
        FixedPoint.uq112x112 price1Average;
    }

    /* ========== STATE VARIABLES ========== */

    // The vader pool used across all native assets.
    IVaderPoolV2 private _vaderPool;

    // The frequency that the pair collection should be updated.
    uint256 private _updatePeriod;

    // The collection of pairs tracked by the TWAP oracle.
    PairData[] private _pairs;

    // A mapping of pair hashes to existence predicates.
    mapping(bytes32 => bool) private _pairExists;

    /* ========== CONSTRUCTOR ========== */

    /**
     * @dev Constructs a new TWAP oracle with a VADER pool and update period.
     * @param vaderPool The VADER pool address.
     * @param updatePeriod The required period of time between each oracle update.
     */
    constructor(address vaderPool, uint256 updatePeriod) Ownable() {
        _vaderPool = IVaderPoolV2(vaderPool);
        _updatePeriod = updatePeriod;
    }

    /* ========== VIEWS ========== */

    /**
    * @dev Checks if a pair exists for the supplied {token0} and {token1} addresses.
    * @param token0 The primary token address, either VADER or USDV.
    * @param token1 The asset token address, paired to either VADER or USDV.
    */
    function pairExists(address token0, address token1) public view returns (bool) {
        bytes32 pairHash0 = keccak256(abi.encodePacked(token0, token1));
        bytes32 pairHash1 = keccak256(abi.encodePacked(token1, token0));
        return _pairExists[pairHash0] || _pairExists[pairHash1];
    }

    /**
     * @dev Performs a consultation to retrieve the equivalent to {amountIn} for the supplied {token} address.
     * The {token} address must have a registered pairing, otherwise the transaction will revert.
     * @param token The token address to consult the equivalent {amountIn} for.
     * @param amountIn The amount to consult for the token paired to the {token} address.
     */
    function consult(address token, uint256 amountIn)
        external
        view
        returns (uint256)
    {
        uint256 pairCount = _pairs.length;

        for (uint256 i = 0; i < pairCount; i++) {
            PairData storage pairData = _pairs[i];

            if (token == pairData.token0) {
                return pairData.price0Average.mul(amountIn).decode144();
            } else if (token == pairData.token1) {
                return pairData.price1Average.mul(amountIn).decode144();
            }
        }

        revert("TwapOracle::consult: PAIR_NOT_FOUND");
    }

    /* ========== MUTATIVE FUNCTIONS ========== */

    /**
     * @dev Registers either a VADER or USDV pairing in the TWAP oracle.
     * @param factory The factory address, if any.
     * @param token0 The primary token address, either VADER or USDV.
     * @param token1 The asset token address, paired to VADER or USDV.
     */
    function registerPair(
        address factory,
        address token0,
        address token1
    ) external onlyOwner {
        require(
            token0 == VADER || token0 == USDV,
            "TwapOracle::registerPair: INVALID_TOKEN0_ADDRESS"
        );
        require(
            token0 != token1,
            "TwapOracle::registerPair: SAME_TOKEN_ADDRESSES"
        );
        require(
            !pairExists(token0, token1),
            "TwapOracle::registerPair: PAIR_EXISTS"
        );

        address pairAddr;
        uint256 price0CumulativeLast;
        uint256 price1CumulativeLast;
        uint112 reserve0;
        uint112 reserve1;
        uint32 blockTimestampLast;

        if (token0 == VADER) {
            IUniswapV2Pair pair = IUniswapV2Pair(
                UniswapV2Library.pairFor(factory, token0, token1)
            );
            pairAddr = address(pair);
            price0CumulativeLast = pair.price0CumulativeLast();
            price1CumulativeLast = pair.price1CumulativeLast();
            (reserve0, reserve1, blockTimestampLast) = pair.getReserves();
        } else {
            pairAddr = address(_vaderPool);
            (price0CumulativeLast, price1CumulativeLast, ) = _vaderPool
                .cumulativePrices(IERC20(token1));
            (reserve0, reserve1, blockTimestampLast) = _vaderPool.getReserves(
                IERC20(token1)
            );
        }

        require(
            reserve0 != 0 && reserve1 != 0,
            "TwapOracle::registerPair: NO_RESERVES"
        );

        _pairExists[keccak256(abi.encodePacked(token0, token1))] = true;

        _pairs.push(
            PairData({
                pair: pairAddr,
                token0: token0,
                token1: token1,
                price0CumulativeLast: price0CumulativeLast,
                price1CumulativeLast: price1CumulativeLast,
                blockTimestampLast: blockTimestampLast,
                price0Average: FixedPoint.uq112x112({_x: 0}),
                price1Average: FixedPoint.uq112x112({_x: 0})
            })
        );
    }

    /**
     * @dev Updates the average prices for all token pairs registered in the TWAP oracle.
     */
    function update() external onlyOwner {
        uint256 pairCount = _pairs.length;

        // Update all of the registered pairs in the TWAP oracle.
        for (uint256 i = 0; i < pairCount; i++) {
            PairData storage pairData = _pairs[i];

            // Get the current cumulative prices and block timestamp of the current pairing.
            (
                uint256 price0Cumulative,
                uint256 price1Cumulative,
                uint32 blockTimestamp
            ) = (pairData.token0 == VADER)
                    ? UniswapV2OracleLibrary.currentCumulativePrices(
                        pairData.pair
                    )
                    : _vaderPool.cumulativePrices(IERC20(pairData.token1));

            unchecked {
                // Ensure that at least one full period has passed since the pairing was last update.
                uint32 timeElapsed = blockTimestamp - pairData.blockTimestampLast;
                require(
                    timeElapsed >= _updatePeriod,
                    "TwapOracle::update: PERIOD_NOT_ELAPSED"
                );

                // Cumulative price is in (uq112x112 price * seconds) units so we simply wrap it after division by time elapsed.
                pairData.price0Average = FixedPoint.uq112x112(
                    uint224(
                        (price0Cumulative - pairData.price0CumulativeLast) /
                            timeElapsed
                    )
                );
                pairData.price1Average = FixedPoint.uq112x112(
                    uint224(
                        (price1Cumulative - pairData.price1CumulativeLast) /
                            timeElapsed
                    )
                );
            }

            // Update the stored pairing data
            pairData.price0CumulativeLast = price0Cumulative;
            pairData.price1CumulativeLast = price1Cumulative;
            pairData.blockTimestampLast = blockTimestamp;
        }
    }
}
