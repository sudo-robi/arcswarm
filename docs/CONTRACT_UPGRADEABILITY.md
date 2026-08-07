# Smart Contract Upgradeability Plan (UUPS Architecture)

This document outlines the upgradeability governance and execution strategy for ArcSwarm smart contracts on Arc Testnet & Mainnet.

---

## 1. Upgrade Architecture: Universal UUPS Proxy (ERC-1967)

To allow logic updates without migrating treasury assets or breaking agent contract dependencies, core contracts (`ArcSwarmVault`, `AgentBudgetManager`, `RiskOracle`, `PaymentRouter`) are designed to be deployed behind UUPS (Universal Upgradeable Proxy Standard - ERC-1967) proxy instances.

```
       User / Agent Calls
               │
               ▼
┌───────────────────────────────┐
│     ERC-1967 Proxy Contract   │
│     (Holds Vault Balances)    │
└──────────────┬────────────────┘
               │ delegatecall
               ▼
┌───────────────────────────────┐
│     Implementation Contract   │
│     (Upgradeable Logic V1/V2) │
└───────────────────────────────┘
```

---

## 2. Upgrade Governance & Timelock Guardrails

1. **Multisig Ownership:**
   - Proxies are owned by a 3-of-5 Multisig wallet (`MultisigAdmin`).
2. **48-Hour Timelock:**
   - Any proposed contract upgrade must sit in a 48-hour Timelock before execution.
3. **Emergency Circuit Breakers:**
   - `RiskOracle.sol` retains immediate emergency pause privileges, but proxy upgrades require full Timelock clearance.

---

## 3. Storage Gap & Storage Safety Rules

- **Storage Gaps:** All implementation contracts reserve a `uint256[50] private __gap;` variable at the end of contract storage to allow adding new state variables in future versions without storage layout collision.
- **Initializer Functions:** Use OpenZeppelin `initializer` modifier instead of standard constructors for initial setup.

---

## 4. Step-by-Step Contract Upgrade Execution

### Step 1: Compile and Verify New Implementation
```bash
forge build
forge test --match-contract VaultUpgradeTest
```

### Step 2: Deploy New Implementation Contract
```bash
forge script script/UpgradeVault.s.sol:UpgradeVaultScript \
  --rpc-url arc-testnet \
  --broadcast \
  --verify
```

### Step 3: Propose Upgrade via Timelock
```solidity
// Call Timelock.schedule(...)
bytes fontData = abi.encodeWithSelector(
    UUPSUpgradeable.upgradeToAndCall.selector,
    newImplementationAddress,
    ""
);
timelock.schedule(vaultProxyAddress, 0, fontData, bytes32(0), bytes32(0), 48 hours);
```

### Step 4: Execute Upgrade After Timelock Window
```solidity
timelock.execute(vaultProxyAddress, 0, fontData, bytes32(0), bytes32(0));
```
