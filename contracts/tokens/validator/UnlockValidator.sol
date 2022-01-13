// SPDX-License-Identifier: MIT AND AGPL-3.0-or-later

pragma solidity =0.8.9;

import "@openzeppelin/contracts/access/Ownable.sol";

import "../../interfaces/tokens/validator/IUnlockValidator.sol";

contract UnlockValidator is IUnlockValidator, Ownable {
    /* ========== STATE VARIABLES ========== */

    // Mapping of blocked unlock accounts
    mapping(address => bool) private _isInvalidated;

    /* ========== VIEWS ========== */

    function isValid(address user, uint256, IUSDV.LockTypes)
        external
        override
        view
        returns (bool)
    {
        return !_isInvalidated[user];
    }

    /* ========== RESTRICTED FUNCTIONS ========== */

    /*
     * @dev Sets an address as invalidated
     *
     * Requirements:
     * - Only existing owner can call this function.
     **/
    function invalidate(address _account) external onlyOwner {
        require(!_isInvalidated[_account], "UnlockValidator::invalidate: Already Invalid");
        _isInvalidated[_account] = true;
    }

    /*
     * @dev Removes invalidation from an address
     *
     * Requirements:
     * - Only existing owner can call this function.
     **/
    function validate(address _account) external onlyOwner {
        require(_isInvalidated[_account], "UnlockValidator::validate: Already Valid");
        _isInvalidated[_account] = false;
    }
}
