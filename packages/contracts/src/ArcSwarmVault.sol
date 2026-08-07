// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IAgentBudgetManager {
    function allocate(address agent, uint256 amount) external;
    function spend(address agent, uint256 amount) external returns (bool);
    function getBudget(address agent) external view returns (uint256);
    function getSpent(address agent) external view returns (uint256);
    function getRemaining(address agent) external view returns (uint256);
}

interface IRiskOracle {
    function checkHealth() external view returns (bool healthy, uint256 riskScore);
    function isPaused() external view returns (bool);
}

contract ArcSwarmVault is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant COORDINATOR_ROLE = keccak256("COORDINATOR_ROLE");
    bytes32 public constant AGENT_ROLE = keccak256("AGENT_ROLE");

    IERC20 public immutable usdc;
    IAgentBudgetManager public budgetManager;
    IRiskOracle public riskOracle;

    uint256 public totalDeposits;
    uint256 public totalYield;
    uint256 public lastRebalanceTime;

    uint256 public constant MIN_DEPOSIT = 1e6; // 1 USDC
    uint256 public constant REBALANCE_COOLDOWN = 300; // 5 minutes

    mapping(address => uint256) public userDeposits;
    address[] public depositors;

    event Deposited(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event YieldHarvested(uint256 amount, uint256 totalYield);
    event EmergencyWithdraw(address indexed agent, uint256 amount);
    event Rebalanced(uint256 yieldAmount, uint256 liquidityAmount);

    modifier onlyCoordinator() {
        require(hasRole(COORDINATOR_ROLE, msg.sender), "Not coordinator");
        _;
    }

    modifier onlyAgent() {
        require(hasRole(AGENT_ROLE, msg.sender) || hasRole(COORDINATOR_ROLE, msg.sender), "Not agent");
        _;
    }

    constructor(
        address _usdc,
        address _budgetManager,
        address _riskOracle
    ) {
        usdc = IERC20(_usdc);
        budgetManager = IAgentBudgetManager(_budgetManager);
        riskOracle = IRiskOracle(_riskOracle);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(COORDINATOR_ROLE, msg.sender);
    }

    function deposit(uint256 amount) external nonReentrant {
        require(amount >= MIN_DEPOSIT, "Below minimum deposit");
        require(!riskOracle.isPaused(), "System paused");

        usdc.safeTransferFrom(msg.sender, address(this), amount);
        userDeposits[msg.sender] += amount;
        totalDeposits += amount;

        if (userDeposits[msg.sender] == amount) {
            depositors.push(msg.sender);
        }

        emit Deposited(msg.sender, amount);
    }

    function withdraw(uint256 amount) external nonReentrant {
        require(amount > 0, "Zero amount");
        require(userDeposits[msg.sender] >= amount, "Insufficient deposit");

        userDeposits[msg.sender] -= amount;
        totalDeposits -= amount;

        usdc.safeTransfer(msg.sender, amount);
        emit Withdrawn(msg.sender, amount);
    }

    function allocateToAgent(address agent, uint256 amount) external onlyCoordinator {
        require(hasRole(AGENT_ROLE, agent), "Agent not registered");
        require(usdc.balanceOf(address(this)) >= amount, "Insufficient vault balance");
        require(!riskOracle.isPaused(), "System paused");

        budgetManager.allocate(agent, amount);
        usdc.safeTransfer(agent, amount);

        emit Rebalanced(amount, 0);
    }

    function emergencyWithdraw(uint256 amount) external onlyCoordinator {
        require(riskOracle.isPaused(), "System not paused");
        require(usdc.balanceOf(address(this)) >= amount, "Insufficient balance");

        usdc.safeTransfer(msg.sender, amount);
        emit EmergencyWithdraw(msg.sender, amount);
    }

    function harvestYield(uint256 amount) external onlyCoordinator {
        totalYield += amount;
        emit YieldHarvested(amount, totalYield);
    }

    function getVaultBalance() external view returns (uint256) {
        return usdc.balanceOf(address(this));
    }

    function getDepositorCount() external view returns (uint256) {
        return depositors.length;
    }

    function getAllDepositors() external view returns (address[] memory) {
        return depositors;
    }

    receive() external payable {}
}
