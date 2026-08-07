// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Test.sol";
import "../src/AgentBudgetManager.sol";

contract AgentBudgetManagerTest is Test {
    AgentBudgetManager budgetManager;

    address alice = makeAddr("alice");
    address yieldAgent = makeAddr("yieldAgent");
    address fxAgent = makeAddr("fxAgent");

    function setUp() public {
        budgetManager = new AgentBudgetManager();
        // admin = address(this) is granted COORDINATOR_ROLE by the constructor.
        // Move past the allocation cooldown (60s) so first allocations pass.
        vm.warp(100);
    }

    // ---------- allocate ----------

    function testAllocate_OnlyCoordinatorReverts() public {
        vm.prank(alice);
        vm.expectRevert("Not coordinator");
        budgetManager.allocate(yieldAgent, 100e6);
    }

    function testAllocate_ZeroAmountReverts() public {
        vm.expectRevert("Zero allocation");
        budgetManager.allocate(yieldAgent, 0);
    }

    function testAllocate_FirstAllocationSuccess() public {
        vm.expectEmit(true, true, true, true);
        emit AgentBudgetManager.AgentBudgetCreated(yieldAgent, 100e6);
        budgetManager.allocate(yieldAgent, 100e6);

        assertEq(budgetManager.getBudget(yieldAgent), 100e6);
        assertEq(budgetManager.getSpent(yieldAgent), 0);
        assertEq(budgetManager.getRemaining(yieldAgent), 100e6);
        (,,, bool active) = budgetManager.budgets(yieldAgent);
        assertTrue(active);
        assertEq(budgetManager.totalAllocated(), 100e6);
        assertEq(budgetManager.getAgentCount(), 1);

        address[] memory activeAgentsArr = budgetManager.getActiveAgents();
        assertEq(activeAgentsArr.length, 1);
        assertEq(activeAgentsArr[0], yieldAgent);
    }

    function testAllocate_SubsequentAllocationEmitsEvent() public {
        budgetManager.allocate(yieldAgent, 100e6);
        vm.warp(block.timestamp + 60);

        vm.expectEmit(true, true, true, true);
        emit AgentBudgetManager.BudgetAllocated(yieldAgent, 50e6, 150e6);
        budgetManager.allocate(yieldAgent, 50e6);

        assertEq(budgetManager.getBudget(yieldAgent), 150e6);
        assertEq(budgetManager.totalAllocated(), 150e6);
    }

    function testAllocate_CooldownReverts() public {
        budgetManager.allocate(yieldAgent, 100e6);

        vm.expectRevert("Allocation cooldown");
        budgetManager.allocate(yieldAgent, 50e6);

        vm.warp(block.timestamp + 59);
        vm.expectRevert("Allocation cooldown");
        budgetManager.allocate(yieldAgent, 50e6);

        vm.warp(block.timestamp + 1);
        budgetManager.allocate(yieldAgent, 50e6);
        assertEq(budgetManager.getBudget(yieldAgent), 150e6);
    }

    function testAllocate_FirstAllocationCooldown() public {
        // Fresh budget, but block.timestamp is still under 60s.
        vm.warp(10);
        vm.expectRevert("Allocation cooldown");
        budgetManager.allocate(fxAgent, 10e6);
    }

    function testAllocate_InactiveAgentReverts() public {
        budgetManager.allocate(yieldAgent, 100e6);
        budgetManager.deactivateAgent(yieldAgent);
        vm.warp(block.timestamp + 60);

        vm.expectRevert("Agent inactive");
        budgetManager.allocate(yieldAgent, 50e6);
    }

    // ---------- spend ----------

    function testSpend_Success() public {
        budgetManager.allocate(yieldAgent, 100e6);

        vm.expectEmit(true, true, true, true);
        emit AgentBudgetManager.BudgetSpent(yieldAgent, 30e6, 70e6);
        assertTrue(budgetManager.spend(yieldAgent, 30e6));

        assertEq(budgetManager.getSpent(yieldAgent), 30e6);
        assertEq(budgetManager.getRemaining(yieldAgent), 70e6);
        assertEq(budgetManager.totalSpent(), 30e6);
    }

    function testSpend_ExactBudgetSucceeds() public {
        budgetManager.allocate(yieldAgent, 100e6);
        assertTrue(budgetManager.spend(yieldAgent, 100e6));
        assertEq(budgetManager.getRemaining(yieldAgent), 0);
    }

    function testSpend_ExceedsBudgetReverts() public {
        budgetManager.allocate(yieldAgent, 100e6);
        assertTrue(budgetManager.spend(yieldAgent, 80e6));

        vm.expectRevert("Insufficient budget");
        budgetManager.spend(yieldAgent, 30e6);
    }

    function testSpend_UnallocatedAgentReverts() public {
        // A never-allocated agent is not active, so spend() blocks earlier.
        vm.expectRevert("Agent not active");
        budgetManager.spend(yieldAgent, 1e6);
    }

    function testSpend_InactiveAgentReverts() public {
        budgetManager.allocate(yieldAgent, 100e6);
        budgetManager.deactivateAgent(yieldAgent);

        vm.expectRevert("Agent not active");
        budgetManager.spend(yieldAgent, 10e6);
    }

    // ---------- deactivateAgent ----------

    function testDeactivateAgent_OnlyCoordinatorReverts() public {
        budgetManager.allocate(yieldAgent, 100e6);

        vm.prank(alice);
        vm.expectRevert("Not coordinator");
        budgetManager.deactivateAgent(yieldAgent);
    }

    function testDeactivateAgent_Success() public {
        budgetManager.allocate(yieldAgent, 100e6);
        (,,, bool activeBefore) = budgetManager.budgets(yieldAgent);
        assertTrue(activeBefore);

        vm.expectEmit(true, true, true, true);
        emit AgentBudgetManager.AgentDeactivated(yieldAgent);
        budgetManager.deactivateAgent(yieldAgent);

        (,,, bool activeAfter) = budgetManager.budgets(yieldAgent);
        assertFalse(activeAfter);
    }

    // ---------- isActive / view helpers ----------

    function testIsActiveInitiallyFalse() public view {
        (,,, bool active) = budgetManager.budgets(yieldAgent);
        assertFalse(active);
    }

    function testGetAgentCount() public {
        assertEq(budgetManager.getAgentCount(), 0);

        budgetManager.allocate(yieldAgent, 10e6);
        vm.warp(block.timestamp + 60);
        budgetManager.allocate(fxAgent, 10e6);

        assertEq(budgetManager.getAgentCount(), 2);
        assertEq(budgetManager.getActiveAgents().length, 2);
    }

    function testSetAllocationCooldown() public {
        vm.expectEmit(true, true, true, true);
        emit AgentBudgetManager.CooldownUpdated(120);
        budgetManager.setAllocationCooldown(120);

        assertEq(budgetManager.allocationCooldown(), 120);
    }

    function testSetAllocationCooldown_OnlyCoordinator() public {
        vm.prank(alice);
        vm.expectRevert("Not coordinator");
        budgetManager.setAllocationCooldown(120);
    }

    function testSetAllocationCooldown_Applied() public {
        budgetManager.allocate(yieldAgent, 10e6);
        budgetManager.setAllocationCooldown(600);

        vm.warp(block.timestamp + 300);
        vm.expectRevert("Allocation cooldown");
        budgetManager.allocate(yieldAgent, 10e6);

        vm.warp(block.timestamp + 301);
        budgetManager.allocate(yieldAgent, 10e6);
        assertEq(budgetManager.getBudget(yieldAgent), 20e6);
    }

    function testGetRemaining_NoAllocation() public view {
        assertEq(budgetManager.getRemaining(yieldAgent), 0);
    }
}
