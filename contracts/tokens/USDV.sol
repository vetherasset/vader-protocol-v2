// SPDX-License-Identifier: MIT AND AGPL-3.0-or-later

pragma solidity =0.8.9;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import "../shared/ProtocolConstants.sol";

import "../interfaces/tokens/IUSDV.sol";
import "../interfaces/reserve/IVaderReserve.sol";

// TBD
contract USDV is IUSDV, ProtocolConstants, ERC20, Ownable {
    /* ========== STATE VARIABLES ========== */

    IERC20 public immutable vader;

    /* ========== CONSTRUCTOR ========== */

    constructor(IERC20 _vader, IVaderReserve _reserve)
        ERC20("Vader USD", "USDV")
    {
        require(
            _reserve != IVaderReserve(_ZERO_ADDRESS),
            "USDV::constructor: Incorrect Arguments"
        );
        vader = _vader;
    }

    /* ========== VIEWS ========== */

    /* ========== MUTATIVE FUNCTIONS ========== */

    /* ========== RESTRICTED FUNCTIONS ========== */

    /* ========== INTERNAL FUNCTIONS ========== */

    /* ========== PRIVATE FUNCTIONS ========== */

    /* ========== MODIFIERS ========== */
}
