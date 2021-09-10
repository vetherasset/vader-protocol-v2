// SPDX-License-Identifier: Unlicense

pragma solidity =0.6.8;

import "@openzeppelin/contracts/access/Ownable.sol";

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "../../shared/ProtocolConstants.sol";

import "../../interfaces/tokens/vesting/ILinearVesting.sol";

/**
 * @dev Implementation of the {ILinearVesting} interface.
 *
 * The straightforward vesting contract that gradually releases a
 * fixed supply of tokens to multiple vest parties over a 2 year
 * window.
 *
 * The token expects the {begin} hook to be invoked the moment
 * it is supplied with the necessary amount of tokens to vest,
 * which should be equivalent to the time the {setComponents}
 * function is invoked on the Vader token.
 */
contract LinearVesting is ILinearVesting, ProtocolConstants, Ownable {
    /* ========== LIBRARIES ========== */

    // Used to calculate vested amount safely
    using SafeMath for uint256;

    // Used for safe VADER transfers
    using SafeERC20 for IERC20;

    /* ========== STATE VARIABLES ========== */

    // The Vader token
    IERC20 public immutable vader;

    // The start of the vesting period
    uint256 public start;

    // The end of the vesting period
    uint256 public end;

    // The status of each vesting member (Vester)
    mapping(address => Vester) public vest;

    /* ========== CONSTRUCTOR ========== */

    /**
     * @dev Initializes the contract's vesters and vesting amounts as well as sets
     * the Vader token address.
     *
     * It conducts a sanity check to ensure that the total vesting amounts specified match
     * the team allocation to ensure that the contract is deployed correctly.
     *
     * Additionally, it transfers ownership to the Vader contract that needs to consequently
     * initiate the vesting period via {begin} after it mints the necessary amount to the contract.
     */
    constructor(
        IERC20 _vader,
        address[] memory vesters,
        uint192[] memory amounts
    ) public {
        require(
            _vader != IERC20(0) && vesters.length == amounts.length,
            "LinearVesting::constructor: Misconfiguration"
        );

        vader = _vader;

        uint256 total;
        for (uint256 i = 0; i < vesters.length; i++) {
            require(
                amounts[i] != 0,
                "LinearVesting::constructor: Incorrect Amount Specified"
            );
            vest[vesters[i]].amount = amounts[i];
            total = total.add(amounts[i]);
        }
        require(
            total == _TEAM_ALLOCATION,
            "LinearVesting::constructor: Invalid Vest Amounts Specified"
        );

        transferOwnership(address(_vader));
    }

    /* ========== VIEWS ========== */

    /**
     * @dev Returns the amount a user can claim at a given point in time.
     *
     * Requirements:
     * - the vesting period has started
     */
    function getClaim()
        external
        view
        override
        hasStarted
        returns (uint256 vestedAmount)
    {
        Vester memory vester = vest[msg.sender];
        return _getClaim(vester.amount, vester.lastClaim);
    }

    /* ========== MUTATIVE FUNCTIONS ========== */

    /**
     * @dev Allows a user to claim their pending vesting amount.
     *
     * Emits a {Vested} event indicating the user who claimed their vested tokens
     * as well as the amount that was vested.
     *
     * Requirements:
     *
     * - the vesting period has started
     * - the caller must have a non-zero vested amount
     */
    function claim()
        external
        override
        hasStarted
        returns (uint256 vestedAmount)
    {
        Vester memory vester = vest[msg.sender];

        vestedAmount = _getClaim(vester.amount, vester.lastClaim);

        require(vestedAmount != 0, "LinearVesting::claim: Nothing to claim");

        // NOTE: Guaranteed to not overflow on cast or underflow on subtraction as vestedAmount <= vester.amount
        vester.amount -= uint192(vestedAmount);
        vester.lastClaim = _cast(block.timestamp);

        vest[msg.sender] = vester;

        emit Vested(msg.sender, vestedAmount);

        vader.safeTransfer(msg.sender, vestedAmount);
    }

    /* ========== RESTRICTED FUNCTIONS ========== */

    /**
     * @dev Allows the vesting period to be initiated.
     *
     * Emits a {VestingInitialized} event from which the start and
     * end can be calculated via it's attached timestamp.
     *
     * Requirements:
     *
     * - the caller must be the owner (vader token)
     */
    function begin() external override onlyOwner {
        start = block.timestamp;
        end = block.timestamp + _VESTING_DURATION;

        emit VestingInitialized(_VESTING_DURATION);

        renounceOwnership();
    }

    /* ========== PRIVATE FUNCTIONS ========== */

    /**
     * @dev Calculates the amount a user's vest is due. To calculate,
     * the following formula is utilized:
     *
     * - (remainingAmount * timeElapsed) / timeUntilEnd
     *
     * Each variable is described as follows:
     *
     * - remainingAmount (amount): Vesting amount remaining. Each claim subtracts from
     * this amount to ensure calculations are properly conducted.
     *
     * - timeElapsed (block.timestamp.sub(lastClaim)): Time that has elapsed since the
     * last claim.
     *
     * - timeUntilEnd (end.sub(lastClaim)): Time remaining for the particular vesting
     * member's total duration.
     *
     * Vesting calculations are relative and always update the last
     * claim timestamp as well as remaining amount whenever they
     * are claimed.
     */
    function _getClaim(uint256 amount, uint256 lastClaim)
        private
        view
        returns (uint256)
    {
        uint256 _end = end;

        if (block.timestamp >= _end) return amount;
        if (lastClaim == 0) lastClaim = start;

        return amount.mul(block.timestamp.sub(lastClaim)) / _end.sub(lastClaim);
    }

    /**
     * @dev Validates that the vesting period has started
     */
    function _hasStarted() private view {
        require(
            start != 0,
            "LinearVesting::_hasStarted: Vesting hasn't started yet"
        );
    }

    /**
     * @dev Safely casts the provided timestamp to a uint64.
     *
     * A uint64 variable can hold Unix timestamps for billions of years
     * and as such is a suitable value for our purpose, however, we implement
     * this function as a sanity check.
     */
    function _cast(uint256 ts) private pure returns (uint64) {
        require(
            ts <= type(uint64).max,
            "LinearVesting::_cast: Timestamp out of bounds"
        );
        return uint64(ts);
    }

    /* ========== MODIFIERS ========== */

    /**
     * @dev Throws if the vesting period hasn't started
     */
    modifier hasStarted() {
        _hasStarted();
        _;
    }
}
