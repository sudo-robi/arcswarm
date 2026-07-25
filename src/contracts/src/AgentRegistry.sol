// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/access/AccessControl.sol";

contract AgentRegistry is AccessControl {
    bytes32 public constant COORDINATOR_ROLE = keccak256("COORDINATOR_ROLE");
    bytes32 public constant AGENT_ROLE = keccak256("AGENT_ROLE");

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

    mapping(address => AgentInfo) public agents;
    mapping(bytes32 => address) public agentIdToAddress;
    mapping(address => ReputationEvent[]) public reputationHistory;

    bytes32[] public registeredAgentIds;
    address[] public registeredAgents;

    event AgentRegistered(address indexed wallet, bytes32 agentId, AgentType agentType, string name);
    event ReputationUpdated(address indexed agent, int256 delta, uint256 newScore, string reason);
    event AgentDeactivated(address indexed agent);

    modifier onlyCoordinator() {
        require(hasRole(COORDINATOR_ROLE, msg.sender), "Not coordinator");
        _;
    }

    modifier onlyAgent() {
        require(hasRole(AGENT_ROLE, msg.sender), "Not registered agent");
        _;
    }

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(COORDINATOR_ROLE, msg.sender);
    }

    function registerAgent(
        address wallet,
        bytes32 agentId,
        AgentType agentType,
        string calldata name
    ) external onlyCoordinator returns (address) {
        require(agentIdToAddress[agentId] == address(0), "Agent ID exists");
        require(agents[wallet].registeredAt == 0, "Already registered");

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

    function updateReputation(
        address agent,
        int256 delta,
        string calldata reason
    ) external onlyCoordinator {
        require(agents[agent].active, "Agent not active");

        AgentInfo storage info = agents[agent];
        uint256 newScore = uint256(int256(info.reputationScore) + delta);
        if (newScore > 100) newScore = 100;
        info.reputationScore = newScore;

        reputationHistory[agent].push(ReputationEvent({
            agent: agent,
            delta: delta,
            reason: reason,
            timestamp: block.timestamp
        }));

        emit ReputationUpdated(agent, delta, newScore, reason);
    }

    function touchAgent(address agent) external onlyAgent {
        agents[agent].lastActiveAt = block.timestamp;
    }

    function deactivateAgent(address agent) external onlyCoordinator {
        agents[agent].active = false;
        _revokeRole(AGENT_ROLE, agent);
        emit AgentDeactivated(agent);
    }

    function isAgent(address wallet) external view returns (bool) {
        return agents[wallet].active;
    }

    function getAgentInfo(address wallet) external view returns (AgentInfo memory) {
        return agents[wallet];
    }

    function getAgentCount() external view returns (uint256) {
        return registeredAgents.length;
    }

    function getAllAgents() external view returns (address[] memory) {
        return registeredAgents;
    }

    function getReputationHistory(address agent) external view returns (ReputationEvent[] memory) {
        return reputationHistory[agent];
    }
}
