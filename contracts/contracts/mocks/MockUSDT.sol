// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice Test stand-in for USDT. Real USDT is 6 decimals, but this mock uses
///         the ERC20 default (18) so the test fixture can avoid cross-decimal
///         arithmetic. Decimal correctness is the integrator's problem.
contract MockUSDT is ERC20 {
    constructor() ERC20("Mock USDT", "USDT") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
