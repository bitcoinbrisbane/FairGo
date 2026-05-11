// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {FixedPointMathLib} from "solady/src/utils/FixedPointMathLib.sol";

import {ICoverageNFT} from "./interfaces/ICoverageNFT.sol";
import {IUniswapV3SwapRouter} from "./interfaces/IUniswapV3SwapRouter.sol";
import {IAaveV3Pool} from "./interfaces/IAaveV3Pool.sol";

/// @title FairGoPool
/// @notice Members deposit AUDM, receive a soulbound coverage NFT, and accrue
///         a lifetime claim cap that grows logarithmically with tenure past a
///         fixed wait period.
///
///         Capital management:
///           - 80% of every deposit is swapped AUDM → USDT on Uniswap V3 and
///             supplied to AAVE V3 to earn yield.
///           - 20% stays in the pool as an AUDM liquidity buffer so most
///             claims and withdrawals can be paid without unwinding AAVE.
///           - When the buffer is short, the pool withdraws USDT from AAVE
///             and swaps it back to AUDM via exactOutputSingle, sized to the
///             shortfall. Yield stays in AAVE, growing TVL as a solvency
///             cushion — coverage caps remain stake-based.
///
///         Coverage formula (per position, all WAD-scaled):
///             elapsed     = now - depositedAt
///             monthsPastW = max(0, elapsed - WAIT_PERIOD) / MONTH
///             multiplier  = K_WAD * ln(1 + monthsPastW)
///             lifetimeCap = stake * multiplier        (stake is original AUDM)
///             available   = lifetimeCap - totalPaid
///         WAIT_PERIOD also gates withdrawals. K_WAD, WAIT_PERIOD, and the
///         invest split are immutable — economics are immutable.
contract FairGoPool is AccessControl, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");
    bytes32 public constant TREASURY_ROLE = keccak256("TREASURY_ROLE");

    uint64 public constant MONTH = 30 days;
    uint256 private constant WAD = 1e18;

    uint256 public constant BPS = 10_000;
    uint256 public constant INVEST_BPS = 8_000; // 80% deployed to USDT/AAVE

    IERC20 public immutable audm;
    IERC20 public immutable usdt;
    /// @notice Interest-bearing aUSDT — its `balanceOf(this)` equals USDT
    ///         principal plus accrued AAVE yield, used by `harvest()`.
    IERC20 public immutable aUsdt;
    ICoverageNFT public immutable coverageNFT;
    IUniswapV3SwapRouter public immutable swapRouter;
    IAaveV3Pool public immutable aavePool;
    uint24 public immutable swapFeeTier;
    uint64 public immutable WAIT_PERIOD;
    uint256 public immutable K_WAD;

    /// @notice Running total of USDT supplied to AAVE (excludes accrued yield).
    uint256 public usdtPrincipal;

    struct Position {
        uint256 tokenId;
        uint256 stake;       // original AUDM deposit; drives coverage formula
        uint256 totalPaid;   // AUDM paid out across claims
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

    event Deposited(
        address indexed member,
        uint256 indexed tokenId,
        uint256 audmIn,
        uint256 usdtSupplied,
        bytes32 vehicleHash
    );
    event Withdrawn(
        address indexed member,
        uint256 indexed tokenId,
        uint256 audmOut,
        uint256 usdtUnwound
    );
    event ClaimSubmitted(
        uint256 indexed claimId,
        uint256 indexed tokenId,
        address indexed claimant,
        uint256 amount,
        bytes32 infringementHash
    );
    event ClaimApproved(uint256 indexed claimId, uint256 amount);
    event ClaimRejected(uint256 indexed claimId);
    event ClaimPaid(uint256 indexed claimId, address indexed payee, uint256 amount, uint256 usdtUnwound);
    event YieldHarvested(address indexed to, uint256 usdtAmount);

    error PositionLocked();
    error NotMember();
    error ClaimNotPending();
    error ClaimNotApproved();
    error ExceedsCoverage();
    error ZeroAddress();
    error ZeroAmount();
    error InsufficientPrincipal();

    constructor(
        IERC20 _audm,
        IERC20 _usdt,
        IERC20 _aUsdt,
        ICoverageNFT _coverageNFT,
        IUniswapV3SwapRouter _swapRouter,
        IAaveV3Pool _aavePool,
        uint24 _swapFeeTier,
        address admin,
        uint64 _waitPeriod,
        uint256 _kWad
    ) {
        if (
            address(_audm) == address(0) ||
            address(_usdt) == address(0) ||
            address(_aUsdt) == address(0) ||
            address(_coverageNFT) == address(0) ||
            address(_swapRouter) == address(0) ||
            address(_aavePool) == address(0) ||
            admin == address(0)
        ) revert ZeroAddress();
        if (_kWad == 0) revert ZeroAmount();

        audm = _audm;
        usdt = _usdt;
        aUsdt = _aUsdt;
        coverageNFT = _coverageNFT;
        swapRouter = _swapRouter;
        aavePool = _aavePool;
        swapFeeTier = _swapFeeTier;
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

    /// @param amount        AUDM to deposit (full position stake)
    /// @param vehicleHash   keccak256 of the vehicle plate, stored on the NFT
    /// @param minUsdtOut    Slippage guard for the AUDM→USDT swap of the 80% leg
    function deposit(uint256 amount, bytes32 vehicleHash, uint256 minUsdtOut)
        external
        nonReentrant
        whenNotPaused
        returns (uint256 tokenId, uint256 usdtSupplied)
    {
        if (amount == 0) revert ZeroAmount();

        audm.safeTransferFrom(msg.sender, address(this), amount);

        uint256 invest = (amount * INVEST_BPS) / BPS;
        if (invest == 0) revert ZeroAmount();

        usdtSupplied = _swapAudmToUsdt(invest, minUsdtOut);
        _supplyUsdt(usdtSupplied);

        tokenId = coverageNFT.mint(msg.sender, vehicleHash);
        positionOf[tokenId] = Position({
            tokenId: tokenId,
            stake: amount,
            totalPaid: 0,
            depositedAt: uint64(block.timestamp)
        });

        emit Deposited(msg.sender, tokenId, amount, usdtSupplied, vehicleHash);
    }

    /// @param tokenId      Position to close
    /// @param maxUsdtIn    Max USDT to spend swapping back to AUDM if the
    ///                     buffer is short. Pass 0 if you expect no swap.
    function withdraw(uint256 tokenId, uint256 maxUsdtIn) external nonReentrant {
        if (coverageNFT.ownerOf(tokenId) != msg.sender) revert NotMember();
        Position memory pos = positionOf[tokenId];
        if (pos.stake == 0) revert NotMember();
        if (block.timestamp < uint256(pos.depositedAt) + WAIT_PERIOD) revert PositionLocked();

        delete positionOf[tokenId];
        coverageNFT.burn(tokenId);

        uint256 unwound = _ensureAudm(pos.stake, maxUsdtIn);
        audm.safeTransfer(msg.sender, pos.stake);

        emit Withdrawn(msg.sender, tokenId, pos.stake, unwound);
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

    /// @param claimId      Approved claim to settle
    /// @param payee        AUDM recipient (typically the claimant or council)
    /// @param maxUsdtIn    Max USDT to spend on USDT→AUDM swap if buffer is short
    function payClaim(uint256 claimId, address payee, uint256 maxUsdtIn)
        external
        onlyRole(TREASURY_ROLE)
        nonReentrant
    {
        if (payee == address(0)) revert ZeroAddress();
        Claim storage c = claims[claimId];
        if (c.status != ClaimStatus.Approved) revert ClaimNotApproved();

        Position storage pos = positionOf[c.tokenId];
        uint256 cap = (pos.stake * _multiplierWad(pos.depositedAt)) / WAD;
        if (pos.totalPaid + c.amount > cap) revert ExceedsCoverage();

        pos.totalPaid += c.amount;
        c.status = ClaimStatus.Paid;

        uint256 unwound = _ensureAudm(c.amount, maxUsdtIn);
        audm.safeTransfer(payee, c.amount);

        emit ClaimPaid(claimId, payee, c.amount, unwound);
    }

    // ---------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------

    function claimsLength() external view returns (uint256) {
        return claims.length;
    }

    function coverageMultiplier(uint256 tokenId) external view returns (uint256) {
        Position memory pos = positionOf[tokenId];
        if (pos.stake == 0) return 0;
        return _multiplierWad(pos.depositedAt);
    }

    function lifetimeCap(uint256 tokenId) external view returns (uint256) {
        return _lifetimeCap(positionOf[tokenId]);
    }

    function coverageAvailable(uint256 tokenId) external view returns (uint256) {
        return _availableCoverage(positionOf[tokenId]);
    }

    /// @notice AAVE yield available to harvest (aUSDT balance minus principal).
    function accruedYield() public view returns (uint256) {
        uint256 bal = aUsdt.balanceOf(address(this));
        return bal > usdtPrincipal ? bal - usdtPrincipal : 0;
    }

    // ---------------------------------------------------------------------
    // Treasury: harvest AAVE yield
    // ---------------------------------------------------------------------

    /// @notice Withdraw accrued AAVE yield to `to` as USDT, leaving principal
    ///         intact. Returns the USDT amount transferred (0 if no yield).
    function harvest(address to) external onlyRole(TREASURY_ROLE) nonReentrant returns (uint256 yieldUsdt) {
        if (to == address(0)) revert ZeroAddress();
        yieldUsdt = accruedYield();
        if (yieldUsdt == 0) return 0;
        aavePool.withdraw(address(usdt), yieldUsdt, to);
        emit YieldHarvested(to, yieldUsdt);
    }

    // ---------------------------------------------------------------------
    // Internals
    // ---------------------------------------------------------------------

    function _swapAudmToUsdt(uint256 audmIn, uint256 minUsdtOut) internal returns (uint256 usdtOut) {
        audm.forceApprove(address(swapRouter), audmIn);
        usdtOut = swapRouter.exactInputSingle(
            IUniswapV3SwapRouter.ExactInputSingleParams({
                tokenIn: address(audm),
                tokenOut: address(usdt),
                fee: swapFeeTier,
                recipient: address(this),
                deadline: block.timestamp,
                amountIn: audmIn,
                amountOutMinimum: minUsdtOut,
                sqrtPriceLimitX96: 0
            })
        );
    }

    function _supplyUsdt(uint256 amount) internal {
        usdt.forceApprove(address(aavePool), amount);
        aavePool.supply(address(usdt), amount, address(this), 0);
        usdtPrincipal += amount;
    }

    /// @dev Ensure the pool holds at least `audmNeeded` AUDM, unwinding AAVE
    ///      and swapping USDT→AUDM via exactOutputSingle to cover any shortfall.
    ///      Returns the USDT actually spent (0 if the buffer was sufficient).
    function _ensureAudm(uint256 audmNeeded, uint256 maxUsdtIn) internal returns (uint256 usdtSpent) {
        uint256 onHand = audm.balanceOf(address(this));
        if (onHand >= audmNeeded) return 0;

        uint256 shortfall = audmNeeded - onHand;
        if (usdtPrincipal == 0) revert InsufficientPrincipal();

        // Pull at most all of our principal back from AAVE; exactOutputSingle
        // below only spends what's needed for `shortfall` and we re-supply the rest.
        uint256 toPull = maxUsdtIn > usdtPrincipal ? usdtPrincipal : maxUsdtIn;
        aavePool.withdraw(address(usdt), toPull, address(this));
        usdtPrincipal -= toPull;

        usdt.forceApprove(address(swapRouter), toPull);
        usdtSpent = swapRouter.exactOutputSingle(
            IUniswapV3SwapRouter.ExactOutputSingleParams({
                tokenIn: address(usdt),
                tokenOut: address(audm),
                fee: swapFeeTier,
                recipient: address(this),
                deadline: block.timestamp,
                amountOut: shortfall,
                amountInMaximum: toPull,
                sqrtPriceLimitX96: 0
            })
        );

        // Reset approval, re-supply any USDT we pulled but didn't spend.
        usdt.forceApprove(address(swapRouter), 0);
        uint256 leftoverUsdt = toPull - usdtSpent;
        if (leftoverUsdt > 0) {
            _supplyUsdt(leftoverUsdt);
        }
    }

    function _multiplierWad(uint64 depositedAt) internal view returns (uint256) {
        uint256 elapsed = block.timestamp - uint256(depositedAt);
        if (elapsed <= WAIT_PERIOD) return 0;
        uint256 monthsPastWaitWad = ((elapsed - WAIT_PERIOD) * WAD) / MONTH;
        int256 lnVal = FixedPointMathLib.lnWad(int256(WAD + monthsPastWaitWad));
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
