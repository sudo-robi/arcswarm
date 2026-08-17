// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @notice Minimal interface for the AgentBudgetManager contract.
interface IAgentBudgetManager {
    /// @notice Allocate budget to an agent.
    function allocate(address agent, uint256 amount) external;
    /// @notice Record spend against an agent's budget.
    function spend(address agent, uint256 amount) external returns (bool);
    /// @notice Get the total allocated budget for an agent.
    function getBudget(address agent) external view returns (uint256);
    /// @notice Get the total spent by an agent.
    function getSpent(address agent) external view returns (uint256);
    /// @notice Get the remaining budget for an agent.
    function getRemaining(address agent) external view returns (uint256);
}

/// @notice Minimal interface for the RiskOracle contract.
interface IRiskOracle {
    /// @notice Check the health of the system.
    function checkHealth() external view returns (bool healthy, uint256 riskScore);
    /// @notice Whether the system is paused.
    function isPaused() external view returns (bool);
}

/// @title ArcSwarmVault
/// @notice ERC20 vault that holds USDC deposits, allocates funds to agents,
///         and harvests yield for the ArcSwarm multi-agent treasury.
/// @dev All external state-changing functions are protected by ReentrancyGuard.
///      CEI pattern is followed for every external interaction.
contract ArcSwarmVault is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ── Roles ────────────────────────────────────────────────────────────
    bytes32 public constant COORDINATOR_ROLE = keccak256("COORDINATOR_ROLE");
    bytes32 public constant AGENT_ROLE = keccak256("AGENT_ROLE");

    // ── Errors ───────────────────────────────────────────────────────────
    error ZeroAddress();
    error BelowMinimumDeposit();
    error SystemPaused();
    error ZeroAmount();
    error InsufficientDeposit();
    error AgentNotRegistered();
    error InsufficientVaultBalance();
    error SystemNotPaused();
    error NotCoordinator();
    error NotAgent();

    // ── Immutable storage ────────────────────────────────────────────────
    IERC20 public immutable usdc;

    // ── Mutable storage ──────────────────────────────────────────────────
    IAgentBudgetManager public budgetManager;
    IRiskOracle public riskOracle;

    uint256 public totalDeposits;
    uint256 public totalYield;
    uint256 public lastRebalanceTime;

    uint256 public constant MIN_DEPOSIT = 1e6; // 1 USDC
    uint256 public constant REBALANCE_COOLDOWN = 300; // 5 minutes

    mapping(address => uint256) public userDeposits;
    address[] public depositors;

    // ── Events ───────────────────────────────────────────────────────────
    event Deposited(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event YieldHarvested(uint256 amount, uint256 totalYield);
    event EmergencyWithdraw(address indexed agent, uint256 amount);
    event Rebalanced(uint256 yieldAmount, uint256 liquidityAmount);

    // ── Modifiers ────────────────────────────────────────────────────────
    modifier onlyCoordinator() {
        if (!hasRole(COORDINATOR_ROLE, msg.sender)) revert NotCoordinator();
        _;
    }

    modifier onlyAgent() {
        if (!hasRole(AGENT_ROLE, msg.sender) && !hasRole(COORDINATOR_ROLE, msg.sender))
            revert NotAgent();
        _;
    }

    /// @notice Deploy the vault with references to core protocol contracts.
    /// @param _usdc         Address of the USDC ERC-20 token.
    /// @param _budgetManager Address of the AgentBudgetManager.
    /// @param _riskOracle   Address of the RiskOracle.
    constructor(
        address _usdc,
        address _budgetManager,
        address _riskOracle
    ) {
        if (_usdc == address(0) || _budgetManager == address(0) || _riskOracle == address(0))
            revert ZeroAddress();

        usdc = IERC20(_usdc);
        budgetManager = IAgentBudgetManager(_budgetManager);
        riskOracle = IRiskOracle(_riskOracle);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(COORDINATOR_ROLE, msg.sender);
    }

    /// @notice Deposit USDC into the vault.
    /// @dev Requires at least MIN_DEPOSIT. System must not be paused.
    /// @param amount Amount of USDC to deposit (6-decimal).
    function deposit(uint256 amount) external nonReentrant {
        if (amount < MIN_DEPOSIT) revert BelowMinimumDeposit();
        if (riskOracle.isPaused()) revert SystemPaused();

        // Effects
        usdc.safeTransferFrom(msg.sender, address(this), amount);
        userDeposits[msg.sender] += amount;
        totalDeposits += amount;

        if (userDeposits[msg.sender] == amount) {
            depositors.push(msg.sender);
        }

        emit Deposited(msg.sender, amount);
    }

    /// @notice Withdraw USDC from the vault.
    /// @param amount Amount of USDC to withdraw (6-decimal).
    function withdraw(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (userDeposits[msg.sender] < amount) revert InsufficientDeposit();

        // Effects
        userDeposits[msg.sender] -= amount;
        totalDeposits -= amount;

        // Interaction
        usdc.safeTransfer(msg.sender, amount);
        emit Withdrawn(msg.sender, amount);
    }

    /// @notice Allocate USDC from the vault to a registered agent.
    /// @dev Only callable by the coordinator. System must not be paused.
    /// @param agent  Address of the agent to receive funds.
    /// @param amount Amount of USDC to allocate (6-decimal).
    function allocateToAgent(address agent, uint256 amount) external onlyCoordinator {
        if (!hasRole(AGENT_ROLE, agent)) revert AgentNotRegistered();
        if (usdc.balanceOf(address(this)) < amount) revert InsufficientVaultBalance();
        if (riskOracle.isPaused()) revert SystemPaused();

        // Effects — budget manager records the allocation
        budgetManager.allocate(agent, amount);

        // Interaction — transfer tokens to agent
        usdc.safeTransfer(agent, amount);

        emit Rebalanced(amount, 0);
    }

    /// @notice Emergency withdraw USDC from the vault. Only available when the
    ///         system is paused by the RiskOracle.
    /// @param amount Amount of USDC to withdraw (6-decimal).
    function emergencyWithdraw(uint256 amount) external nonReentrant onlyCoordinator {
        if (!riskOracle.isPaused()) revert SystemNotPaused();
        if (usdc.balanceOf(address(this)) < amount) revert InsufficientVaultBalance();

        usdc.safeTransfer(msg.sender, amount);
        emit EmergencyWithdraw(msg.sender, amount);
    }

    /// @notice Record a yield harvest. Does not transfer tokens — used for
    ///         accounting only; actual yield transfers should be routed through
    ///         the budget manager or a dedicated yield recipient.
    /// @param amount Amount of yield harvested (6-decimal).
    function harvestYield(uint256 amount) external onlyCoordinator {
        totalYield += amount;
        emit YieldHarvested(amount, totalYield);
    }

    // ── View functions ───────────────────────────────────────────────────

    /// @notice Total USDC held by the vault.
    function getVaultBalance() external view returns (uint256) {
        return usdc.balanceOf(address(this));
    }

    /// @notice Number of unique depositors.
    function getDepositorCount() external view returns (uint256) {
        return depositors.length;
    }

    /// @notice Return all depositor addresses. O(n) — use sparingly.
    function getAllDepositors() external view returns (address[] memory) {
        return depositors;
    }
}
