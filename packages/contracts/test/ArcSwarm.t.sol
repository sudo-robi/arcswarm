// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Test.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../src/ArcSwarmVault.sol";
import "../src/AgentBudgetManager.sol";
import "../src/AgentRegistry.sol";
import "../src/RiskOracle.sol";
import "../src/PaymentRouter.sol";

contract MockUSDC is IERC20 {
    string public name = "USD Coin";
    string public symbol = "USDC";
    uint8 public decimals = 6;
    uint256 public totalSupply;

    mapping(address => uint256) public override balanceOf;
    mapping(address => mapping(address => uint256)) public override allowance;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
        totalSupply += amount;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

contract ArcSwarmTest is Test {
    MockUSDC usdc;
    ArcSwarmVault vault;
    AgentBudgetManager budgetManager;
    AgentRegistry agentRegistry;
    RiskOracle riskOracle;
    PaymentRouter paymentRouter;

    address admin = address(this);
    address alice = makeAddr("alice");
    address yieldAgent = makeAddr("yieldAgent");
    address riskAgent = makeAddr("riskAgent");

    function setUp() public {
        usdc = new MockUSDC();
        budgetManager = new AgentBudgetManager();
        agentRegistry = new AgentRegistry();
        riskOracle = new RiskOracle();
        paymentRouter = new PaymentRouter(address(usdc));

        vault = new ArcSwarmVault(
            address(usdc),
            address(budgetManager),
            address(riskOracle)
        );

        bytes32 coordinatorRole = keccak256("COORDINATOR_ROLE");
        bytes32 agentRole = keccak256("AGENT_ROLE");
        bytes32 riskAgentRole = keccak256("RISK_AGENT_ROLE");

        vault.grantRole(coordinatorRole, admin);
        budgetManager.grantRole(coordinatorRole, address(vault));
        paymentRouter.grantRole(coordinatorRole, admin);
        paymentRouter.grantRole(agentRole, yieldAgent);
        paymentRouter.grantRole(agentRole, riskAgent);

        // Grant RISK_AGENT_ROLE to admin so tests can call updateMetrics
        riskOracle.grantRole(riskAgentRole, admin);

        agentRegistry.registerAgent(
            yieldAgent,
            keccak256("YIELD-001"),
            AgentRegistry.AgentType.YIELD,
            "Yield Agent"
        );
        agentRegistry.registerAgent(
            riskAgent,
            keccak256("RISK-001"),
            AgentRegistry.AgentType.RISK,
            "Risk Agent"
        );

        vault.grantRole(agentRole, yieldAgent);
        vault.grantRole(agentRole, riskAgent);

        usdc.mint(alice, 100_000e6);
        usdc.mint(admin, 1_000_000e6);
    }

    function testDeposit() public {
        vm.startPrank(alice);
        usdc.approve(address(vault), 10_000e6);
        vault.deposit(10_000e6);

        assertEq(vault.userDeposits(alice), 10_000e6);
        assertEq(vault.totalDeposits(), 10_000e6);
        assertEq(vault.getVaultBalance(), 10_000e6);
        vm.stopPrank();
    }

    function testWithdraw() public {
        vm.startPrank(alice);
        usdc.approve(address(vault), 10_000e6);
        vault.deposit(10_000e6);
        vault.withdraw(5_000e6);

        assertEq(vault.userDeposits(alice), 5_000e6);
        assertEq(usdc.balanceOf(alice), 95_000e6);
        vm.stopPrank();
    }

    function testAgentAllocation() public {
        vm.startPrank(alice);
        usdc.approve(address(vault), 50_000e6);
        vault.deposit(50_000e6);
        vm.stopPrank();

        // Warp past the allocation cooldown (60s default)
        vm.warp(block.timestamp + 61);

        vault.allocateToAgent(yieldAgent, 15_000e6);

        assertEq(usdc.balanceOf(yieldAgent), 15_000e6);
    }

    function testNanopayment() public {
        usdc.mint(yieldAgent, 10_000e6);

        vm.startPrank(yieldAgent);
        usdc.approve(address(paymentRouter), 10_000e6);
        paymentRouter.executeNanopayment(riskAgent, 1000, "risk-check");
        vm.stopPrank();

        assertEq(paymentRouter.getNanopaymentCount(), 1);
        assertEq(usdc.balanceOf(riskAgent), 1000);
    }

    function testBatchPayments() public {
        address[] memory recipients = new address[](3);
        uint256[] memory amounts = new uint256[](3);
        string[] memory memos = new string[](3);

        recipients[0] = yieldAgent;
        recipients[1] = riskAgent;
        recipients[2] = alice;
        amounts[0] = 5_000e6;
        amounts[1] = 3_000e6;
        amounts[2] = 2_000e6;
        memos[0] = "yield allocation";
        memos[1] = "risk allocation";
        memos[2] = "user refund";

        usdc.approve(address(paymentRouter), 10_000e6);
        paymentRouter.executeBatchPayments(recipients, amounts, memos);

        assertEq(paymentRouter.getPaymentCount(), 3);
    }

    function testCircuitBreaker() public {
        riskOracle.updateMetrics(150_000e6, 600);
        assertTrue(riskOracle.isPaused());
    }

    function testRiskScore() public {
        riskOracle.updateMetrics(50_000e6, 200);
        (, uint256 score) = riskOracle.checkHealth();
        assertTrue(score > 0);
        assertTrue(score < 100);
    }

    function testAgentRegistry() public view {
        assertTrue(agentRegistry.isAgent(yieldAgent));
        assertEq(agentRegistry.getAgentCount(), 2);
    }

    function testReputationUpdate() public {
        agentRegistry.updateReputation(yieldAgent, 10, "Good yield performance");
        AgentRegistry.AgentInfo memory info = agentRegistry.getAgentInfo(yieldAgent);
        assertEq(info.reputationScore, 60);
    }
}
