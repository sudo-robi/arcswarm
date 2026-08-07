---
name: solidity-testing
description: Write extensive Foundry tests for the ArcSwarm Solidity contracts. Use when writing, extending, or reviewing forge test suites in packages/contracts. Covers deployFixture pattern, vm.prank/vm.expectRevert/vm.warp/vm.assume, fuzzing, and per-function branch coverage for ArcSwarmVault, AgentBudgetManager, AgentRegistry, RiskOracle, PaymentRouter.
---

# ArcSwarm Solidity Testing

The contracts live in `packages/contracts/src/` and are tested with Foundry from `packages/contracts`. Run with `forge test -vvv` (from `packages/contracts`).

## Conventions

- Existing suite: `packages/contracts/test/ArcSwarm.t.sol` (MockUSDC + ArcSwarmTest). Add per-contract test files (e.g. `test/ArcSwarmVault.t.sol`) that inherit the same MockUSDC + setup pattern.
- Deploy via `vm.startPrank(DEPLOYER)`: vault = new ArcSwarmVault(address(usdc), address(budgetManager), address(riskOracle)); paymentRouter = new PaymentRouter(address(usdc)); then `vm.stopPrank()`.
- Use `vm.startPrank(owner)` / `vm.prank` for every role-changing call; `vm.expectRevert(abi.encodeWithSignature("SomeError()"))` or `abi.encodeWithSelector(Contract.someError.selector)` before the reverting call.
- Use `vm.warp(block.timestamp + N)` to cross cooldowns (REBALANCE_COOLDOWN=300, budget cooldown=60, circuit breaker=1h).
- Use `vm.assume()` in fuzz tests to keep inputs in valid ranges (e.g. amounts >= MIN_DEPOSIT=1e6).
- MockUSDC is already defined — `mint(address to, uint256 amount)` and `approve`.

## Coverage checklist (every public/external function)

- **ArcSwarmVault**: deposit (min deposit revert, event, balance), withdraw (insufficient balance revert, event, ownership), allocateToAgent (non-owner revert, non-active agent revert, amount > 0, insufficient contract balance), rebalance (cooldown revert, non-owner revert, allocation call), emergencyWithdraw (non-owner revert, success), getDepositorCount / getDepositor.
- **AgentBudgetManager**: allocate (cooldown revert, non-owner, deactivated agent), spend (non-agent-owner revert, exceeds budget revert, decrements budget), deactivateAgent, isActive.
- **AgentRegistry**: registerAgent (duplicate revert, non-owner, event, agentType), updateReputation (clamped to [0,100], non-owner revert, history length), getAgent / getAgentCount.
- **RiskOracle**: setRiskMetrics (threshold clamp, non-owner revert), pauseSwarm/unpauseSwarm (circuit breaker, 1h cooldown, only coordinator), addRiskAgent, getRiskMetrics.
- **PaymentRouter**: pay (usdc transfer, event, payment recorded), nanopay (limit enforcement > nanopaymentLimit=1e4 revert, event), batchPayments (array lengths, per-recipient amounts, event).

## Reports

Always run `forge test` at the end and report pass/fail count and any contract bugs discovered (with file:line references). Never modify production contracts while testing — if a bug is found, note it in the report.
