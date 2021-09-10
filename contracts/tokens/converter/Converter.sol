// SPDX-License-Identifier: Unlicense

pragma solidity =0.6.8;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "../../shared/ProtocolConstants.sol";

import "../../interfaces/tokens/converter/IConverter.sol";

/**
 * @dev Implementation of the {IConverter} interface.
 *
 * A simple converter contract that allows users to convert
 * their Vether tokens by "burning" them (See {convert}) to
 * acquire their equivalent Vader tokens based on the constant
 * {VADER_VETHER_CONVERSION_RATE}.
 *
 * The contract assumes that it has been sufficiently funded with
 * Vader tokens and will fail to execute trades if it has not been
 * done so yet.
 */
contract Converter is IConverter, ProtocolConstants {
    /* ========== LIBRARIES ========== */

    // Used for safe VADER & VETHER transfers
    using SafeERC20 for IERC20;

    // Used to safely calculate VADER amount
    using SafeMath for uint256;

    /* ========== STATE VARIABLES ========== */

    // The VETHER token
    IERC20 public immutable vether;

    // The VADER token
    IERC20 public immutable vader;

    /* ========== CONSTRUCTOR ========== */

    /**
     * @dev Initializes the contract's {vether} and {vader} addresses.
     *
     * Performs rudimentary checks to ensure that the variables haven't
     * been declared incorrectly.
     */
    constructor(IERC20 _vether, IERC20 _vader) public {
        require(
            _vether != IERC20(0) && _vader != IERC20(0),
            "Converter::constructor: Misconfiguration"
        );

        vether = _vether;
        vader = _vader;
    }

    /* ========== MUTATIVE FUNCTIONS ========== */

    /**
     * @dev Allows a user to convert their Vether to Vader.
     *
     * Emits a {Conversion} event indicating the amount of Vether the user
     * "burned" and the amount of Vader that they acquired.
     *
     * Here, "burned" refers to the action of transferring them to an irrecoverable
     * address, the {BURN} address.
     *
     * Requirements:
     *
     * - the caller has approved the contract for the necessary amount via Vether
     * - the amount specified is non-zero
     * - the contract has been supplied with the necessary Vader amount to fulfill the trade
     */
    function convert(uint256 amount)
        external
        override
        returns (uint256 vaderReceived)
    {
        require(
            amount != 0,
            "Converter::convert: Non-Zero Conversion Amount Required"
        );

        vaderReceived = amount.mul(_VADER_VETHER_CONVERSION_RATE);

        emit Conversion(msg.sender, amount, vaderReceived);

        vether.safeTransferFrom(msg.sender, _BURN, amount);
        vader.safeTransfer(msg.sender, vaderReceived);
    }
}
