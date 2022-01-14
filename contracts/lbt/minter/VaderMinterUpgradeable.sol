// SPDX-License-Identifier: MIT AND AGPL-3.0-or-later

pragma solidity =0.8.9;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import "../../shared/ProtocolConstants.sol";

import "../../interfaces/lbt/ILiquidityBasedTWAP.sol";
import "../../interfaces/lbt/minter/IVaderMinterUpgradeable.sol";
import "../../interfaces/tokens/IUSDV.sol";

contract VaderMinterUpgradeable is
    IVaderMinterUpgradeable,
    ProtocolConstants,
    OwnableUpgradeable
{
    // The LBT pricing mechanism for the conversion
    ILiquidityBasedTWAP public lbt;

    // The 24 hour limits on USDV mints that are available for public minting and burning as well as the fee.
    Limits public dailyLimits;

    // The current cycle end timestamp
    uint256 public cycleTimestamp;

    // The current cycle cumulative mints
    uint256 public cycleMints;

    // The current cycle cumulative burns
    uint256 public cycleBurns;

    // The limits applied to each partner
    mapping(address => Limits) public partnerLimits;

    // Transmuter Contract
    address public transmuter;

    // USDV Contract for Mint / Burn Operations
    IUSDV public usdv;

    /* ========== CONSTRUCTOR ========== */

    function initialize() external initializer {
        __Ownable_init();
        cycleTimestamp = block.timestamp;
    }

    /* ========== VIEWS ========== */

    function getPublicFee() public view returns (uint256) {
        // 24 hours passed, reset fee to 100%
        if (block.timestamp >= cycleTimestamp) {
            return dailyLimits.fee;
        }

        // cycle timestamp > block.timestamp, fee < 100%
        return
            (dailyLimits.fee * (cycleTimestamp - block.timestamp)) / 24 hours;
    }

    /* ========== MUTATIVE FUNCTIONS ========== */

    // function transmute() external {
    //     require(
    //         msg.sender == transmuter,
    //         "VMU::transmute: Unauthorized Caller"
    //     );
    // }

    /*
     * @dev Public mint function that receives Vader and mints USDV.
     * @param vAmount Vader amount to burn.
     * @param uAmountMinOut USDV minimum amount to get back from the mint.
     * @returns uAmount in USDV, represents the USDV amount received from the mint.
     **/
    function mint(uint256 vAmount, uint256 uAmountMinOut)
        external
        returns (uint256 uAmount)
    {
        uint256 vPrice = lbt.getVaderPrice();

        uAmount = (vPrice * vAmount) / 1e18;

        require(
            uAmount >= uAmountMinOut,
            "VMU::mint: Insufficient Trade Output"
        );

        if (cycleTimestamp <= block.timestamp) {
            cycleTimestamp = block.timestamp + 24 hours;
            cycleMints = uAmount;
        } else {
            cycleMints += uAmount;
        }

        require(
            cycleMints <= dailyLimits.mintLimit,
            "VMU::mint: 24 Hour Limit Reached"
        );

        usdv.mint(
            msg.sender,
            vAmount,
            uAmount,
            getPublicFee(),
            lbt.maxUpdateWindow()
        );
        return uAmount;
    }

    /*
     * @dev Public burn function that receives USDV and mints Vader.
     * @param uAmount USDV amount to burn.
     * @param vAmountMinOut Vader minimum amount to get back from the burn.
     * @returns vAmount in Vader, represents the Vader amount received from the burn.
     *
     **/
    function burn(uint256 uAmount, uint256 vAmountMinOut)
        external
        returns (uint256 vAmount)
    {
        uint256 vPrice = lbt.getVaderPrice();

        vAmount = (1e18 * uAmount) / vPrice;

        require(
            vAmount >= vAmountMinOut,
            "VMU::burn: Insufficient Trade Output"
        );

        if (cycleTimestamp <= block.timestamp) {
            cycleTimestamp = block.timestamp + 24 hours;
            cycleBurns = uAmount;
        } else {
            cycleBurns += uAmount;
        }

        require(
            cycleBurns <= dailyLimits.burnLimit,
            "VMU::mint: 24 Hour Limit Reached"
        );

        usdv.burn(
            msg.sender,
            uAmount,
            vAmount,
            getPublicFee(),
            lbt.maxUpdateWindow()
        );
        return vAmount;
    }

    /* ========== RESTRICTED FUNCTIONS ========== */

    /*
     * @dev Partner mint function that receives Vader and mints USDV.
     * @param vAmount Vader amount to burn.
     * @returns uAmount in USDV, represents the USDV amount received from the mint.
     *
     * Requirements:
     * - Can only be called by whitelisted partners.
     **/
    function partnerMint(uint256 vAmount) external returns (uint256 uAmount) {
        require(
            partnerLimits[msg.sender].mintLimit != 0,
            "VMU::partnerMint: Not Whitelisted"
        );
        uint256 vPrice = lbt.getVaderPrice();

        uAmount = (vPrice * vAmount) / 1e18;

        Limits storage _partnerLimits = partnerLimits[msg.sender];

        require(
            uAmount <= _partnerLimits.mintLimit,
            "VMU::partnerMint: Mint Limit Reached"
        );

        unchecked {
            _partnerLimits.mintLimit -= uAmount;
        }

        usdv.mint(
            msg.sender,
            vAmount,
            uAmount,
            _partnerLimits.fee,
            lbt.maxUpdateWindow()
        );
        return uAmount;
    }

    /*
     * @dev Partner burn function that receives USDV and mints Vader.
     * @param uAmount USDV amount to burn.
     * @returns vAmount in Vader, represents the Vader amount received from the mint.
     *
     * Requirements:
     * - Can only be called by whitelisted partners.
     **/
    function partnerBurn(uint256 uAmount) external returns (uint256 vAmount) {
        require(
            partnerLimits[msg.sender].burnLimit != 0,
            "VMU::partnerBurn: Not Whitelisted"
        );
        uint256 vPrice = lbt.getVaderPrice();

        vAmount = (1e18 * uAmount) / vPrice;

        Limits storage _partnerLimits = partnerLimits[msg.sender];

        require(
            vAmount <= _partnerLimits.burnLimit,
            "VMU::partnerBurn: Burn Limit Reached"
        );

        unchecked {
            _partnerLimits.burnLimit -= vAmount;
        }

        usdv.burn(
            msg.sender,
            uAmount,
            vAmount,
            _partnerLimits.fee,
            lbt.maxUpdateWindow()
        );
        return vAmount;
    }

    /*
     * @dev Sets the daily limits for public mints represented by the param {_dailyMintLimit}.
     *
     * Requirements:
     * - Only existing owner can call this function.
     **/
    function setDailyLimits(Limits calldata _dailyLimits) external onlyOwner {
        require(
            _dailyLimits.fee <= _MAX_BASIS_POINTS,
            "VMU::setDailyLimits: Invalid Fee"
        );

        emit DailyLimitsChanged(dailyLimits, _dailyLimits);
        dailyLimits = _dailyLimits;
    }

    /*
     * @dev Sets the a partner address {_partner }  to a given limit {_limits} that represents the ability
     * to mint USDV from the reserve partners minting allocation.
     *
     * Requirements:
     * - Only existing owner can call this function.
     * - Param {_partner} cannot be a zero address.
     * - Param {_limits} mint/burn limits can not be 0.
     * - Param {_limits} fee can not be bigger than _MAX_BASIS_POINTS.
     **/
    function whitelistPartner(address _partner, Limits calldata _limits)
        external
        onlyOwner
    {
        require(_partner != address(0), "VMU::whitelistPartner: Zero Address");
        require(
            _limits.fee <= _MAX_BASIS_POINTS,
            "VMU::whitelistPartner: Invalid Fee"
        );
        emit WhitelistPartner(
            _partner,
            _limits.mintLimit,
            _limits.burnLimit,
            _limits.fee
        );
        partnerLimits[_partner] = _limits;
    }

    /*
     * @dev Sets the transmuter contract address represented by the param {_transmuter}.
     *
     * Requirements:
     * - Only existing owner can call this function.
     * - Param {_transmuter} can not be address ZERO.
     **/
    function setTransmuterAddress(address _transmuter) external onlyOwner {
        require(
            _transmuter != address(0),
            "VMU::setTransmuterAddress: Zero Address"
        );
        transmuter = _transmuter;
    }

    /*
     * @dev Sets the lbt contract address represented by the param {_lbt}.
     *
     * Requirements:
     * - Only existing owner can call this function.
     * - Param {_lbt} can not be address ZERO.
     **/
    function setLBT(ILiquidityBasedTWAP _lbt) external onlyOwner {
        require(
            _lbt != ILiquidityBasedTWAP(address(0)),
            "VMU::setLBT: Insufficient Privileges"
        );
        lbt = _lbt;
    }

    /*
     * @dev Sets the usdv contract address represented by the param {_usdv}.
     *
     * Requirements:
     * - Only existing owner can call this function.
     * - Param {_usdv} can not be address ZERO.
     **/
    function setUSDV(IUSDV _usdv) external onlyOwner {
        require(
            usdv != IUSDV(address(0)),
            "VMU::setUSDV: Insufficient Privileges"
        );
        usdv = _usdv;
    }
}
