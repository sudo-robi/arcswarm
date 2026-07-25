// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/access/AccessControl.sol";

contract RiskOracle is AccessControl {
    bytes32 public constant COORDINATOR_ROLE = keccak256("COORDINATOR_ROLE");
    bytes32 public constant RISK_AGENT_ROLE = keccak256("RISK_AGENT_ROLE");

    struct RiskThreshold {
        uint256 maxDrawdown;        // basis points (100 = 1%)
        uint256 maxConcentration;   // basis points
        uint256 maxExposure;        // USDC amount (6 decimals)
        uint256 cooldownPeriod;     // seconds
    }

    struct RiskMetrics {
        uint256 totalExposure;
        uint256 currentDrawdown;
        uint256 maxDrawdownReached;
        uint256 lastRiskCheck;
        uint256 riskScore;          // 0-100 (0=safe, 100=critical)
        bool circuitBreakerActive;
    }

    RiskThreshold public threshold;
    RiskMetrics public metrics;

    bool public paused;
    uint256 public lastCircuitBreakerTrigger;
    uint256 public circuitBreakerDuration = 3600; // 1 hour

    address[] public riskAgents;

    event RiskThresholdUpdated(uint256 maxDrawdown, uint256 maxConcentration, uint256 maxExposure);
    event CircuitBreakerTriggered(uint256 riskScore, uint256 timestamp);
    event CircuitBreakerReleased(uint256 timestamp);
    event RiskCheckCompleted(uint256 riskScore, bool healthy);
    event PauseStateChanged(bool paused);
    event RiskAgentAdded(address agent);
    event RiskAgentRemoved(address agent);

    modifier onlyCoordinator() {
        require(hasRole(COORDINATOR_ROLE, msg.sender), "Not coordinator");
        _;
    }

    modifier onlyRiskAgent() {
        require(hasRole(RISK_AGENT_ROLE, msg.sender), "Not risk agent");
        _;
    }

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(COORDINATOR_ROLE, msg.sender);

        threshold = RiskThreshold({
            maxDrawdown: 500,         // 5%
            maxConcentration: 3000,   // 30%
            maxExposure: 100_000e6,   // 100,000 USDC
            cooldownPeriod: 300       // 5 minutes
        });
    }

    function setThreshold(
        uint256 _maxDrawdown,
        uint256 _maxConcentration,
        uint256 _maxExposure,
        uint256 _cooldownPeriod
    ) external onlyCoordinator {
        threshold = RiskThreshold({
            maxDrawdown: _maxDrawdown,
            maxConcentration: _maxConcentration,
            maxExposure: _maxExposure,
            cooldownPeriod: _cooldownPeriod
        });
        emit RiskThresholdUpdated(_maxDrawdown, _maxConcentration, _maxExposure);
    }

    function updateMetrics(
        uint256 _totalExposure,
        uint256 _currentDrawdown
    ) external onlyRiskAgent {
        metrics.totalExposure = _totalExposure;
        metrics.currentDrawdown = _currentDrawdown;
        metrics.lastRiskCheck = block.timestamp;

        if (_currentDrawdown > metrics.maxDrawdownReached) {
            metrics.maxDrawdownReached = _currentDrawdown;
        }

        metrics.riskScore = _calculateRiskScore();
        metrics.circuitBreakerActive = _shouldTriggerCircuitBreaker();

        if (metrics.circuitBreakerActive && lastCircuitBreakerTrigger + circuitBreakerDuration < block.timestamp) {
            lastCircuitBreakerTrigger = block.timestamp;
            paused = true;
            emit CircuitBreakerTriggered(metrics.riskScore, block.timestamp);
        }

        emit RiskCheckCompleted(metrics.riskScore, !metrics.circuitBreakerActive);
    }

    function _calculateRiskScore() internal view returns (uint256) {
        uint256 score = 0;

        // Drawdown risk (0-40 points)
        if (metrics.currentDrawdown > 0) {
            score += (metrics.currentDrawdown * 40) / threshold.maxDrawdown;
        }

        // Exposure risk (0-30 points)
        if (metrics.totalExposure > 0) {
            score += (metrics.totalExposure * 30) / threshold.maxExposure;
        }

        // Time since last check (0-20 points)
        if (metrics.lastRiskCheck > 0) {
            uint256 timeSinceCheck = block.timestamp - metrics.lastRiskCheck;
            if (timeSinceCheck > threshold.cooldownPeriod * 2) {
                score += 20;
            } else if (timeSinceCheck > threshold.cooldownPeriod) {
                score += 10;
            }
        }

        // Circuit breaker active (10 points)
        if (metrics.circuitBreakerActive) {
            score += 10;
        }

        if (score > 100) score = 100;
        return score;
    }

    function _shouldTriggerCircuitBreaker() internal view returns (bool) {
        if (metrics.currentDrawdown >= threshold.maxDrawdown) return true;
        if (metrics.totalExposure >= threshold.maxExposure) return true;
        if (metrics.riskScore >= 80) return true;
        return false;
    }

    function checkHealth() external view returns (bool healthy, uint256 riskScore) {
        return (!metrics.circuitBreakerActive, metrics.riskScore);
    }

    function isPaused() external view returns (bool) {
        return paused || metrics.circuitBreakerActive;
    }

    function releaseCircuitBreaker() external onlyCoordinator {
        paused = false;
        metrics.circuitBreakerActive = false;
        emit CircuitBreakerReleased(block.timestamp);
    }

    function addRiskAgent(address agent) external onlyCoordinator {
        riskAgents.push(agent);
        _grantRole(RISK_AGENT_ROLE, agent);
        emit RiskAgentAdded(agent);
    }

    function removeRiskAgent(address agent) external onlyCoordinator {
        _revokeRole(RISK_AGENT_ROLE, agent);
        emit RiskAgentRemoved(agent);
    }

    function getRiskScore() external view returns (uint256) {
        return metrics.riskScore;
    }

    function getMetrics() external view returns (RiskMetrics memory) {
        return metrics;
    }
}
