// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {FixedPointMathLib} from "solady/src/utils/FixedPointMathLib.sol";

import {ICoverageNFT} from "./interfaces/ICoverageNFT.sol";

/// @title FairGoPool
/// @notice Members deposit AUDM, get a soulbound coverage NFT, and accrue a
///         lifetime claim cap that grows logarithmically with tenure past a
///         fixed wait period.
/// @dev Coverage formula (per position, all WAD-scaled):
///         elapsed     = now - depositedAt
///         monthsPastW = max(0, elapsed - WAIT_PERIOD) / MONTH
///         multiplier  = K_WAD * ln(1 + monthsPastW)
///         lifetimeCap = stake * multiplier
///         available   = lifetimeCap - totalPaid
///      WAIT_PERIOD also gates withdrawals. K_WAD and WAIT_PERIOD are set at
///      deploy and never change — economics are immutable.
contract FairGoPool is AccessControl, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");
    bytes32 public constant TREASURY_ROLE = keccak256("TREASURY_ROLE");

    uint64 public constant MONTH = 30 days;
    uint256 private constant WAD = 1e18;

    IERC20 public immutable audm;
    ICoverageNFT public immutable coverageNFT;
    uint64 public immutable WAIT_PERIOD;
    uint256 public immutable K_WAD;

    struct Position {
        uint256 tokenId;
        uint256 stake;
        uint256 totalPaid;
        uint64 depositedAt;
    }

    enum ClaimStatus {
        Pending,
        Approved,
        Rejected,
        Paid
    }

    struct Claim {
        uint256 tokenId;
        address claimant;
        uint256 amount;
        ClaimStatus status;
        uint64 submittedAt;
        bytes32 infringementHash;
    }

    mapping(uint256 => Position) public positionOf;
    Claim[] public claims;

    event Deposited(address indexed member, uint256 indexed tokenId, uint256 amount, bytes32 vehicleHash);
    event Withdrawn(address indexed member, uint256 indexed tokenId, uint256 amount);
    event ClaimSubmitted(
        uint256 indexed claimId,
        uint256 indexed tokenId,
        address indexed claimant,
        uint256 amount,
        bytes32 infringementHash
    );
    event ClaimApproved(uint256 indexed claimId, uint256 amount);
    event ClaimRejected(uint256 indexed claimId);
    event ClaimPaid(uint256 indexed claimId, address indexed payee, uint256 amount);

    error PositionLocked();
    error NotMember();
    error ClaimNotPending();
    error ClaimNotApproved();
    error ExceedsCoverage();
    error ZeroAddress();
    error ZeroAmount();

    constructor(
        IERC20 _audm,
        ICoverageNFT _coverageNFT,
        address admin,
        uint64 _waitPeriod,
        uint256 _kWad
    ) {
        if (address(_audm) == address(0) || address(_coverageNFT) == address(0) || admin == address(0)) {
            revert ZeroAddress();
        }
        if (_kWad == 0) revert ZeroAmount();
        audm = _audm;
        coverageNFT = _coverageNFT;
        WAIT_PERIOD = _waitPeriod;
        K_WAD = _kWad;

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(TREASURY_ROLE, admin);
    }

    // ---------------------------------------------------------------------
    // Admin
    // ---------------------------------------------------------------------

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    // ---------------------------------------------------------------------
    // Member flow: deposit / withdraw
    // ---------------------------------------------------------------------

    function deposit(uint256 amount, bytes32 vehicleHash)
        external
        nonReentrant
        whenNotPaused
        returns (uint256 tokenId)
    {
        if (amount == 0) revert ZeroAmount();

        audm.safeTransferFrom(msg.sender, address(this), amount);

        tokenId = coverageNFT.mint(msg.sender, vehicleHash);

        positionOf[tokenId] = Position({
            tokenId: tokenId,
            stake: amount,
            totalPaid: 0,
            depositedAt: uint64(block.timestamp)
        });

        emit Deposited(msg.sender, tokenId, amount, vehicleHash);
    }

    function withdraw(uint256 tokenId) external nonReentrant {
        if (coverageNFT.ownerOf(tokenId) != msg.sender) revert NotMember();
        Position memory pos = positionOf[tokenId];
        if (pos.stake == 0) revert NotMember();
        if (block.timestamp < uint256(pos.depositedAt) + WAIT_PERIOD) revert PositionLocked();

        delete positionOf[tokenId];
        coverageNFT.burn(tokenId);
        audm.safeTransfer(msg.sender, pos.stake);

        emit Withdrawn(msg.sender, tokenId, pos.stake);
    }

    // ---------------------------------------------------------------------
    // Claims flow
    // ---------------------------------------------------------------------

    function submitClaim(uint256 tokenId, uint256 amount, bytes32 infringementHash)
        external
        whenNotPaused
        returns (uint256 claimId)
    {
        if (amount == 0) revert ZeroAmount();
        if (coverageNFT.ownerOf(tokenId) != msg.sender) revert NotMember();

        Position memory pos = positionOf[tokenId];
        if (pos.stake == 0) revert NotMember();
        if (amount > _availableCoverage(pos)) revert ExceedsCoverage();

        claimId = claims.length;
        claims.push(
            Claim({
                tokenId: tokenId,
                claimant: msg.sender,
                amount: amount,
                status: ClaimStatus.Pending,
                submittedAt: uint64(block.timestamp),
                infringementHash: infringementHash
            })
        );

        emit ClaimSubmitted(claimId, tokenId, msg.sender, amount, infringementHash);
    }

    function approveClaim(uint256 claimId) external onlyRole(ORACLE_ROLE) {
        Claim storage c = claims[claimId];
        if (c.status != ClaimStatus.Pending) revert ClaimNotPending();
        c.status = ClaimStatus.Approved;
        emit ClaimApproved(claimId, c.amount);
    }

    function rejectClaim(uint256 claimId) external onlyRole(ORACLE_ROLE) {
        Claim storage c = claims[claimId];
        if (c.status != ClaimStatus.Pending) revert ClaimNotPending();
        c.status = ClaimStatus.Rejected;
        emit ClaimRejected(claimId);
    }

    function payClaim(uint256 claimId, address payee) external onlyRole(TREASURY_ROLE) nonReentrant {
        if (payee == address(0)) revert ZeroAddress();
        Claim storage c = claims[claimId];
        if (c.status != ClaimStatus.Approved) revert ClaimNotApproved();

        Position storage pos = positionOf[c.tokenId];
        uint256 cap = (pos.stake * _multiplierWad(pos.depositedAt)) / WAD;
        if (pos.totalPaid + c.amount > cap) revert ExceedsCoverage();

        pos.totalPaid += c.amount;
        c.status = ClaimStatus.Paid;
        audm.safeTransfer(payee, c.amount);

        emit ClaimPaid(claimId, payee, c.amount);
    }

    // ---------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------

    function claimsLength() external view returns (uint256) {
        return claims.length;
    }

    /// @notice Current multiplier on stake (WAD-scaled). 0 during wait period.
    function coverageMultiplier(uint256 tokenId) external view returns (uint256) {
        Position memory pos = positionOf[tokenId];
        if (pos.stake == 0) return 0;
        return _multiplierWad(pos.depositedAt);
    }

    /// @notice Lifetime cap = stake * multiplier (in AUDM).
    function lifetimeCap(uint256 tokenId) external view returns (uint256) {
        return _lifetimeCap(positionOf[tokenId]);
    }

    /// @notice Coverage remaining = lifetimeCap - totalPaid.
    function coverageAvailable(uint256 tokenId) external view returns (uint256) {
        return _availableCoverage(positionOf[tokenId]);
    }

    // ---------------------------------------------------------------------
    // Internals
    // ---------------------------------------------------------------------

    function _multiplierWad(uint64 depositedAt) internal view returns (uint256) {
        uint256 elapsed = block.timestamp - uint256(depositedAt);
        if (elapsed <= WAIT_PERIOD) return 0;
        uint256 monthsPastWaitWad = ((elapsed - WAIT_PERIOD) * WAD) / MONTH;
        // ln(1 + monthsPastWait) in WAD via Solady.
        int256 lnVal = FixedPointMathLib.lnWad(int256(WAD + monthsPastWaitWad));
        // monthsPastWait >= 0, so 1 + monthsPastWait >= 1, so lnVal >= 0.
        return (K_WAD * uint256(lnVal)) / WAD;
    }

    function _lifetimeCap(Position memory pos) internal view returns (uint256) {
        if (pos.stake == 0) return 0;
        uint256 mWad = _multiplierWad(pos.depositedAt);
        return (pos.stake * mWad) / WAD;
    }

    function _availableCoverage(Position memory pos) internal view returns (uint256) {
        uint256 cap = _lifetimeCap(pos);
        if (cap <= pos.totalPaid) return 0;
        return cap - pos.totalPaid;
    }
}
