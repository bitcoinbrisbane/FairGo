// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {IUniswapV3SwapRouter} from "../interfaces/IUniswapV3SwapRouter.sol";

/// @notice Deterministic Uniswap V3 SwapRouter substitute for tests.
///         Per-pair rate is set by the test as `rateWad[in][out]` — meaning
///         "1e18 of `in` yields `rateWad` of `out`". The router must be
///         pre-funded with the output token to fulfill swaps.
contract MockSwapRouter is IUniswapV3SwapRouter {
    using SafeERC20 for IERC20;

    uint256 private constant WAD = 1e18;

    mapping(address => mapping(address => uint256)) public rateWad;

    error UnsetRate();
    error Slippage();

    function setRate(address tokenIn, address tokenOut, uint256 rate) external {
        rateWad[tokenIn][tokenOut] = rate;
    }

    function exactInputSingle(ExactInputSingleParams calldata p)
        external
        payable
        override
        returns (uint256 amountOut)
    {
        uint256 r = rateWad[p.tokenIn][p.tokenOut];
        if (r == 0) revert UnsetRate();
        amountOut = (p.amountIn * r) / WAD;
        if (amountOut < p.amountOutMinimum) revert Slippage();

        IERC20(p.tokenIn).safeTransferFrom(msg.sender, address(this), p.amountIn);
        IERC20(p.tokenOut).safeTransfer(p.recipient, amountOut);
    }

    function exactOutputSingle(ExactOutputSingleParams calldata p)
        external
        payable
        override
        returns (uint256 amountIn)
    {
        uint256 r = rateWad[p.tokenIn][p.tokenOut];
        if (r == 0) revert UnsetRate();
        // Round up so the router always has enough output to deliver.
        amountIn = (p.amountOut * WAD + r - 1) / r;
        if (amountIn > p.amountInMaximum) revert Slippage();

        IERC20(p.tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        IERC20(p.tokenOut).safeTransfer(p.recipient, p.amountOut);
    }
}
