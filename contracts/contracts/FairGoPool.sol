// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

import {ICoverageNFT} from "./interfaces/ICoverageNFT.sol";

/// @title FairGoPool
/// @notice Core protocol contract: members deposit AUDM into the coverage
///         pool, receive a soulbound coverage NFT, and lodge claims that the
///         oracle role can approve for fiat payout against the issuing council.
/// @dev Premiums and claim amounts are denominated in AUDM. Non-AUDM deposits
///      (USDC/USDT) are expected to be swapped to AUDM by the frontend before
///      hitting `deposit()`. Tiered pricing is intentionally deferred.
contract FairGoPool is AccessControl, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");
    bytes32 public constant TREASURY_ROLE = keccak256("TREASURY_ROLE");

    struct Position {
        uint256 tokenId;
        uint256 stake;
        uint64 lockedUntil;
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
        uint128 amount;
        ClaimStatus status;
        uint64 submittedAt;
        bytes32 infringementHash;
    }

    IERC20 public immutable audm;
    ICoverageNFT public immutable coverageNFT;

    uint64 public lockPeriod;

    mapping(uint256 => Position) public positionOf;
    Claim[] public claims;

    event Deposited(
        address indexed member,
        uint256 indexed tokenId,
        uint256 amount,
        bytes32 vehicleHash
    );
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
    event LockPeriodSet(uint64 lockPeriod);

    error PositionLocked();
    error NotMember();
    error ClaimNotPending();
    error ClaimNotApproved();
    error ZeroAddress();
    error ZeroAmount();

    constructor(IERC20 _audm, ICoverageNFT _coverageNFT, address admin, uint64 _lockPeriod) {
        if (address(_audm) == address(0) || address(_coverageNFT) == address(0) || admin == address(0)) {
            revert ZeroAddress();
        }
        audm = _audm;
        coverageNFT = _coverageNFT;
        lockPeriod = _lockPeriod;

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(TREASURY_ROLE, admin);

        emit LockPeriodSet(_lockPeriod);
    }

    // ---------------------------------------------------------------------
    // Admin
    // ---------------------------------------------------------------------

    function setLockPeriod(uint64 _lockPeriod) external onlyRole(DEFAULT_ADMIN_ROLE) {
        lockPeriod = _lockPeriod;
        emit LockPeriodSet(_lockPeriod);
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    // ---------------------------------------------------------------------
    // Member flow: deposit / withdraw
    // ---------------------------------------------------------------------

    /// @notice Stake AUDM into the pool and mint a soulbound coverage NFT.
    /// @param amount AUDM to stake.
    /// @param vehicleHash keccak256 of the member's plate/VIN, kept off-chain.
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
            lockedUntil: uint64(block.timestamp) + lockPeriod
        });

        emit Deposited(msg.sender, tokenId, amount, vehicleHash);
    }

    /// @notice Withdraw your stake after the lock period and burn the NFT.
    function withdraw(uint256 tokenId) external nonReentrant {
        if (coverageNFT.ownerOf(tokenId) != msg.sender) revert NotMember();
        Position memory pos = positionOf[tokenId];
        if (pos.stake == 0) revert NotMember();
        if (block.timestamp < pos.lockedUntil) revert PositionLocked();

        delete positionOf[tokenId];
        coverageNFT.burn(tokenId);
        audm.safeTransfer(msg.sender, pos.stake);

        emit Withdrawn(msg.sender, tokenId, pos.stake);
    }

    // ---------------------------------------------------------------------
    // Claims flow
    // ---------------------------------------------------------------------

    function submitClaim(uint256 tokenId, uint128 amount, bytes32 infringementHash)
        external
        whenNotPaused
        returns (uint256 claimId)
    {
        if (amount == 0) revert ZeroAmount();
        if (coverageNFT.ownerOf(tokenId) != msg.sender) revert NotMember();
        if (positionOf[tokenId].stake == 0) revert NotMember();

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

    /// @notice Treasury sweeps approved claims to the council/payee in fiat
    ///         off-chain. On-chain we mark as paid and transfer AUDM out of
    ///         the pool to the treasury so surplus accounting balances.
    function payClaim(uint256 claimId, address payee) external onlyRole(TREASURY_ROLE) nonReentrant {
        if (payee == address(0)) revert ZeroAddress();
        Claim storage c = claims[claimId];
        if (c.status != ClaimStatus.Approved) revert ClaimNotApproved();

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
}
