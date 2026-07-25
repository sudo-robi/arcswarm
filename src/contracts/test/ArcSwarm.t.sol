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

    mapping(address => uint256) public override balanceOf;
    mapping(address => mapping(address => uint256)) public override allowance;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
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

        // Setup roles
        bytes32 coordinatorRole = keccak256("COORDINATOR_ROLE");
        bytes32 agentRole = keccak256("AGENT_ROLE");

        vault.grantRole(coordinatorRole, admin);
        budgetManager.grantRole(coordinatorRole, address(vault));

        // Register agents
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

        // Mint USDC for testing
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
        // Deposit to vault
        vm.startPrank(alice);
        usdc.approve(address(vault), 50_000e6);
        vault.deposit(50_000e6);
        vm.stopPrank();

        // Allocate to yield agent
        vault.allocateToAgent(yieldAgent, 15_000e6);

        assertEq(usdc.balanceOf(yieldAgent), 15_000e6);
    }

    function testNanopayment() public {
        // Fund yield agent
        usdc.mint(yieldAgent, 10_000e6);

        vm.startPrank(yieldAgent);
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

        vault.executeBatchPayments(recipients, amounts, memos);

        assertEq(paymentRouter.getPaymentCount(), 3);
    }

    function testCircuitBreaker() public {
        riskOracle.updateMetrics(150_000e6, 600); // 6% drawdown > 5% threshold
        assertTrue(riskOracle.isPaused());
    }

    function testRiskScore() public {
        riskOracle.updateMetrics(50_000e6, 200); // 2% drawdown
        (, uint256 score) = riskOracle.checkHealth();
        assertTrue(score > 0);
        assertTrue(score < 100);
    }

    function testAgentRegistry() public {
        assertTrue(agentRegistry.isAgent(yieldAgent));
        assertEq(agentRegistry.getAgentCount(), 2);
    }

    function testReputationUpdate() public {
        agentRegistry.updateReputation(yieldAgent, 10, "Good yield performance");
        (, , , , uint256 score, , ) = agentRegistry.getAgentInfo(yieldAgent);
        assertEq(score, 60); // 50 + 10
    }
}
