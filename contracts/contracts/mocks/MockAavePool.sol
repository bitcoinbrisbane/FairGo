// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {IAaveV3Pool} from "../interfaces/IAaveV3Pool.sol";

/// @notice Test stand-in for AAVE V3 Pool. Tracks principal per (asset, supplier)
///         and lets a test mint phantom yield via `accrueYield` (which boosts the
///         supplier's principal; the test must also fund the pool with that asset).
contract MockAavePool is IAaveV3Pool {
    using SafeERC20 for IERC20;

    mapping(address => mapping(address => uint256)) public principalOf;

    error InsufficientPrincipal();

    function supply(address asset, uint256 amount, address onBehalfOf, uint16) external override {
        IERC20(asset).safeTransferFrom(msg.sender, address(this), amount);
        principalOf[asset][onBehalfOf] += amount;
    }

    function withdraw(address asset, uint256 amount, address to) external override returns (uint256) {
        uint256 p = principalOf[asset][msg.sender];
        if (p < amount) revert InsufficientPrincipal();
        principalOf[asset][msg.sender] = p - amount;
        IERC20(asset).safeTransfer(to, amount);
        return amount;
    }

    /// @notice Test helper. Inflates the supplier's principal as if yield accrued.
    ///         Caller is responsible for funding the pool with the matching asset.
    function accrueYield(address asset, address supplier, uint256 amount) external {
        principalOf[asset][supplier] += amount;
    }
}
