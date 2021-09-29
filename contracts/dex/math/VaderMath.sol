// SPDX-License-Identifier: Unlicense

pragma solidity =0.6.8;

import "@openzeppelin/contracts/math/SafeMath.sol";

library VaderMath {
    using SafeMath for uint256;

    /* ========== CONSTANTS ========== */

    uint256 public constant ONE = 1 ether;

    /* ========== LIBRARY FUNCTIONS ========== */

    function calculateLiquidityUnits(
        uint256 vaderDeposited,
        uint256 vaderBalance,
        uint256 assetDeposited,
        uint256 assetBalance,
        uint256 totalPoolUnits
    ) public pure returns (uint256) {
        // slipAdjustment
        uint256 slip = calculateSlipAdjustment(
            vaderDeposited,
            vaderBalance,
            assetDeposited,
            assetBalance
        );

        // (Va + vA)
        uint256 poolUnitFactor = vaderBalance.mul(assetDeposited).add(
            vaderDeposited.mul(assetBalance)
        );

        // 2VA
        uint256 denominator = ONE.mul(2).mul(vaderBalance).mul(assetBalance);

        // P * [(Va + vA) / (2 * V * A)] * slipAdjustment
        return totalPoolUnits.mul(poolUnitFactor).div(denominator).mul(slip);
    }

    function calculateSlipAdjustment(
        uint256 vaderDeposited,
        uint256 vaderBalance,
        uint256 assetDeposited,
        uint256 assetBalance
    ) public pure returns (uint256) {
        // Va
        uint256 vaderAsset = vaderBalance.mul(assetDeposited);

        // aV
        uint256 assetVader = assetBalance.mul(vaderDeposited);

        // (v + V) * (a + A)
        uint256 denominator = vaderDeposited.add(vaderBalance).mul(
            assetDeposited.add(assetBalance)
        );

        // 1 - [|Va - aV| / (v + V) * (a + A)]
        return ONE.sub(delta(vaderAsset, assetVader).div(denominator));
    }

    function calculateLoss(
        uint256 originalVader,
        uint256 originalAsset,
        uint256 releasedVader,
        uint256 releasedAsset
    ) public pure returns (uint256) {
        // [(A0 * P1) + V0]
        uint256 originalValue = originalAsset
            .mul(releasedVader)
            .div(releasedAsset)
            .add(originalVader);

        // [(A1 * P1) + V1]
        uint256 releasedValue = releasedAsset
            .mul(releasedVader)
            .div(releasedAsset)
            .add(releasedVader);

        // [(A0 * P1) + V0] - [(A1 * P1) + V1]
        if (originalValue > releasedValue) return originalValue - releasedValue;
    }

    function calculateSwap(
        uint256 amountIn,
        uint256 reserveIn,
        uint256 reserveOut
    ) public pure returns (uint256) {
        // x * Y * X
        uint256 numerator = amountIn.mul(reserveIn).mul(reserveOut);

        // (x + X) ^ 2
        uint256 denominator = pow(amountIn.add(reserveIn));

        return numerator.div(denominator);
    }

    function delta(uint256 a, uint256 b) public pure returns (uint256) {
        return a > b ? a - b : b - a;
    }

    function pow(uint256 a) public pure returns (uint256) {
        return a.mul(a);
    }
}
