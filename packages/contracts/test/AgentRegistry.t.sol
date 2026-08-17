// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Test.sol";
import "../src/AgentRegistry.sol";

contract AgentRegistryTest is Test {
    AgentRegistry registry;

    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address yieldAgent = makeAddr("yieldAgent");
    address fxAgent = makeAddr("fxAgent");

    bytes32 constant YIELD_ID = keccak256("YIELD-001");
    bytes32 constant FX_ID = keccak256("FX-001");

    function setUp() public {
        registry = new AgentRegistry();
        // admin = address(this) is granted COORDINATOR_ROLE by the constructor.
        vm.warp(100);
    }

    // ---------- registerAgent ----------

    function testRegisterAgent_OnlyCoordinatorReverts() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(AgentRegistry.NotCoordinator.selector));
        registry.registerAgent(yieldAgent, YIELD_ID, AgentRegistry.AgentType.YIELD, "Yield Agent");
    }

    function testRegisterAgent_DuplicateAgentIdReverts() public {
        registry.registerAgent(yieldAgent, YIELD_ID, AgentRegistry.AgentType.YIELD, "Yield Agent");

        vm.expectRevert(abi.encodeWithSelector(AgentRegistry.AgentIdExists.selector));
        registry.registerAgent(fxAgent, YIELD_ID, AgentRegistry.AgentType.FX, "FX Agent");
    }

    function testRegisterAgent_AlreadyRegisteredReverts() public {
        registry.registerAgent(yieldAgent, YIELD_ID, AgentRegistry.AgentType.YIELD, "Yield Agent");

        vm.expectRevert(abi.encodeWithSelector(AgentRegistry.AlreadyRegistered.selector));
        registry.registerAgent(yieldAgent, FX_ID, AgentRegistry.AgentType.FX, "FX Agent");
    }

    function testRegisterAgent_ZeroAddressReverts() public {
        vm.expectRevert(abi.encodeWithSelector(AgentRegistry.ZeroAddress.selector));
        registry.registerAgent(address(0), YIELD_ID, AgentRegistry.AgentType.YIELD, "Zero Agent");
    }

    function testRegisterAgent_Success() public {
        uint256 registeredAt = block.timestamp;

        vm.expectEmit(true, true, true, true);
        emit AgentRegistry.AgentRegistered(yieldAgent, YIELD_ID, AgentRegistry.AgentType.YIELD, "Yield Agent");
        address returned = registry.registerAgent(
            yieldAgent,
            YIELD_ID,
            AgentRegistry.AgentType.YIELD,
            "Yield Agent"
        );

        assertEq(returned, yieldAgent);
        assertEq(registry.getAgentCount(), 1);

        AgentRegistry.AgentInfo memory info = registry.getAgentInfo(yieldAgent);
        assertEq(info.agentId, YIELD_ID);
        assertEq(uint8(info.agentType), uint8(AgentRegistry.AgentType.YIELD));
        assertEq(info.name, "Yield Agent");
        assertEq(info.registeredAt, registeredAt);
        assertEq(info.lastActiveAt, registeredAt);
        assertEq(info.reputationScore, 50);
        assertTrue(info.active);
        assertEq(info.wallet, yieldAgent);

        // Public mapping getter (the "getAgent" view) returns the struct as a tuple.
        (
            bytes32 viaId,
            AgentRegistry.AgentType viaType,
            string memory viaName,
            uint256 viaRegisteredAt,
            uint256 viaLastActiveAt,
            uint256 viaReputation,
            bool viaActive,
            address viaWallet
        ) = registry.agents(yieldAgent);
        assertEq(viaId, YIELD_ID);
        assertEq(uint8(viaType), uint8(AgentRegistry.AgentType.YIELD));
        assertEq(viaName, "Yield Agent");
        assertEq(viaRegisteredAt, registeredAt);
        assertEq(viaLastActiveAt, registeredAt);
        assertEq(viaReputation, 50);
        assertTrue(viaActive);
        assertEq(viaWallet, yieldAgent);

        assertEq(registry.agentIdToAddress(YIELD_ID), yieldAgent);
        assertTrue(registry.hasRole(keccak256("AGENT_ROLE"), yieldAgent));
        assertTrue(registry.isAgent(yieldAgent));

        address[] memory all = registry.getAllAgents();
        assertEq(all.length, 1);
        assertEq(all[0], yieldAgent);
    }

    function testRegisterAgent_AllAgentTypes() public {
        address[] memory wallets = new address[](6);
        bytes32[] memory ids = new bytes32[](6);
        AgentRegistry.AgentType[6] memory types = [
            AgentRegistry.AgentType.YIELD,
            AgentRegistry.AgentType.LIQUIDITY,
            AgentRegistry.AgentType.FX,
            AgentRegistry.AgentType.PAYMENT,
            AgentRegistry.AgentType.RISK,
            AgentRegistry.AgentType.COORDINATOR
        ];

        for (uint256 i = 0; i < 6; i++) {
            wallets[i] = makeAddr(string.concat("agent", vm.toString(i)));
            ids[i] = keccak256(abi.encodePacked("ID-", i));
            registry.registerAgent(wallets[i], ids[i], types[i], "name");
        }

        assertEq(registry.getAgentCount(), 6);
        for (uint256 i = 0; i < 6; i++) {
            AgentRegistry.AgentInfo memory info = registry.getAgentInfo(wallets[i]);
            assertEq(uint8(info.agentType), uint8(types[i]));
        }
    }

    // ---------- updateReputation ----------

    function testUpdateReputation_OnlyCoordinatorReverts() public {
        registry.registerAgent(yieldAgent, YIELD_ID, AgentRegistry.AgentType.YIELD, "Yield Agent");

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(AgentRegistry.NotCoordinator.selector));
        registry.updateReputation(yieldAgent, 10, "reason");
    }

    function testUpdateReputation_InactiveAgentReverts() public {
        registry.registerAgent(yieldAgent, YIELD_ID, AgentRegistry.AgentType.YIELD, "Yield Agent");
        registry.deactivateAgent(yieldAgent);

        vm.expectRevert(abi.encodeWithSelector(AgentRegistry.AgentNotActive.selector));
        registry.updateReputation(yieldAgent, 10, "reason");
    }

    function testUpdateReputation_Success() public {
        registry.registerAgent(yieldAgent, YIELD_ID, AgentRegistry.AgentType.YIELD, "Yield Agent");

        vm.expectEmit(true, true, true, true);
        emit AgentRegistry.ReputationUpdated(yieldAgent, 15, 65, "good performance");
        registry.updateReputation(yieldAgent, 15, "good performance");

        assertEq(registry.getAgentInfo(yieldAgent).reputationScore, 65);
    }

    function testUpdateReputation_NegativeDelta() public {
        registry.registerAgent(yieldAgent, YIELD_ID, AgentRegistry.AgentType.YIELD, "Yield Agent");
        registry.updateReputation(yieldAgent, 30, "up");
        registry.updateReputation(yieldAgent, -10, "down");

        assertEq(registry.getAgentInfo(yieldAgent).reputationScore, 70);
    }

    function testUpdateReputation_ClampsAbove100() public {
        registry.registerAgent(yieldAgent, YIELD_ID, AgentRegistry.AgentType.YIELD, "Yield Agent");

        registry.updateReputation(yieldAgent, 200, "huge boost");

        // Clamped to max 100.
        assertEq(registry.getAgentInfo(yieldAgent).reputationScore, 100);
    }

    function testUpdateReputation_DropBelowZeroClampsToZero() public {
        registry.registerAgent(yieldAgent, YIELD_ID, AgentRegistry.AgentType.YIELD, "Yield Agent");

        // After fix: negative delta drops score, but clamps at 0 (not wraps to max).
        registry.updateReputation(yieldAgent, -100, "crash");

        assertEq(registry.getAgentInfo(yieldAgent).reputationScore, 0);
    }

    function testUpdateReputation_HistoryGrows() public {
        registry.registerAgent(yieldAgent, YIELD_ID, AgentRegistry.AgentType.YIELD, "Yield Agent");

        registry.updateReputation(yieldAgent, 10, "first");
        registry.updateReputation(yieldAgent, -5, "second");
        registry.updateReputation(yieldAgent, 20, "third");

        AgentRegistry.ReputationEvent[] memory history = registry.getReputationHistory(yieldAgent);
        assertEq(history.length, 3);
        assertEq(history[0].delta, 10);
        assertEq(history[0].reason, "first");
        assertEq(history[1].delta, -5);
        assertEq(history[2].delta, 20);
        assertEq(history[0].agent, yieldAgent);
    }

    function testFuzz_UpdateReputation(uint256 delta) public {
        vm.assume(delta <= 1000);
        registry.registerAgent(yieldAgent, YIELD_ID, AgentRegistry.AgentType.YIELD, "Yield Agent");

        registry.updateReputation(yieldAgent, int256(delta), "fuzz");

        uint256 expected = 50 + delta;
        if (expected > 100) expected = 100;
        assertEq(registry.getAgentInfo(yieldAgent).reputationScore, expected);
    }

    // ---------- touchAgent ----------

    function testTouchAgent_OnlyAgent() public {
        registry.registerAgent(yieldAgent, YIELD_ID, AgentRegistry.AgentType.YIELD, "Yield Agent");

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(AgentRegistry.NotRegisteredAgent.selector));
        registry.touchAgent(yieldAgent);

        vm.warp(block.timestamp + 1000);
        vm.prank(yieldAgent);
        registry.touchAgent(yieldAgent);

        assertEq(registry.getAgentInfo(yieldAgent).lastActiveAt, block.timestamp);
    }

    // ---------- deactivateAgent ----------

    function testDeactivateAgent() public {
        registry.registerAgent(yieldAgent, YIELD_ID, AgentRegistry.AgentType.YIELD, "Yield Agent");

        registry.deactivateAgent(yieldAgent);

        assertFalse(registry.getAgentInfo(yieldAgent).active);
        assertFalse(registry.isAgent(yieldAgent));
        assertFalse(registry.hasRole(keccak256("AGENT_ROLE"), yieldAgent));
    }

    function testDeactivateAgent_OnlyCoordinator() public {
        registry.registerAgent(yieldAgent, YIELD_ID, AgentRegistry.AgentType.YIELD, "Yield Agent");

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(AgentRegistry.NotCoordinator.selector));
        registry.deactivateAgent(yieldAgent);
    }

    // ---------- views ----------

    function testGetAgentCount() public {
        assertEq(registry.getAgentCount(), 0);

        registry.registerAgent(yieldAgent, YIELD_ID, AgentRegistry.AgentType.YIELD, "Yield Agent");
        registry.registerAgent(fxAgent, FX_ID, AgentRegistry.AgentType.FX, "FX Agent");

        assertEq(registry.getAgentCount(), 2);
        assertEq(registry.getAllAgents().length, 2);
    }

    function testIsAgent_UnknownAddress() public view {
        assertFalse(registry.isAgent(alice));
    }

    function testGetReputationHistory_Empty() public view {
        assertEq(registry.getReputationHistory(yieldAgent).length, 0);
    }
}
