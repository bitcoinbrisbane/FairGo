// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {IAaveV3Pool} from "../interfaces/IAaveV3Pool.sol";

/// @notice Test stand-in for AAVE V3 Pool — single-asset, and also acts as its
///         own "aToken" by exposing `balanceOf(supplier)` (returns principal +
///         any yield credited via `accrueYield`). Pass this contract's address
///         as both the pool and the aToken when wiring FairGoPool in tests.
contract MockAavePool is IAaveV3Pool {
    using SafeERC20 for IERC20;

    IERC20 public immutable asset;
    mapping(address => uint256) public principalOf;

    error WrongAsset();
    error InsufficientPrincipal();

    constructor(IERC20 _asset) {
        asset = _asset;
    }

    function supply(address _asset, uint256 amount, address onBehalfOf, uint16) external override {
        if (_asset != address(asset)) revert WrongAsset();
        IERC20(_asset).safeTransferFrom(msg.sender, address(this), amount);
        principalOf[onBehalfOf] += amount;
    }

    function withdraw(address _asset, uint256 amount, address to) external override returns (uint256) {
        if (_asset != address(asset)) revert WrongAsset();
        uint256 p = principalOf[msg.sender];
        if (p < amount) revert InsufficientPrincipal();
        principalOf[msg.sender] = p - amount;
        IERC20(_asset).safeTransfer(to, amount);
        return amount;
    }

    /// @notice aToken-style view used by FairGoPool to detect accrued yield.
    function balanceOf(address user) external view returns (uint256) {
        return principalOf[user];
    }

    /// @notice Test helper. Inflates the supplier's effective balance as if
    ///         yield had accrued. Caller must also fund this contract with the
    ///         underlying asset so withdrawals succeed.
    function accrueYield(address supplier, uint256 amount) external {
        principalOf[supplier] += amount;
    }
}
