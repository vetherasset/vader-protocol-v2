// SPDX-License-Identifier: Unlicense

pragma solidity =0.8.9;

interface IVader {
    /* ========== FUNCTIONS ========== */

    function syncEmissions() external;

    function calculateFee() external view returns (uint256 basisPoints);

    function getCurrentEraEmission() external view returns (uint256);

    function getEraEmission(uint256 currentSupply)
        external
        view
        returns (uint256);

    /* ========== EVENTS ========== */

    event Emission(uint256 amount, uint256 lastEmission);

    event EmissionChanged(uint256 previous, uint256 next);

    event MaxSupplyChanged(uint256 previous, uint256 next);

    event GrantClaimed(address indexed beneficiary, uint256 amount);

    event ProtocolInitialized(
        address converter,
        address vest,
        address usdv,
        address dao
    );
}
