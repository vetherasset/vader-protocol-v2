// SPDX-License-Identifier: MIT AND AGPL-3.0-or-later

pragma solidity =0.8.9;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "../shared/ProtocolConstants.sol";

import "../interfaces/reserve/IVaderReserve.sol";
import "../interfaces/lbt/ILiquidityBasedTWAP.sol";

contract VaderReserve is IVaderReserve, ProtocolConstants, Ownable {
    /* ========== LIBRARIES ========== */

    // Used for safe VADER transfers
    using SafeERC20 for IERC20;

    /* ========== STATE VARIABLES ========== */

    // The Vader token the reserve is handling
    IERC20 public immutable vader;

    // Router address for IL awards
    address public router;

    // Tracks last grant time for throttling
    uint256 public lastGrant;

    // LBT used for loss reimbursement
    ILiquidityBasedTWAP public lbt;

    /* ========== CONSTRUCTOR ========== */

    constructor(IERC20 _vader) {
        require(
            _vader != IERC20(_ZERO_ADDRESS),
            "VaderReserve::constructor: Incorrect Arguments"
        );
        vader = _vader;
    }

    /* ========== VIEWS ========== */

    function reserve() public view override returns (uint256) {
        return vader.balanceOf(address(this));
    }

    /* ========== MUTATIVE FUNCTIONS ========== */

    function grant(address recipient, uint256 amount)
        external
        override
        onlyOwner
        throttle
    {
        amount = _min(
            (reserve() * _MAX_GRANT_BASIS_POINTS) / _MAX_BASIS_POINTS,
            amount
        );
        vader.safeTransfer(recipient, amount);

        emit GrantDistributed(recipient, amount);
    }

    /* ========== RESTRICTED FUNCTIONS ========== */

    function initialize(
        ILiquidityBasedTWAP _lbt,
        address _router,
        address _dao
    ) external onlyOwner {
        require(
            _router != _ZERO_ADDRESS &&
                _lbt != ILiquidityBasedTWAP(_ZERO_ADDRESS),
            "VaderReserve::initialize: Incorrect Arguments"
        );
        router = _router;
        lbt = _lbt;
        transferOwnership(_dao);
    }

    function reimburseImpermanentLoss(address recipient, uint256 amount)
        external
        override
    {
        require(
            msg.sender == router,
            "VaderReserve::reimburseImpermanentLoss: Insufficient Priviledges"
        );

        // NOTE: Loss is in USDV, reimbursed in VADER
        // NOTE: If USDV LBT is working, prefer it otherwise use VADER price
        if (lbt.previousPrices(uint256(ILiquidityBasedTWAP.Paths.USDV)) != 0) {
            uint256 usdvPrice = lbt.getUSDVPrice();

            amount = amount / usdvPrice;
        } else {
            uint256 vaderPrice = lbt.getVaderPrice();

            amount = amount * vaderPrice;
        }

        uint256 actualAmount = _min(reserve(), amount);

        vader.safeTransfer(recipient, actualAmount);

        emit LossCovered(recipient, amount, actualAmount);
    }

    /* ========== INTERNAL FUNCTIONS ========== */

    /* ========== PRIVATE FUNCTIONS ========== */

    /**
     * @dev Calculates the minimum of the two values
     */
    function _min(uint256 a, uint256 b) private pure returns (uint256) {
        return a < b ? a : b;
    }

    /* ========== MODIFIERS ========== */

    modifier throttle() {
        require(
            lastGrant + _GRANT_DELAY <= block.timestamp,
            "VaderReserve::throttle: Grant Too Fast"
        );
        lastGrant = block.timestamp;
        _;
    }
}
