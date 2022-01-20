// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.8.9;

import "@openzeppelin/contracts/access/Ownable.sol";
import "../interfaces/external/chainlink/IAggregatorV3.sol";
import "../interfaces/external/uniswap/IUniswapV2Pair.sol";
import "../interfaces/lbt/IUniswapTwap.sol";
import "../external/libraries/UniswapV2OracleLibrary.sol";
import "../external/libraries/FixedPoint.sol";

/**
 * @notice Return absolute value of |x - y|
 */
function abs(uint256 x, uint256 y) pure returns (uint256) {
    if (x >= y) {
        return x - y;
    }
    return y - x;
}

// TODO: slither
// TODO: check library codes
contract UniswapTwap is IUniswapTWAP, Ownable {
    using FixedPoint for FixedPoint.uq112x112;
    using FixedPoint for FixedPoint.uq144x112;

    struct ExchangePair {
        uint256 nativeTokenPriceCumulative;
        FixedPoint.uq112x112 nativeTokenPriceAverage;
        uint256 lastMeasurement;
        uint256 updatePeriod;
        // true if token0 = vader
        bool isFirst;
    }

    event SetOracle(address oracle);

    // 1 Vader = 1e18
    uint256 private constant ONE_VADER = 1e18;
    // Denominator to calculate difference in Vader / ETH TWAP and spot price.
    uint256 private constant MAX_PRICE_DIFF_DENOMINATOR = 1e5;
    // max for maxUpdateWindow
    uint256 private constant MAX_UPDATE_WINDOW = 30 days;

    /* ========== STATE VARIABLES ========== */
    address public immutable vader;
    // Vader ETH pair
    IUniswapV2Pair public immutable pair;
    // Set to pairData.updatePeriod.
    // maxUpdateWindow is called by other contracts.
    uint256 public maxUpdateWindow;
    ExchangePair public pairData;
    IAggregatorV3 public oracle;
    // Numberator to calculate max allowed difference between Vader / ETH TWAP
    // and spot price.
    // maxPriceDiff must be initialized to MAX_PRICE_DIFF_DENOMINATOR and kept
    // until TWAP price is close to spot price for _updateVaderPrice to not fail.
    uint256 public maxPriceDiff = MAX_PRICE_DIFF_DENOMINATOR;

    constructor(
        address _vader,
        IUniswapV2Pair _pair,
        IAggregatorV3 _oracle,
        uint256 _updatePeriod
    ) {
        require(_vader != address(0), "vader = 0 address");
        vader = _vader;
        require(_oracle.decimals() == 8, "oracle decimals != 8");
        oracle = _oracle;
        pair = _pair;
        _addVaderPair(_vader, _pair, _updatePeriod);
    }

    /* ========== VIEWS ========== */
    /**
     * @notice Get Vader USD price calculated from Vader / ETH price from
     *         last update.
     **/
    function getStaleVaderPrice() external view returns (uint256) {
        return _calculateVaderPrice();
    }

    /**
     * @notice Get ETH / USD price from Chainlink. 1 USD = 1e8.
     **/
    function getChainlinkPrice() public view returns (uint256) {
        (uint80 roundID, int256 price, , , uint80 answeredInRound) = oracle
            .latestRoundData();
        require(answeredInRound >= roundID, "stale Chainlink price");
        require(price > 0, "chainlink price = 0");
        return uint256(price);
    }

    /**
     * @notice Helper function to decode and return Vader / ETH TWAP price
     **/
    function getVaderEthPriceAverage() public view returns (uint256) {
        return pairData.nativeTokenPriceAverage.mul(ONE_VADER).decode144();
    }

    /**
     * @notice Helper function to decode and return Vader / ETH spot price
     **/
    function getVaderEthSpotPrice() public view returns (uint256) {
        (uint256 reserve0, uint256 reserve1, ) = pair.getReserves();
        (uint256 vaderReserve, uint256 ethReserve) = pairData.isFirst
            ? (reserve0, reserve1)
            : (reserve1, reserve0);
        return
            FixedPoint
                .fraction(ethReserve, vaderReserve)
                .mul(ONE_VADER)
                .decode144();
    }

    /* ========== MUTATIVE FUNCTIONS ========== */
    /**
    * @notice Update Vader / ETH price and return Vader / USD price.
              This function will need to be executed at least twice to return
              sensible Vader / USD price.
    **/
    // NOTE: Fails until _updateVaderPrice is called atlease twice for
    // nativeTokenPriceAverage to be > 0
    function getVaderPrice() external returns (uint256) {
        _updateVaderPrice();
        return _calculateVaderPrice();
    }

    /**
     * @notice Update Vader / ETH price.
     **/
    function syncVaderPrice() external {
        _updateVaderPrice();
    }

    /**
     * @notice Update Vader / ETH price.
     **/
    function _updateVaderPrice() private {
        uint256 timeElapsed = block.timestamp - pairData.lastMeasurement;
        // NOTE: save gas and re-entrancy protection.
        if (timeElapsed < pairData.updatePeriod) return;
        bool isFirst = pairData.isFirst;
        (
            uint256 price0Cumulative,
            uint256 price1Cumulative,
            uint256 currentMeasurement
        ) = UniswapV2OracleLibrary.currentCumulativePrices(address(pair));
        uint256 priceCumulativeEnd = isFirst
            ? price0Cumulative
            : price1Cumulative;
        uint256 priceCumulativeStart = pairData.nativeTokenPriceCumulative;
        require(
            priceCumulativeEnd >= priceCumulativeStart,
            "price cumulative end < start"
        );
        unchecked {
            pairData.nativeTokenPriceAverage = FixedPoint.uq112x112(
                uint224(
                    (priceCumulativeEnd - priceCumulativeStart) / timeElapsed
                )
            );
        }
        pairData.nativeTokenPriceCumulative = priceCumulativeEnd;
        pairData.lastMeasurement = currentMeasurement;

        // check TWAP and spot price difference is not too big
        if (maxPriceDiff < MAX_PRICE_DIFF_DENOMINATOR) {
            // p = TWAP price
            // s = spot price
            // d = max price diff
            // D = MAX_PRICE_DIFF_DENOMINATOR
            // |p - s| / p <= d / D
            uint256 twapPrice = getVaderEthPriceAverage();
            uint256 spotPrice = getVaderEthSpotPrice();
            require(twapPrice > 0, "TWAP = 0");
            require(spotPrice > 0, "spot price = 0");
            // NOTE: if maxPriceDiff = 0, then this check will most likely fail
            require(
                (abs(twapPrice, spotPrice) * MAX_PRICE_DIFF_DENOMINATOR) /
                    twapPrice <=
                    maxPriceDiff,
                "price diff > max"
            );
        }
    }

    /**
     * @notice Calculates Vader price in USD, 1 USD = 1e18.
     **/
    function _calculateVaderPrice()
        private
        view
        returns (uint256 vaderUsdPrice)
    {
        // USD / ETH, 8 decimals
        uint256 usdPerEth = getChainlinkPrice();
        // ETH / Vader, 18 decimals
        uint256 ethPerVader = pairData
            .nativeTokenPriceAverage
            .mul(ONE_VADER)
            .decode144();
        // divide by 1e8 from Chainlink price
        vaderUsdPrice = (usdPerEth * ethPerVader) / 1e8;
        require(vaderUsdPrice > 0, "vader usd price = 0");
    }

    /**
     * @notice Initialize pairData.
     * @param _vader Address of Vader.
     * @param _pair Address of Vader / ETH Uniswap V2 pair.
     * @param _updatePeriod Amout of time that has to elapse before Vader / ETH
     *       TWAP can be updated.
     **/
    function _addVaderPair(
        address _vader,
        IUniswapV2Pair _pair,
        uint256 _updatePeriod
    ) private {
        require(_updatePeriod != 0, "update period = 0");
        bool isFirst = _pair.token0() == _vader;
        address nativeAsset = isFirst ? _pair.token0() : _pair.token1();
        require(nativeAsset == _vader, "unsupported pair");
        pairData.isFirst = isFirst;
        pairData.lastMeasurement = block.timestamp;
        _setUpdatePeriod(_updatePeriod);
        pairData.nativeTokenPriceCumulative = isFirst
            ? _pair.price0CumulativeLast()
            : _pair.price1CumulativeLast();
        // NOTE: pairData.nativeTokenPriceAverage = 0
    }

    /**
     * @notice Set Chainlink oracle.
     * @param _oracle Address of Chainlink price oracle.
     **/
    function setOracle(IAggregatorV3 _oracle) external onlyOwner {
        require(_oracle.decimals() == 8, "oracle decimals != 8");
        oracle = _oracle;
        emit SetOracle(address(_oracle));
    }

    /**
     * @notice Set updatePeriod.
     * @param _updatePeriod New update period for Vader / ETH TWAP
     **/
    function _setUpdatePeriod(uint256 _updatePeriod) private {
        require(_updatePeriod <= MAX_UPDATE_WINDOW, "update period > max");
        pairData.updatePeriod = _updatePeriod;
        maxUpdateWindow = _updatePeriod;
    }

    function setUpdatePeriod(uint256 _updatePeriod) external onlyOwner {
        _setUpdatePeriod(_updatePeriod);
    }

    /**
     * @notice Set maxPriceDiff.
     * @param _maxPriceDiff Numberator to calculate max allowed difference
     *        between Vader / ETH TWAP and spot price.
     **/
    function _setMaxPriceDiff(uint256 _maxPriceDiff) private {
        require(
            _maxPriceDiff <= MAX_PRICE_DIFF_DENOMINATOR,
            "price diff > max"
        );
        maxPriceDiff = _maxPriceDiff;
    }

    function setMaxPriceDiff(uint256 _maxPriceDiff) external onlyOwner {
        _setMaxPriceDiff(_maxPriceDiff);
    }

    /**
     * @notice Force update Vader TWAP price even if has deviated significantly
     *         from Vader / ETH spot price.
     */
    function forceUpdateVaderPrice() external onlyOwner {
        uint256 _maxPriceDiff = maxPriceDiff;
        _setMaxPriceDiff(MAX_PRICE_DIFF_DENOMINATOR);
        _updateVaderPrice();
        _setMaxPriceDiff(_maxPriceDiff);
    }
}
