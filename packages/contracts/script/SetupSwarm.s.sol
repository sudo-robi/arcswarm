// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Script.sol";
import "../src/ArcSwarmVault.sol";
import "../src/AgentBudgetManager.sol";
import "../src/AgentRegistry.sol";
import "../src/RiskOracle.sol";
import "../src/PaymentRouter.sol";

contract DeployArcSwarm is Script {
    // Arc Testnet USDC address - update for actual deployment
    address constant USDC_ADDRESS = 0x3600000000000000000000000000000000000000;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        // Deploy AgentBudgetManager
        AgentBudgetManager budgetManager = new AgentBudgetManager();
        console.log("AgentBudgetManager deployed at:", address(budgetManager));

        // Deploy AgentRegistry
        AgentRegistry agentRegistry = new AgentRegistry();
        console.log("AgentRegistry deployed at:", address(agentRegistry));

        // Deploy RiskOracle
        RiskOracle riskOracle = new RiskOracle();
        console.log("RiskOracle deployed at:", address(riskOracle));

        // Deploy PaymentRouter
        PaymentRouter paymentRouter = new PaymentRouter(USDC_ADDRESS);
        console.log("PaymentRouter deployed at:", address(paymentRouter));

        // Deploy ArcSwarmVault
        ArcSwarmVault vault = new ArcSwarmVault(
            USDC_ADDRESS,
            address(budgetManager),
            address(riskOracle)
        );
        console.log("ArcSwarmVault deployed at:", address(vault));

        // Setup roles
        bytes32 coordinatorRole = keccak256("COORDINATOR_ROLE");
        vault.grantRole(coordinatorRole, address(vault));

        // Register coordinator in agent registry
        agentRegistry.registerAgent(
            msg.sender,
            keccak256("COORDINATOR"),
            AgentRegistry.AgentType.COORDINATOR,
            "ArcSwarm Coordinator"
        );

        // Grant roles to budget manager
        budgetManager.grantRole(coordinatorRole, address(vault));

        vm.stopBroadcast();

        console.log("\n=== Deployment Complete ===");
        console.log("Vault:", address(vault));
        console.log("BudgetManager:", address(budgetManager));
        console.log("AgentRegistry:", address(agentRegistry));
        console.log("RiskOracle:", address(riskOracle));
        console.log("PaymentRouter:", address(paymentRouter));
    }
}
