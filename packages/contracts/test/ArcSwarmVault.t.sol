// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Test.sol";
import "../src/ArcSwarmVault.sol";
import "../src/AgentBudgetManager.sol";
import "../src/RiskOracle.sol";

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

contract ArcSwarmVaultTest is Test {
    MockUSDC usdc;
    ArcSwarmVault vault;
    AgentBudgetManager budgetManager;
    RiskOracle riskOracle;

    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address yieldAgent = makeAddr("yieldAgent");
    address unregisteredAgent = makeAddr("unregisteredAgent");

    bytes32 constant AGENT_ROLE = keccak256("AGENT_ROLE");

    function setUp() public {
        usdc = new MockUSDC();
        budgetManager = new AgentBudgetManager();
        riskOracle = new RiskOracle();

        vault = new ArcSwarmVault(address(usdc), address(budgetManager), address(riskOracle));

        // Vault (admin = address(this)) calls budgetManager.allocate() internally.
        budgetManager.grantRole(keccak256("COORDINATOR_ROLE"), address(vault));
        // Register yieldAgent on the vault so allocateToAgent can target it.
        vault.grantRole(AGENT_ROLE, yieldAgent);
        // Allow the test (as the risk oracle operator) to pause the system.
        riskOracle.grantRole(keccak256("RISK_AGENT_ROLE"), address(this));

        usdc.mint(alice, 1_000_000e6);
        usdc.mint(bob, 1_000_000e6);

        // Move past the AgentBudgetManager allocation cooldown (default 60s)
        // so the first allocation does not revert.
        vm.warp(100);
    }

    // ---------- deposit ----------

    function testDeposit_Success() public {
        vm.prank(alice);
        usdc.approve(address(vault), 10_000e6);

        vm.prank(alice);
        vault.deposit(10_000e6);

        assertEq(vault.userDeposits(alice), 10_000e6);
        assertEq(vault.totalDeposits(), 10_000e6);
        assertEq(vault.getVaultBalance(), 10_000e6);
        assertEq(usdc.balanceOf(alice), 1_000_000e6 - 10_000e6);
    }

    function testDeposit_EmitsEvent() public {
        vm.startPrank(alice);
        usdc.approve(address(vault), 10_000e6);

        vm.expectEmit(true, true, true, true);
        emit ArcSwarmVault.Deposited(alice, 10_000e6);
        vault.deposit(10_000e6);
        vm.stopPrank();
    }

    function testDeposit_BelowMinimumReverts() public {
        vm.startPrank(alice);
        usdc.approve(address(vault), 1e6);

        vm.expectRevert(abi.encodeWithSelector(ArcSwarmVault.BelowMinimumDeposit.selector));
        vault.deposit(1e6 - 1);
        vm.stopPrank();
    }

    function testDeposit_ExactlyMinimumSucceeds() public {
        vm.startPrank(alice);
        usdc.approve(address(vault), 1e6);
        vault.deposit(1e6);
        vm.stopPrank();

        assertEq(vault.userDeposits(alice), 1e6);
    }

    function testDeposit_SystemPausedReverts() public {
        // Trigger the risk oracle circuit breaker so isPaused() == true.
        riskOracle.updateMetrics(150_000e6, 600);

        vm.startPrank(alice);
        usdc.approve(address(vault), 10_000e6);

        vm.expectRevert(abi.encodeWithSelector(ArcSwarmVault.SystemPaused.selector));
        vault.deposit(10_000e6);
        vm.stopPrank();
    }

    function testFuzz_Deposit(uint256 amount) public {
        vm.assume(amount >= 1e6);
        vm.assume(amount <= 1_000_000e6);

        vm.startPrank(alice);
        usdc.mint(alice, amount);
        usdc.approve(address(vault), amount);
        vault.deposit(amount);
        vm.stopPrank();

        assertEq(vault.userDeposits(alice), amount);
        assertEq(vault.totalDeposits(), amount);
        assertEq(vault.getVaultBalance(), amount);
    }

    // ---------- withdraw ----------

    function testWithdraw_Success() public {
        vm.startPrank(alice);
        usdc.approve(address(vault), 10_000e6);
        vault.deposit(10_000e6);
        vault.withdraw(4_000e6);
        vm.stopPrank();

        assertEq(vault.userDeposits(alice), 6_000e6);
        assertEq(vault.totalDeposits(), 6_000e6);
        assertEq(usdc.balanceOf(alice), 1_000_000e6 - 10_000e6 + 4_000e6);
    }

    function testWithdraw_EmitsEvent() public {
        vm.startPrank(alice);
        usdc.approve(address(vault), 10_000e6);
        vault.deposit(10_000e6);

        vm.expectEmit(true, true, true, true);
        emit ArcSwarmVault.Withdrawn(alice, 3_000e6);
        vault.withdraw(3_000e6);
        vm.stopPrank();
    }

    function testWithdraw_ZeroAmountReverts() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(ArcSwarmVault.ZeroAmount.selector));
        vault.withdraw(0);
    }

    function testWithdraw_InsufficientDepositReverts() public {
        vm.startPrank(alice);
        usdc.approve(address(vault), 5_000e6);
        vault.deposit(5_000e6);

        vm.expectRevert(abi.encodeWithSelector(ArcSwarmVault.InsufficientDeposit.selector));
        vault.withdraw(5_000e6 + 1);
        vm.stopPrank();
    }

    function testWithdraw_WithoutDepositReverts() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(ArcSwarmVault.InsufficientDeposit.selector));
        vault.withdraw(1e6);
    }

    function testFuzz_Withdraw(uint256 amount) public {
        vm.assume(amount > 0);
        vm.assume(amount <= 10_000e6);

        vm.startPrank(alice);
        usdc.approve(address(vault), 10_000e6);
        vault.deposit(10_000e6);
        vault.withdraw(amount);
        vm.stopPrank();

        assertEq(vault.userDeposits(alice), 10_000e6 - amount);
    }

    // ---------- allocateToAgent ----------

    function testAllocateToAgent_OnlyCoordinatorReverts() public {
        vm.startPrank(alice);
        usdc.approve(address(vault), 10_000e6);
        vault.deposit(10_000e6);
        vm.stopPrank();

        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(ArcSwarmVault.NotCoordinator.selector));
        vault.allocateToAgent(yieldAgent, 1_000e6);
    }

    function testAllocateToAgent_AgentNotRegisteredReverts() public {
        vm.startPrank(alice);
        usdc.approve(address(vault), 10_000e6);
        vault.deposit(10_000e6);
        vm.stopPrank();

        vm.expectRevert(abi.encodeWithSelector(ArcSwarmVault.AgentNotRegistered.selector));
        vault.allocateToAgent(unregisteredAgent, 1_000e6);
    }

    function testAllocateToAgent_ZeroAmountReverts() public {
        vm.startPrank(alice);
        usdc.approve(address(vault), 10_000e6);
        vault.deposit(10_000e6);
        vm.stopPrank();

        // No amount check in the vault; the budget manager enforces it.
        vm.expectRevert(abi.encodeWithSelector(AgentBudgetManager.ZeroAllocation.selector));
        vault.allocateToAgent(yieldAgent, 0);
    }

    function testAllocateToAgent_InsufficientVaultBalanceReverts() public {
        vm.startPrank(alice);
        usdc.approve(address(vault), 1_000e6);
        vault.deposit(1_000e6);
        vm.stopPrank();

        vm.expectRevert(abi.encodeWithSelector(ArcSwarmVault.InsufficientVaultBalance.selector));
        vault.allocateToAgent(yieldAgent, 1_000e6 + 1);
    }

    function testAllocateToAgent_SystemPausedReverts() public {
        vm.startPrank(alice);
        usdc.approve(address(vault), 10_000e6);
        vault.deposit(10_000e6);
        vm.stopPrank();

        riskOracle.updateMetrics(150_000e6, 600);

        vm.expectRevert(abi.encodeWithSelector(ArcSwarmVault.SystemPaused.selector));
        vault.allocateToAgent(yieldAgent, 1_000e6);
    }

    function testAllocateToAgent_Success() public {
        vm.startPrank(alice);
        usdc.approve(address(vault), 10_000e6);
        vault.deposit(10_000e6);
        vm.stopPrank();

        vm.expectEmit(true, true, true, true);
        emit ArcSwarmVault.Rebalanced(3_000e6, 0);
        vault.allocateToAgent(yieldAgent, 3_000e6);

        assertEq(usdc.balanceOf(yieldAgent), 3_000e6);
        assertEq(vault.getVaultBalance(), 7_000e6);
        assertEq(budgetManager.getBudget(yieldAgent), 3_000e6);
    }

    // ---------- rebalance / allocate cooldown ----------

    function testAllocateToAgent_CooldownReverts() public {
        vm.startPrank(alice);
        usdc.approve(address(vault), 10_000e6);
        vault.deposit(10_000e6);
        vm.stopPrank();

        vault.allocateToAgent(yieldAgent, 3_000e6);

        // Second allocation within the budget manager's 60s cooldown.
        vm.expectRevert(abi.encodeWithSelector(AgentBudgetManager.AllocationCooldown.selector));
        vault.allocateToAgent(yieldAgent, 3_000e6);

        // After 60s the allocation is allowed again.
        vm.warp(block.timestamp + 60);
        vault.allocateToAgent(yieldAgent, 2_000e6);

        assertEq(budgetManager.getBudget(yieldAgent), 5_000e6);
        assertEq(usdc.balanceOf(yieldAgent), 5_000e6);
    }

    function testAllocateToAgent_CooldownBoundary() public {
        vm.startPrank(alice);
        usdc.approve(address(vault), 10_000e6);
        vault.deposit(10_000e6);
        vm.stopPrank();

        uint256 first = block.timestamp;
        vault.allocateToAgent(yieldAgent, 3_000e6);

        // 59s later still blocked.
        vm.warp(first + 59);
        vm.expectRevert(abi.encodeWithSelector(AgentBudgetManager.AllocationCooldown.selector));
        vault.allocateToAgent(yieldAgent, 1_000e6);

        // Exactly at 60s allowed.
        vm.warp(first + 60);
        vault.allocateToAgent(yieldAgent, 1_000e6);

        assertEq(budgetManager.getBudget(yieldAgent), 4_000e6);
    }

    // ---------- emergencyWithdraw ----------

    function testEmergencyWithdraw_OnlyCoordinatorReverts() public {
        vm.startPrank(alice);
        usdc.approve(address(vault), 10_000e6);
        vault.deposit(10_000e6);
        vm.stopPrank();

        riskOracle.updateMetrics(150_000e6, 600);

        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(ArcSwarmVault.NotCoordinator.selector));
        vault.emergencyWithdraw(1_000e6);
    }

    function testEmergencyWithdraw_SystemNotPausedReverts() public {
        vm.startPrank(alice);
        usdc.approve(address(vault), 10_000e6);
        vault.deposit(10_000e6);
        vm.stopPrank();

        vm.expectRevert(abi.encodeWithSelector(ArcSwarmVault.SystemNotPaused.selector));
        vault.emergencyWithdraw(1_000e6);
    }

    function testEmergencyWithdraw_Success() public {
        vm.startPrank(alice);
        usdc.approve(address(vault), 10_000e6);
        vault.deposit(10_000e6);
        vm.stopPrank();

        riskOracle.updateMetrics(150_000e6, 600);
        assertTrue(riskOracle.isPaused());

        vm.expectEmit(true, true, true, true);
        emit ArcSwarmVault.EmergencyWithdraw(address(this), 4_000e6);
        vault.emergencyWithdraw(4_000e6);

        assertEq(usdc.balanceOf(address(this)), 4_000e6);
        assertEq(vault.getVaultBalance(), 6_000e6);
    }

    function testEmergencyWithdraw_InsufficientBalanceReverts() public {
        vm.startPrank(alice);
        usdc.approve(address(vault), 1_000e6);
        vault.deposit(1_000e6);
        vm.stopPrank();

        riskOracle.updateMetrics(150_000e6, 600);

        vm.expectRevert(abi.encodeWithSelector(ArcSwarmVault.InsufficientVaultBalance.selector));
        vault.emergencyWithdraw(1_000e6 + 1);
    }

    // ---------- depositor tracking ----------

    function testDepositorCount() public {
        assertEq(vault.getDepositorCount(), 0);

        vm.startPrank(alice);
        usdc.approve(address(vault), 10_000e6);
        vault.deposit(10_000e6);
        vm.stopPrank();

        vm.startPrank(bob);
        usdc.approve(address(vault), 10_000e6);
        vault.deposit(10_000e6);
        vm.stopPrank();

        assertEq(vault.getDepositorCount(), 2);

        // Additional deposits by an existing depositor do not duplicate entries.
        vm.startPrank(alice);
        usdc.approve(address(vault), 5_000e6);
        vault.deposit(5_000e6);
        vm.stopPrank();

        assertEq(vault.getDepositorCount(), 2);
        assertEq(vault.userDeposits(alice), 15_000e6);
    }

    function testGetAllDepositors() public {
        vm.startPrank(alice);
        usdc.approve(address(vault), 10_000e6);
        vault.deposit(10_000e6);
        vm.stopPrank();

        vm.startPrank(bob);
        usdc.approve(address(vault), 10_000e6);
        vault.deposit(10_000e6);
        vm.stopPrank();

        address[] memory depositors = vault.getAllDepositors();
        assertEq(depositors.length, 2);
        assertEq(depositors[0], alice);
        assertEq(depositors[1], bob);
    }

    // ---------- harvestYield / misc view ----------

    function testHarvestYield() public {
        vm.expectEmit(true, true, true, true);
        emit ArcSwarmVault.YieldHarvested(5_000e6, 5_000e6);
        vault.harvestYield(5_000e6);

        assertEq(vault.totalYield(), 5_000e6);
    }

    function testHarvestYield_OnlyCoordinator() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(ArcSwarmVault.NotCoordinator.selector));
        vault.harvestYield(1_000e6);
    }

    // ---------- constructor ----------

    function testConstructor_ZeroAddressReverts() public {
        vm.expectRevert(abi.encodeWithSelector(ArcSwarmVault.ZeroAddress.selector));
        new ArcSwarmVault(address(0), address(budgetManager), address(riskOracle));
    }
}
