// SPDX-License-Identifier: Unlicense

pragma solidity =0.8.9;

import "./BasePoolV2.sol";

import "../../interfaces/dex-v2/pool/IVaderPoolV2.sol";

contract VaderPoolV2 is IVaderPoolV2, BasePoolV2 {
    /* ========== STATE VARIABLES ========== */

    // Denotes whether the queue system is active
    bool public queueActive;

    /* ========== CONSTRUCTOR ========== */

    constructor(bool _queueActive, IERC20 _nativeAsset)
        BasePoolV2(_nativeAsset)
    {
        queueActive = _queueActive;
    }

    /* ========== VIEWS ========== */

    /* ========== MUTATIVE FUNCTIONS ========== */

    // NOTE: IL is only covered via router!
    function burn(uint256 id, address to)
        external
        override
        returns (
            uint256 amountNative,
            uint256 amountForeign,
            uint256 coveredLoss
        )
    {
        (amountNative, amountForeign) = _burn(id, to);

        Position storage position = positions[id];

        uint256 creation = position.creation;
        uint256 originalNative = position.originalNative;
        uint256 originalForeign = position.originalForeign;

        delete positions[id];

        // NOTE: Validate it behaves as expected for non-18 decimal tokens
        uint256 loss = VaderMath.calculateLoss(
            originalNative,
            originalForeign,
            amountNative,
            amountForeign
        );

        // TODO: Original Implementation Applied 100 Days
        coveredLoss =
            (loss * _min(block.timestamp - creation, _ONE_YEAR)) /
            _ONE_YEAR;
    }

    /* ========== RESTRICTED FUNCTIONS ========== */

    // TODO: Investigate Necessity
    function toggleQueue() external override onlyOwner {
        bool _queueActive = !queueActive;
        queueActive = _queueActive;
        emit QueueActive(_queueActive);
    }

    function setTokenSupport(IERC20 foreignAsset, bool support)
        external
        override
        onlyOwner
    {
        require(
            supported[foreignAsset] != support,
            "VaderPoolV2::supportToken: Already At Desired State"
        );
        supported[foreignAsset] = support;
    }

    /* ========== INTERNAL FUNCTIONS ========== */

    /* ========== PRIVATE FUNCTIONS ========== */

    /**
     * @dev Calculates the minimum of the two values
     */
    function _min(uint256 a, uint256 b) private pure returns (uint256) {
        return a < b ? a : b;
    }
}
