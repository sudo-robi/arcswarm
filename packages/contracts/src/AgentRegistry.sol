// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/access/AccessControl.sol";

/// @title AgentRegistry
/// @notice On-chain registry for ArcSwarm agents. Stores identity, type,
///         reputation score, and historical reputation events.
/// @dev Agents are registered by the COORDINATOR_ROLE and receive AGENT_ROLE.
contract AgentRegistry is AccessControl {
    bytes32 public constant COORDINATOR_ROLE = keccak256("COORDINATOR_ROLE");
    bytes32 public constant AGENT_ROLE = keccak256("AGENT_ROLE");

    // ── Errors ───────────────────────────────────────────────────────────
    error NotCoordinator();
    error NotRegisteredAgent();
    error ZeroAddress();
    error AgentIdExists();
    error AlreadyRegistered();
    error AgentNotActive();

    // ── Types ────────────────────────────────────────────────────────────
    enum AgentType { YIELD, LIQUIDITY, FX, PAYMENT, RISK, COORDINATOR }

    struct AgentInfo {
        bytes32 agentId;
        AgentType agentType;
        string name;
        uint256 registeredAt;
        uint256 lastActiveAt;
        uint256 reputationScore; // 0-100
        bool active;
        address wallet;
    }

    struct ReputationEvent {
        address agent;
        int256 delta;
        string reason;
        uint256 timestamp;
    }

    // ── Storage ──────────────────────────────────────────────────────────
    mapping(address => AgentInfo) public agents;
    mapping(bytes32 => address) public agentIdToAddress;
    mapping(address => ReputationEvent[]) public reputationHistory;

    bytes32[] public registeredAgentIds;
    address[] public registeredAgents;

    // ── Events ───────────────────────────────────────────────────────────
    event AgentRegistered(address indexed wallet, bytes32 agentId, AgentType agentType, string name);
    event ReputationUpdated(address indexed agent, int256 delta, uint256 newScore, string reason);
    event AgentDeactivated(address indexed agent);

    // ── Modifiers ────────────────────────────────────────────────────────
    modifier onlyCoordinator() {
        if (!hasRole(COORDINATOR_ROLE, msg.sender)) revert NotCoordinator();
        _;
    }

    modifier onlyAgent() {
        if (!hasRole(AGENT_ROLE, msg.sender)) revert NotRegisteredAgent();
        _;
    }

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(COORDINATOR_ROLE, msg.sender);
    }

    /// @notice Register a new agent on-chain.
    /// @param wallet    Address of the agent's wallet.
    /// @param agentId   Unique bytes32 identifier for the agent.
    /// @param agentType Enum indicating the agent's role.
    /// @param name      Human-readable name.
    /// @return The registered wallet address.
    function registerAgent(
        address wallet,
        bytes32 agentId,
        AgentType agentType,
        string calldata name
    ) external onlyCoordinator returns (address) {
        if (wallet == address(0)) revert ZeroAddress();
        if (agentIdToAddress[agentId] != address(0)) revert AgentIdExists();
        if (agents[wallet].registeredAt != 0) revert AlreadyRegistered();

        agents[wallet] = AgentInfo({
            agentId: agentId,
            agentType: agentType,
            name: name,
            registeredAt: block.timestamp,
            lastActiveAt: block.timestamp,
            reputationScore: 50, // Start at neutral
            active: true,
            wallet: wallet
        });

        agentIdToAddress[agentId] = wallet;
        registeredAgentIds.push(agentId);
        registeredAgents.push(wallet);

        _grantRole(AGENT_ROLE, wallet);

        emit AgentRegistered(wallet, agentId, agentType, name);
        return wallet;
    }

    /// @notice Adjust an agent's reputation score. The score is clamped to [0, 100].
    /// @param agent  Address of the agent.
    /// @param delta  Signed change to the reputation score.
    /// @param reason Human-readable reason for the change.
    function updateReputation(
        address agent,
        int256 delta,
        string calldata reason
    ) external onlyCoordinator {
        if (!agents[agent].active) revert AgentNotActive();

        AgentInfo storage info = agents[agent];
        int256 newScore = int256(info.reputationScore) + delta;
        if (newScore > 100) newScore = 100;
        if (newScore < 0) newScore = 0;
        info.reputationScore = uint256(newScore);

        reputationHistory[agent].push(ReputationEvent({
            agent: agent,
            delta: delta,
            reason: reason,
            timestamp: block.timestamp
        }));

        emit ReputationUpdated(agent, delta, uint256(newScore), reason);
    }

    /// @notice Update the agent's last-active timestamp. Callable by any registered agent.
    function touchAgent(address agent) external onlyAgent {
        agents[agent].lastActiveAt = block.timestamp;
    }

    /// @notice Deactivate an agent and revoke its AGENT_ROLE.
    function deactivateAgent(address agent) external onlyCoordinator {
        agents[agent].active = false;
        _revokeRole(AGENT_ROLE, agent);
        emit AgentDeactivated(agent);
    }

    // ── View functions ───────────────────────────────────────────────────

    /// @notice Whether the given address is an active agent.
    function isAgent(address wallet) external view returns (bool) {
        return agents[wallet].active;
    }

    /// @notice Full agent info for the given wallet.
    function getAgentInfo(address wallet) external view returns (AgentInfo memory) {
        return agents[wallet];
    }

    /// @notice Total number of registered agents.
    function getAgentCount() external view returns (uint256) {
        return registeredAgents.length;
    }

    /// @notice All registered agent addresses.
    function getAllAgents() external view returns (address[] memory) {
        return registeredAgents;
    }

    /// @notice Full reputation history for an agent.
    function getReputationHistory(address agent) external view returns (ReputationEvent[] memory) {
        return reputationHistory[agent];
    }
}
