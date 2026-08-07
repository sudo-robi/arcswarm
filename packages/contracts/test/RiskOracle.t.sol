// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Test.sol";
import "../src/RiskOracle.sol";

contract RiskOracleTest is Test {
    RiskOracle oracle;

    address alice = makeAddr("alice");
    address riskAgent = makeAddr("riskAgent");
    address bob = makeAddr("bob");

    function setUp() public {
        oracle = new RiskOracle();
        // admin = address(this) is granted COORDINATOR_ROLE by the constructor.
        // Use a large block.timestamp so the circuit breaker trigger logic
        // (lastTrigger + 1h < now) can set paused on first trigger.
        vm.warp(1_000_000);
    }

    // ---------- updateMetrics (role gate) ----------

    function testUpdateMetrics_OnlyRiskAgentReverts() public {
        vm.prank(alice);
        vm.expectRevert("Not risk agent");
        oracle.updateMetrics(50_000e6, 100);
    }

    function testUpdateMetrics_Success() public {
        // Grant the test the RISK_AGENT_ROLE so it can push metrics.
        oracle.grantRole(keccak256("RISK_AGENT_ROLE"), address(this));

        vm.expectEmit(true, true, true, true);
        emit RiskOracle.RiskCheckCompleted(11, true);
        oracle.updateMetrics(10_000e6, 100);

        RiskOracle.RiskMetrics memory m = oracle.getMetrics();
        assertEq(m.totalExposure, 10_000e6);
        assertEq(m.currentDrawdown, 100);
        assertEq(m.lastRiskCheck, block.timestamp);
        assertEq(m.riskScore, 11);
        assertFalse(m.circuitBreakerActive);
        assertEq(oracle.getRiskScore(), 11);
    }

    function testUpdateMetrics_TracksMaxDrawdown() public {
        oracle.grantRole(keccak256("RISK_AGENT_ROLE"), address(this));

        oracle.updateMetrics(10_000e6, 100);
        oracle.updateMetrics(10_000e6, 300);
        oracle.updateMetrics(10_000e6, 50);

        assertEq(oracle.getMetrics().maxDrawdownReached, 300);
    }

    // ---------- risk score clamp ----------

    function testRiskScore_ClampedTo100() public {
        oracle.grantRole(keccak256("RISK_AGENT_ROLE"), address(this));

        // Huge values would exceed 100 without clamping.
        oracle.updateMetrics(1_000_000e6, 5_000);

        assertEq(oracle.getRiskScore(), 100);
    }

    function testRiskScore_Deterministic() public {
        oracle.grantRole(keccak256("RISK_AGENT_ROLE"), address(this));

        // drawdown: 200 * 40 / 500 = 16, exposure: 50_000e6 * 30 / 100_000e6 = 15.
        oracle.updateMetrics(50_000e6, 200);

        assertEq(oracle.getRiskScore(), 31);
    }

    // ---------- circuit breaker / pause ----------

    function testCircuitBreaker_TriggersPause() public {
        oracle.grantRole(keccak256("RISK_AGENT_ROLE"), address(this));

        // After fix: riskScore computed first, then circuit breaker checked with new score.
        // drawdown 600*40/500 = 48, exposure 150_000e6*30/100_000e6 = 45 => 93.
        // Circuit breaker active (+10) => 103, clamped to 100.
        vm.expectEmit(true, true, true, true);
        emit RiskOracle.CircuitBreakerTriggered(100, block.timestamp);
        oracle.updateMetrics(150_000e6, 600);

        assertTrue(oracle.paused());
        assertTrue(oracle.isPaused());
        assertEq(oracle.lastCircuitBreakerTrigger(), block.timestamp);
        assertTrue(oracle.getMetrics().circuitBreakerActive);
    }

    function testCircuitBreaker_NotTriggeredWhenHealthy() public {
        oracle.grantRole(keccak256("RISK_AGENT_ROLE"), address(this));

        oracle.updateMetrics(10_000e6, 100);

        assertFalse(oracle.paused());
        assertFalse(oracle.isPaused());
        assertEq(oracle.lastCircuitBreakerTrigger(), 0);
    }

    function testCircuitBreaker_OneHourRetriggerCooldown() public {
        oracle.grantRole(keccak256("RISK_AGENT_ROLE"), address(this));

        oracle.updateMetrics(150_000e6, 600);
        uint256 firstTrigger = oracle.lastCircuitBreakerTrigger();
        assertEq(firstTrigger, block.timestamp);

        // Within the 1h window the breaker does not re-arm the timestamp.
        vm.warp(block.timestamp + 1800);
        oracle.updateMetrics(150_000e6, 600);
        assertEq(oracle.lastCircuitBreakerTrigger(), firstTrigger);
        assertTrue(oracle.paused());

        // Past the 1h window the breaker re-arms.
        vm.warp(firstTrigger + 3601);
        oracle.updateMetrics(150_000e6, 600);
        assertEq(oracle.lastCircuitBreakerTrigger(), block.timestamp);
        assertTrue(oracle.paused());
    }

    function testReleaseCircuitBreaker_Success() public {
        oracle.grantRole(keccak256("RISK_AGENT_ROLE"), address(this));
        oracle.updateMetrics(150_000e6, 600);
        assertTrue(oracle.isPaused());

        vm.expectEmit(true, true, true, true);
        emit RiskOracle.CircuitBreakerReleased(block.timestamp);
        oracle.releaseCircuitBreaker();

        assertFalse(oracle.paused());
        assertFalse(oracle.getMetrics().circuitBreakerActive);
        assertFalse(oracle.isPaused());
    }

    function testReleaseCircuitBreaker_OnlyCoordinator() public {
        oracle.grantRole(keccak256("RISK_AGENT_ROLE"), address(this));
        oracle.updateMetrics(150_000e6, 600);

        vm.prank(alice);
        vm.expectRevert("Not coordinator");
        oracle.releaseCircuitBreaker();
    }

    // ---------- risk agent management ----------

    function testAddRiskAgent_OnlyCoordinator() public {
        vm.prank(alice);
        vm.expectRevert("Not coordinator");
        oracle.addRiskAgent(riskAgent);
    }

    function testAddRiskAgent_Success() public {
        vm.expectEmit(true, true, true, true);
        emit RiskOracle.RiskAgentAdded(riskAgent);
        oracle.addRiskAgent(riskAgent);

        assertTrue(oracle.hasRole(keccak256("RISK_AGENT_ROLE"), riskAgent));
        assertEq(oracle.riskAgents(0), riskAgent);

        // The new risk agent can now update metrics.
        vm.prank(riskAgent);
        oracle.updateMetrics(10_000e6, 100);
        assertEq(oracle.getRiskScore(), 11);
    }

    function testRemoveRiskAgent() public {
        oracle.addRiskAgent(riskAgent);
        oracle.addRiskAgent(bob);

        vm.expectEmit(true, true, true, true);
        emit RiskOracle.RiskAgentRemoved(riskAgent);
        oracle.removeRiskAgent(riskAgent);

        assertFalse(oracle.hasRole(keccak256("RISK_AGENT_ROLE"), riskAgent));
        assertTrue(oracle.hasRole(keccak256("RISK_AGENT_ROLE"), bob));
    }

    function testRemoveRiskAgent_OnlyCoordinator() public {
        oracle.addRiskAgent(riskAgent);

        vm.prank(alice);
        vm.expectRevert("Not coordinator");
        oracle.removeRiskAgent(riskAgent);
    }

    // ---------- checkHealth ----------

    function testCheckHealth_Healthy() public {
        oracle.grantRole(keccak256("RISK_AGENT_ROLE"), address(this));
        oracle.updateMetrics(10_000e6, 100);

        (bool healthy, uint256 riskScore) = oracle.checkHealth();
        assertTrue(healthy);
        assertEq(riskScore, 11);
    }

    function testCheckHealth_Paused() public {
        oracle.grantRole(keccak256("RISK_AGENT_ROLE"), address(this));
        oracle.updateMetrics(150_000e6, 600);

        (bool healthy, ) = oracle.checkHealth();
        assertFalse(healthy);
    }

    // ---------- threshold management ----------

    function testSetThreshold_OnlyCoordinator() public {
        vm.prank(alice);
        vm.expectRevert("Not coordinator");
        oracle.setThreshold(100, 100, 1e6, 60);
    }

    function testSetThreshold_Success() public {
        vm.expectEmit(true, true, true, true);
        emit RiskOracle.RiskThresholdUpdated(100, 2000, 50_000e6);
        oracle.setThreshold(100, 2000, 50_000e6, 120);

        (uint256 maxDrawdown, uint256 maxConcentration, uint256 maxExposure, uint256 cooldownPeriod) =
            oracle.threshold();
        assertEq(maxDrawdown, 100);
        assertEq(maxConcentration, 2000);
        assertEq(maxExposure, 50_000e6);
        assertEq(cooldownPeriod, 120);
    }

    // ---------- views ----------

    function testGetRiskScore_InitialZero() public view {
        assertEq(oracle.getRiskScore(), 0);
    }

    function testIsPaused_InitiallyFalse() public view {
        assertFalse(oracle.isPaused());
    }

    function testGetMetrics_Initial() public view {
        RiskOracle.RiskMetrics memory m = oracle.getMetrics();
        assertEq(m.totalExposure, 0);
        assertEq(m.currentDrawdown, 0);
        assertEq(m.riskScore, 0);
        assertFalse(m.circuitBreakerActive);
    }
}
