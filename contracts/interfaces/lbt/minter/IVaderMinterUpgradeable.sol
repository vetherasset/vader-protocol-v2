// SPDX-License-Identifier: MIT AND AGPL-3.0-or-later

pragma solidity =0.8.9;

interface IVaderMinterUpgradeable {
    /* ========== STRUCTS ========== */

    struct Limits {
        uint256 fee;
        uint256 mintLimit;
        uint256 burnLimit;
    }

    /* ========== FUNCTIONS ========== */
    function mint(uint256 vAmount, uint256 uAmountMinOut)
        external
        returns (uint256 uAmount);

    function burn(uint256 uAmount, uint256 vAmountMinOut)
        external
        returns (uint256 vAmount);

    function partnerMint(uint256 vAmount) external returns (uint256 uAmount);

    function partnerBurn(uint256 uAmount) external returns (uint256 vAmount);

    /* ========== EVENTS ========== */

    event PublicMintCapChanged(
        uint256 previousPublicMintCap,
        uint256 publicMintCap
    );

    event PublicMintFeeChanged(
        uint256 previousPublicMintFee,
        uint256 publicMintFee
    );

    event PartnerMintCapChanged(
        uint256 previousPartnerMintCap,
        uint256 partnerMintCap
    );

    event PartnerMintFeeChanged(
        uint256 previousPartnercMintFee,
        uint256 partnerMintFee
    );

    event DailyLimitsChanged(Limits previousLimits, Limits nextLimits);
    event WhitelistPartner(
        address partner,
        uint256 mintLimit,
        uint256 burnLimit,
        uint256 fee
    );
}
