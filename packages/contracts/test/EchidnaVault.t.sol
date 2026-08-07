// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test, console} from "forge-std/Test.sol";
import {ArcSwarmVault} from "../src/ArcSwarmVault.sol";
import {AgentBudgetManager} from "../src/AgentBudgetManager.sol";
import {RiskOracle} from "../src/RiskOracle.sol";
import {MockERC20} from "./mocks/MockERC20.sol";

contract EchidnaVault is Test {
    ArcSwarmVault public vault;
    MockERC20 public usdc;
    AgentBudgetManager public budgetManager;
    RiskOracle public riskOracle;
    address public owner = address(0x1234);
    address public user1 = address(0x5678);
    address public user2 = address(0x9ABC);
    
    function setUp() public {
        usdc = new MockERC20("USD Coin", "USDC", 6);
        budgetManager = new AgentBudgetManager();
        riskOracle = new RiskOracle();
        vault = new ArcSwarmVault(address(usdc), address(budgetManager), address(riskOracle));
        
        // Mint some USDC to test users
        usdc.mint(user1, 1000000e6);
        usdc.mint(user2, 1000000e6);
        
        // Approve vault to spend
        vm.startPrank(user1);
        usdc.approve(address(vault), type(uint256).max);
        vm.stopPrank();
        
        vm.startPrank(user2);
        usdc.approve(address(vault), type(uint256).max);
        vm.stopPrank();
    }
    
    // Invariant: Vault total deposits should never be less than sum of user deposits
    function invariant_vaultSolvency() public view {
        uint256 totalDeposits = vault.totalDeposits();
        uint256 sumOfDeposits = vault.userDeposits(user1) + vault.userDeposits(user2);
        assertEq(totalDeposits, sumOfDeposits);
    }
    
    // Invariant: User balance should not exceed total deposits
    function invariant_userBalanceNotExceedsDeposits() public view {
        uint256 user1Deposit = vault.userDeposits(user1);
        uint256 user2Deposit = vault.userDeposits(user2);
        uint256 totalDeposits = vault.totalDeposits();
        
        assertGe(totalDeposits, user1Deposit);
        assertGe(totalDeposits, user2Deposit);
    }
    
    // Invariant: Total deposits should equal sum of user deposits
    function invariant_totalSharesEqualsSumOfBalances() public view {
        uint256 totalDeposits = vault.totalDeposits();
        uint256 sumOfDeposits = vault.userDeposits(user1) + vault.userDeposits(user2);
        assertEq(totalDeposits, sumOfDeposits);
    }
    
    // Invariant: Vault should not allow user balances to exceed total deposits
    function invariant_withdrawalLimit() public view {
        uint256 user1Deposit = vault.userDeposits(user1);
        uint256 user2Deposit = vault.userDeposits(user2);
        
        assertLe(user1Deposit, vault.totalDeposits());
        assertLe(user2Deposit, vault.totalDeposits());
    }
    
    // Invariant action helper
    function test_depositIncreasesAssets() public {
        uint256 balanceBefore = vault.userDeposits(user1);
        vm.startPrank(user1);
        vault.deposit(1000e6);
        vm.stopPrank();
        assertEq(vault.userDeposits(user1), balanceBefore + 1000e6);
    }
    
    // Invariant action helper
    function test_withdrawalDecreasesAssets() public {
        vm.startPrank(user1);
        vault.deposit(1000e6);
        vm.stopPrank();
        
        uint256 balance = vault.userDeposits(user1);
        vm.startPrank(user1);
        vault.withdraw(1000e6);
        vm.stopPrank();
        assertEq(vault.userDeposits(user1), balance - 1000e6);
    }
}