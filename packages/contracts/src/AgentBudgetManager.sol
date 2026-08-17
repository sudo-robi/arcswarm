// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title AgentBudgetManager
/// @notice Manages per-agent USDC budget allocations, spending, and cooldowns.
/// @dev Only the COORDINATOR_ROLE may allocate or deactivate agents.
///      Agents themselves call `spend` to record budget consumption.
contract AgentBudgetManager is AccessControl, ReentrancyGuard {
    bytes32 public constant COORDINATOR_ROLE = keccak256("COORDINATOR_ROLE");

    // ── Errors ───────────────────────────────────────────────────────────
    error NotCoordinator();
    error ZeroAllocation();
    error AgentInactive();
    error AllocationCooldown();
    error AgentNotActive();
    error InsufficientBudget();

    // ── Types ────────────────────────────────────────────────────────────
    struct AgentBudget {
        uint256 allocated;
        uint256 spent;
        uint256 lastAllocationTime;
        bool active;
    }

    // ── Storage ──────────────────────────────────────────────────────────
    mapping(address => AgentBudget) public budgets;
    address[] public activeAgents;

    uint256 public totalAllocated;
    uint256 public totalSpent;
    uint256 public allocationCooldown = 60; // 1 minute

    // ── Events ───────────────────────────────────────────────────────────
    event AgentBudgetCreated(address indexed agent, uint256 amount);
    event BudgetAllocated(address indexed agent, uint256 amount, uint256 total);
    event BudgetSpent(address indexed agent, uint256 amount, uint256 remaining);
    event AgentDeactivated(address indexed agent);
    event CooldownUpdated(uint256 newCooldown);

    // ── Modifiers ────────────────────────────────────────────────────────
    modifier onlyCoordinator() {
        if (!hasRole(COORDINATOR_ROLE, msg.sender)) revert NotCoordinator();
        _;
    }

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(COORDINATOR_ROLE, msg.sender);
    }

    /// @notice Allocate budget to an agent. Creates the budget entry on first
    ///         call and enforces the allocation cooldown on subsequent calls.
    /// @param agent  Address of the agent.
    /// @param amount Amount of USDC to allocate (6-decimal, must be > 0).
    function allocate(address agent, uint256 amount) external onlyCoordinator nonReentrant {
        if (amount == 0) revert ZeroAllocation();
        if (budgets[agent].allocated != 0 && !budgets[agent].active) revert AgentInactive();

        if (budgets[agent].allocated == 0) {
            activeAgents.push(agent);
            budgets[agent].active = true;
            emit AgentBudgetCreated(agent, amount);
        }

        if (block.timestamp < budgets[agent].lastAllocationTime + allocationCooldown)
            revert AllocationCooldown();

        budgets[agent].allocated += amount;
        budgets[agent].lastAllocationTime = block.timestamp;
        totalAllocated += amount;

        emit BudgetAllocated(agent, amount, budgets[agent].allocated);
    }

    /// @notice Record budget spend for an agent. Can be called by anyone
    ///         (gas-efficient for off-chain relayers) but the agent must be active
    ///         and have sufficient remaining budget.
    /// @param agent  Address of the agent.
    /// @param amount Amount of USDC spent (6-decimal, must be > 0).
    function spend(address agent, uint256 amount) external returns (bool) {
        if (!budgets[agent].active) revert AgentNotActive();
        if (getRemaining(agent) < amount) revert InsufficientBudget();

        budgets[agent].spent += amount;
        totalSpent += amount;

        emit BudgetSpent(agent, amount, getRemaining(agent));
        return true;
    }

    // ── View functions ───────────────────────────────────────────────────

    /// @notice Total allocated budget for an agent.
    function getBudget(address agent) external view returns (uint256) {
        return budgets[agent].allocated;
    }

    /// @notice Total spent by an agent.
    function getSpent(address agent) external view returns (uint256) {
        return budgets[agent].spent;
    }

    /// @notice Remaining budget for an agent.
    function getRemaining(address agent) public view returns (uint256) {
        AgentBudget memory b = budgets[agent];
        if (b.allocated <= b.spent) return 0;
        return b.allocated - b.spent;
    }

    /// @notice Deactivate an agent, preventing further allocations and spends.
    function deactivateAgent(address agent) external onlyCoordinator {
        budgets[agent].active = false;
        emit AgentDeactivated(agent);
    }

    /// @notice Update the allocation cooldown period.
    /// @param _cooldown New cooldown in seconds.
    function setAllocationCooldown(uint256 _cooldown) external onlyCoordinator {
        allocationCooldown = _cooldown;
        emit CooldownUpdated(_cooldown);
    }

    /// @notice List all agents that have ever been allocated budget.
    function getActiveAgents() external view returns (address[] memory) {
        return activeAgents;
    }

    /// @notice Number of agents that have ever been allocated budget.
    function getAgentCount() external view returns (uint256) {
        return activeAgents.length;
    }
}
