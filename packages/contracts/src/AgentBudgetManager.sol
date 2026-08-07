// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract AgentBudgetManager is AccessControl, ReentrancyGuard {
    bytes32 public constant COORDINATOR_ROLE = keccak256("COORDINATOR_ROLE");

    struct AgentBudget {
        uint256 allocated;
        uint256 spent;
        uint256 lastAllocationTime;
        bool active;
    }

    mapping(address => AgentBudget) public budgets;
    address[] public activeAgents;

    uint256 public totalAllocated;
    uint256 public totalSpent;
    uint256 public allocationCooldown = 60; // 1 minute

    event AgentBudgetCreated(address indexed agent, uint256 amount);
    event BudgetAllocated(address indexed agent, uint256 amount, uint256 total);
    event BudgetSpent(address indexed agent, uint256 amount, uint256 remaining);
    event AgentDeactivated(address indexed agent);
    event CooldownUpdated(uint256 newCooldown);

    modifier onlyCoordinator() {
        require(hasRole(COORDINATOR_ROLE, msg.sender), "Not coordinator");
        _;
    }

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(COORDINATOR_ROLE, msg.sender);
    }

    function allocate(address agent, uint256 amount) external onlyCoordinator nonReentrant {
        require(amount > 0, "Zero allocation");
        require(budgets[agent].active || budgets[agent].allocated == 0, "Agent inactive");

        if (budgets[agent].allocated == 0) {
            activeAgents.push(agent);
            budgets[agent].active = true;
            emit AgentBudgetCreated(agent, amount);
        }

        require(
            block.timestamp >= budgets[agent].lastAllocationTime + allocationCooldown,
            "Allocation cooldown"
        );

        budgets[agent].allocated += amount;
        budgets[agent].lastAllocationTime = block.timestamp;
        totalAllocated += amount;

        emit BudgetAllocated(agent, amount, budgets[agent].allocated);
    }

    function spend(address agent, uint256 amount) external returns (bool) {
        require(budgets[agent].active, "Agent not active");
        require(getRemaining(agent) >= amount, "Insufficient budget");

        budgets[agent].spent += amount;
        totalSpent += amount;

        emit BudgetSpent(agent, amount, getRemaining(agent));
        return true;
    }

    function getBudget(address agent) external view returns (uint256) {
        return budgets[agent].allocated;
    }

    function getSpent(address agent) external view returns (uint256) {
        return budgets[agent].spent;
    }

    function getRemaining(address agent) public view returns (uint256) {
        AgentBudget memory b = budgets[agent];
        if (b.allocated <= b.spent) return 0;
        return b.allocated - b.spent;
    }

    function deactivateAgent(address agent) external onlyCoordinator {
        budgets[agent].active = false;
        emit AgentDeactivated(agent);
    }

    function setAllocationCooldown(uint256 _cooldown) external onlyCoordinator {
        allocationCooldown = _cooldown;
        emit CooldownUpdated(_cooldown);
    }

    function getActiveAgents() external view returns (address[] memory) {
        return activeAgents;
    }

    function getAgentCount() external view returns (uint256) {
        return activeAgents.length;
    }
}
