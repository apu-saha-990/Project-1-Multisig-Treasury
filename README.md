# MultiSig Treasury Wallet

A production-grade multi-signature treasury wallet deployed on Ethereum Sepolia testnet. Demonstrates operational infrastructure capabilities: smart contract governance, real-time monitoring with Prometheus metrics, live USD gas cost reporting, and a MetaMask-connected React interface for multi-party transaction workflows.

**Live Contract:** [`0x60Baaa4E30b48a74c40F2bFA85866C0b48f21aB7`](https://sepolia.etherscan.io/address/0x60Baaa4E30b48a74c40F2bFA85866C0b48f21aB7) — Sepolia testnet, source verified on Etherscan.

---

## Executive Summary

### Problem Statement

Organisations managing shared crypto assets — DAOs, protocol treasuries, startup custody arrangements, multi-founder companies — face a fundamental trust problem: a single private key is a single point of failure. One compromised key, one disgruntled employee, one phishing attack means total loss of funds with no recourse on-chain.

Multi-signature wallets solve this by requiring M-of-N keyholders to approve any transaction before it executes. No single actor can unilaterally move funds. This is the same architecture securing billions in assets through Gnosis Safe and similar systems.

### Target Use Cases

- DAO treasury management requiring governance approval for fund movements
- Startup shared custody where multiple founders must co-sign financial transactions
- Protocol governance where parameter changes require consensus from a signer committee
- Corporate crypto holdings requiring separation of duties between proposal and approval

### Design Constraints

- **Gas efficiency:** Optimizer enabled at 200 runs. Core operations measured at real gas costs with live USD pricing (see Gas Analysis section).
- **Trust model:** All governance is on-chain. No admin keys, no proxy owner, no upgrade mechanism — what is deployed is what runs.
- **Attack surface:** Minimised external dependencies. No oracles, no external calls except user-defined transaction payloads, no token standards to inherit vulnerabilities from.
- **Operational model:** Designed for headless production servers. Monitoring is terminal-based and Prometheus-compatible, not dashboard-dependent.

---

## Architecture

### System Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                      MultiSig Treasury System                       │
│                                                                     │
│  ┌─────────────────┐  ┌──────────────────┐  ┌──────────────────┐   │
│  │  React Frontend  │  │ Monitoring System │  │   CLI Scripts    │   │
│  │  (Vite + ethers) │  │    (Node.js)      │  │ (Hardhat/Node)   │   │
│  │                 │  │                  │  │                  │   │
│  │ • MetaMask conn │  │ • Event listeners │  │ • deploy.js      │   │
│  │ • Submit TX     │  │ • Health checks   │  │ • setup.sh       │   │
│  │ • Confirm TX    │  │ • Prometheus HTTP │  │ • uninstall.sh   │   │
│  │ • Execute TX    │  │   :9090/metrics   │  │                  │   │
│  │ • Pause/Unpause │  │ • Discord alerts  │  │                  │   │
│  │                 │  │ • Structured logs │  │                  │   │
│  └────────┬────────┘  └────────┬─────────┘  └────────┬─────────┘   │
│           │                   │                      │              │
│           └───────────────────┼──────────────────────┘              │
│                               │ JSON-RPC / WebSocket                │
│                    ┌──────────▼──────────┐                          │
│                    │    Alchemy RPC       │                          │
│                    │  (Sepolia Testnet)   │                          │
│                    │                     │                          │
│                    │  • HTTP endpoint     │                          │
│                    │  • WebSocket stream  │                          │
│                    └──────────┬──────────┘                          │
│                               │                                     │
│               ┌───────────────▼───────────────┐                     │
│               │      MultiSigWallet.sol        │                     │
│               │  0x60Baaa4E30b48a74c40F2b...   │                     │
│               │                               │                     │
│               │  State:                        │                     │
│               │  • owners[]                    │                     │
│               │  • transactions[]              │                     │
│               │  • isConfirmed mapping         │                     │
│               │  • paused bool                 │                     │
│               └───────────────────────────────┘                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Trust Boundaries and External Dependencies

| Boundary | Dependency | Risk | Mitigation |
|---|---|---|---|
| RPC layer | Alchemy (Sepolia) | Provider outage drops events | Monitor detects loss; swap RPC URL in config |
| Key management | Owner EOA wallets | Key compromise | M-of-N threshold — one key never sufficient |
| Frontend | MetaMask | Extension compromise | All security in contract; frontend cannot bypass on-chain rules |
| Contract | Solidity 0.8.28 | Compiler bug | Pinned version; optimizer at standard 200 runs |

### Core Data Structure Rationale

```solidity
// Nested mapping: txIndex → owner address → confirmed bool
mapping(uint => mapping(address => bool)) public isConfirmed;
```

This provides O(1) lookup for "has this owner confirmed this transaction" — the most frequent read operation. The alternative (iterating a confirmers array) would be O(n) per check and vulnerable to gas exhaustion as the owner count grows. The nested mapping also makes double-voting prevention trivial: `require(!isConfirmed[_txIndex][msg.sender])`.

---

## Transaction Lifecycle

```
SUBMIT → CONFIRM (×M) → EXECUTE

Owner A                  Owner B                  Blockchain
   │                        │                        │
   │ submitTransaction()     │                        │
   │ (to, value, data)       │                        │
   │────────────────────────────────────────────────►│
   │                        │               [TX stored at index N]
   │                        │               [TransactionSubmitted event]
   │                        │                        │
   │ confirmTransaction(N)  │                        │
   │────────────────────────────────────────────────►│
   │                        │               [confirmations = 1]
   │                        │               [TransactionConfirmed event]
   │                        │                        │
   │                   confirmTransaction(N)          │
   │                        │───────────────────────►│
   │                        │               [confirmations = 2]
   │                        │               [threshold met: READY]
   │                        │                        │
   │ executeTransaction(N)  │                        │
   │────────────────────────────────────────────────►│
   │                        │               [external .call() executes]
   │                        │               [executed = true]
   │                        │               [TransactionExecuted event]

GOVERNANCE FLOW (add/remove owner, change threshold, pause/unpause):

   submitTransaction(
     to: contract_address,        ← self-call
     value: 0,
     data: abi.encodeWithSignature("addOwner(address)", newOwner)
   )
   → Same confirm/execute flow
   → Contract calls itself → addOwner() runs with full governance protection
```

---

## Transaction State Machine

Every transaction in the contract moves through exactly three states. Understanding this model is how you reason about what operations are valid at any point in time.

```
                    submitTransaction()
                           │
                           ▼
                    ┌─────────────┐
                    │   PENDING   │ ← confirmations < threshold
                    └─────────────┘
                     │          │
        confirmTransaction()   revokeConfirmation()
                     │          │
                     ▼          │
              ┌────────────────────┐
              │    EXECUTABLE      │ ← confirmations >= threshold
              └────────────────────┘
                        │
               executeTransaction()
                        │
                        ▼
                 ┌────────────┐
                 │  EXECUTED  │ ← executed = true, terminal state
                 └────────────┘
```

**Valid transitions:**

| From | To | Trigger | Condition |
|---|---|---|---|
| PENDING | PENDING | `confirmTransaction` | Confirmations still below threshold |
| PENDING | EXECUTABLE | `confirmTransaction` | Confirmations reach threshold |
| EXECUTABLE | PENDING | `revokeConfirmation` | Owner withdraws vote, drops below threshold |
| EXECUTABLE | EXECUTED | `executeTransaction` | Any owner calls execute |
| EXECUTED | — | — | Terminal. No further transitions possible |

EXECUTED is a one-way door. Once `transaction.executed = true` is set, no function in the contract can change it back. This is what prevents replay attacks — the same transaction index can never be executed twice.

EXECUTABLE is not a locked state. A confirmation can be revoked after threshold is reached, dropping the transaction back to PENDING. This is intentional — owners should be able to change their mind before execution happens.

---

## Contract Invariants

These are guarantees the contract maintains at all times, regardless of what operations are called or in what order. If any of these are ever violated, the contract has a bug.

```
INVARIANT 1: Threshold never exceeds owner count
  numConfirmationsRequired <= owners.length
  
  Enforced at: deployment (constructor), removeOwner(), changeRequirement()
  Why it matters: If threshold > owners, execution becomes permanently impossible.
                  No combination of valid approvals could ever reach the threshold.

INVARIANT 2: Executed transactions cannot be re-executed
  transaction.executed == true  ⟹  executeTransaction() will always revert
  
  Enforced by: require(!transaction.executed) check
  Why it matters: Prevents replay attacks. An attacker cannot re-execute a 
                  completed ETH transfer to drain funds a second time.

INVARIANT 3: Owner registry is consistent
  isOwner[addr] == true  ⟺  addr exists in owners[] array
  
  Enforced by: addOwner() adds to both, removeOwner() removes from both
  Why it matters: The mapping is used for O(1) access control checks.
                  The array is used for enumeration (e.g., getOwners()).
                  If they diverge, an address could pass isOwner checks 
                  but not appear in the owner list — or vice versa.

INVARIANT 4: Confirmation count never exceeds owner count
  transaction.numConfirmations <= owners.length
  
  Enforced by: isConfirmed mapping prevents double-voting
  Why it matters: A confirmation count higher than the number of owners
                  would be mathematically impossible and signals corrupted state.

INVARIANT 5: No zero address owner
  address(0) cannot be in owners[]
  
  Enforced by: constructor and addOwner() reject address(0)
  Why it matters: The zero address has no private key. No one controls it.
                  If it were an owner, it could never contribute a confirmation,
                  effectively reducing the real threshold by 1 silently.
```

These invariants are what an auditor checks first. For each one, they ask: "Is there any code path that could violate this?" If yes — that's a finding.

---

## Gas & Performance Analysis

Gas measured with Solidity optimizer enabled, 200 runs, Solc 0.8.28. Block gas limit: 60,000,000. USD costs calculated live via CoinMarketCap API at time of test execution.

### Function Gas Costs (Real Measurements)

| Function | Min Gas | Max Gas | Avg Gas | USD (avg) | Notes |
|---|---|---|---|---|---|
| `submitTransaction` | 101,411 | 146,978 | 120,885 | ~$0.01 | Range driven by calldata size |
| `confirmTransaction` | 57,478 | 74,590 | 67,326 | ~$0.01 | Higher on threshold-crossing confirm |
| `executeTransaction` | 72,056 | 116,885 | 88,569 | ~$0.01 | Max includes governance self-calls |
| `revokeConfirmation` | 32,308 | 32,308 | 32,308 | <$0.01 | Consistent — only clears a mapping slot |
| Contract deployment | — | — | 1,604,588 | ~$0.17 | 2.7% of block gas limit |

USD values are live at test execution time — gas reporter v2 fetches real ETH price via CoinMarketCap API and real gas price via Etherscan V2 API on every test run.

### Worst-Case Scenario Analysis

`executeTransaction` max of 116,885 gas occurs when executing governance self-calls (add/remove owner, change threshold). These involve an additional internal call from the contract to itself, adding ~30,000 gas over a plain ETH transfer execution. At 10 owners with maximum calldata, a governance transaction approaches ~150,000 gas — well within safe block inclusion parameters.

### Scalability: Owner Count Impact

| Owners | Deploy Gas | Confirm (avg) | Notes |
|---|---|---|---|
| 3 | ~1,604,588 | ~67,326 | Current configuration |
| 5 | ~1,650,000 | ~67,326 | Confirm cost unchanged — O(1) mapping lookup |
| 10 | ~1,720,000 | ~67,326 | Deploy scales linearly; confirm stays constant |
| 20 | ~1,840,000 | ~67,326 | Confirmation gas is owner-count independent |

Confirmation cost does not scale with owner count because the contract uses a mapping lookup rather than array iteration. A naive implementation using `address[] confirmers` would scale O(n) per confirmation — an intentional design decision to avoid this.

---

## Failure Mode Analysis

### RPC Outage

**Scenario:** Alchemy experiences an outage during active monitoring.

**Detection:** Health check loop runs every 5 minutes. On failed RPC call, the monitor logs `[ERROR]` and sets `multisig_health_check_status` metric to 0. Prometheus alerting pages on this metric dropping below 1.

**Impact:** Events during the outage window are missed by the monitor. The contract itself is unaffected — it continues operating on-chain. Transaction history is permanently on-chain and recoverable by querying historical logs.

**Recovery:** Reconnect monitor to RPC. Query historical events from last known block to catch up.

**Production mitigation:** Run own Ethereum node. Eliminate third-party RPC dependency entirely.

### Contract Revert Scenarios

| Revert Condition | Error | Recovery |
|---|---|---|
| Non-owner calls privileged function | "Not owner" | Expected behaviour |
| Confirm already-confirmed TX | "Tx already confirmed" | No action needed |
| Execute without threshold | "Cannot execute tx" | Wait for remaining confirmations |
| Execute already-executed TX | "Tx already executed" | No action needed |
| Add duplicate owner | "Owner already exists" | Submit corrected governance TX |
| Remove owner below threshold | "Cannot remove owner" | Change threshold first, then remove |

---

## Security Threat Model

### Key Compromise

**Scenario:** One owner's private key is stolen.

**Impact:** Attacker can submit and confirm transactions but cannot execute alone — M-of-N threshold requires consensus. With 2-of-3, one compromised key is insufficient for unilateral action.

**Mitigation limit:** If M keys are compromised simultaneously (both keys in a 2-of-3 setup), the attacker has full control. No on-chain recovery from majority key compromise exists — this is a fundamental property of M-of-N systems. Keys must be stored in hardware wallets with no two keys on the same device.

### Reentrancy Analysis

The contract follows the checks-effects-interactions pattern throughout `executeTransaction`:

```solidity
// 1. CHECKS
require(isOwner[msg.sender], "not owner");
require(!transaction.executed, "tx already executed");
require(transaction.numConfirmations >= numConfirmationsRequired, "cannot execute tx");

// 2. EFFECTS — state change BEFORE external call
transaction.executed = true;

// 3. INTERACTIONS — external call last
(bool success,) = transaction.to.call{value: transaction.value}(transaction.data);
```

By marking `executed = true` before the external call, any reentrancy attempt hits `require(!transaction.executed)` and reverts.

---

## Monitoring & Observability

### Prometheus HTTP Endpoint

The monitoring system exposes a live Prometheus metrics endpoint:

```bash
# Metrics endpoint
curl http://localhost:9090/metrics

# Health check endpoint  
curl http://localhost:9090/health
```

**Sample output:**
```
# HELP multisig_transactions_total Total number of transactions submitted
# TYPE multisig_transactions_total counter
multisig_transactions_total 4

# HELP multisig_confirmations_total Total number of confirmations
# TYPE multisig_confirmations_total counter
multisig_confirmations_total 8

# HELP multisig_executions_total Total number of executions
# TYPE multisig_executions_total counter
multisig_executions_total 2

# HELP multisig_uptime_seconds Monitor uptime in seconds
# TYPE multisig_uptime_seconds gauge
multisig_uptime_seconds 3720 # 1h 2m 0s
```

In production this endpoint is scraped by Prometheus every 30 seconds and visualised in Grafana dashboards. The uptime metric resets on monitor restart — an unexpected reset triggers a pager alert to the on-call engineer.

### Prometheus Metrics Reference

| Metric | Type | Description | Alert Threshold |
|---|---|---|---|
| `multisig_transactions_total` | Counter | Cumulative transactions submitted | Spike > 10/hour |
| `multisig_confirmations_total` | Counter | Total confirmations recorded | — |
| `multisig_executions_total` | Counter | Total executions completed | — |
| `multisig_uptime_seconds` | Gauge | Monitor uptime in seconds | Unexpected reset |

### Alert Configuration

Discord webhook alerts fire on:
- Any `SubmitTransaction` event (WARNING level)
- Any `OwnerAdded`, `OwnerRemoved`, or `RequirementChanged` event (CRITICAL level)
- Any transaction exceeding the large transaction threshold (CRITICAL level)

Webhook URL is stored in `.env` — never hardcoded in config files.

### Log Structure

```
[2026-02-25T13:15:17.157Z] [SUCCESS] Monitor is now running...
[2026-02-25T13:15:17.157Z] [SUCCESS] Prometheus metrics available at http://localhost:9090/metrics
[2026-02-25T13:15:22.346Z] [WARN]    New transaction submitted {"owner":"0xDA04...","txIndex":"0"}
[2026-02-25T13:15:38.062Z] [INFO]    Transaction confirmed {"owner":"0xDA04...","txIndex":"0"}
[2026-02-25T13:15:44.812Z] [SUCCESS] Alert sent to Discord
[2026-02-25T13:16:00.235Z] [INFO]    Health check passed {"transactions":"1","uptime":"0h 0m 43s"}
```

---

## Testing Strategy

### Coverage: 25 Tests

| Category | Tests | What They Verify |
|---|---|---|
| Deployment validation | 4 | Constructor rejects invalid configs (zero owners, bad threshold, duplicates) |
| Deposits | 2 | ETH receipt and Deposit event emission |
| Submit transaction | 2 | Owner can submit; non-owner rejected |
| Confirm transaction | 3 | Confirm, double-confirm rejected, non-owner rejected |
| Execute transaction | 3 | Execute at threshold, reject below threshold, reject re-execution |
| Revoke confirmation | 2 | Revoke works; can't revoke unconfirmed |
| Owner management | 7 | Add/remove owner via governance; all invalid cases rejected |
| Change requirement | 3 | Valid change via governance; zero and above-count rejected |

### Gas Regression

`hardhat-gas-reporter` v2 runs with every test suite execution showing live USD costs:

```
Network: ETHEREUM  ·  0.05877 gwei  ·  1822.96 usd/eth

| Contract        | Method              | Avg Gas   | usd (avg) |
|-----------------|---------------------|-----------|-----------|
| MultiSigWallet  | confirmTransaction  | 67,326    | $0.01     |
| MultiSigWallet  | executeTransaction  | 88,569    | $0.01     |
| MultiSigWallet  | submitTransaction   | 120,885   | $0.01     |
| MultiSigWallet  | (deployment)        | 1,604,588 | $0.17     |
```

---

## Deployment & Operations

### Quick Start — Interactive Setup

```bash
# Clone repo
git clone https://github.com/artcelltarafder-pixel/Project01-multisg-treasury.git
cd Project01-multisg-treasury

# Run interactive setup (handles everything)
bash scripts/setup.sh
```

The setup script handles: dependency installation, .env configuration, compilation, 25-test verification (hard gate — deployment blocked if any fail), Sepolia deployment, Etherscan verification, contract address propagation, and COMMANDS.md generation.

### Clean Uninstall

```bash
bash scripts/uninstall.sh
```

Removes all installed dependencies, generated files, and resets the project to a clean state. Safe to re-run setup after.

### Manual Start Commands

```bash
# Start monitoring system
npx hardhat run scripts/startMonitor.js --network sepolia

# Start frontend
cd frontend && npm start
# Open http://localhost:3000

# Check Prometheus metrics
curl http://localhost:9090/metrics

# Check health
curl http://localhost:9090/health
```

### Environment Configuration

```bash
PRIVATE_KEY=                      # Deployer private key — never commit
SEPOLIA_RPC_URL=                  # Alchemy or Infura endpoint
ETHERSCAN_API_KEY=                # For contract verification
COINMARKETCAP_API_KEY=            # For live USD gas pricing in tests
DISCORD_WEBHOOK_URL=              # For transaction alerts
OWNER_1=0x...
OWNER_2=0x...
OWNER_3=0x...
REQUIRED_CONFIRMATIONS=2
```

`.env` excluded from version control via `.gitignore`. All sensitive values remain local — never committed.

### Secure Key Handling Policy

Private keys exist only in `.env` on the development machine. Never committed, never logged, never transmitted. For production: keys must be in hardware wallets. The deployment script is the only context where a software key is acceptable — and only on testnet.

---

## Post-Mortem: Emergency Pause Lockout

**Date:** February 2026 (Sepolia testnet)
**Severity:** Critical (would have been funds-at-risk on mainnet)
**Status:** Resolved — contract redeployed with fix

### Summary

The emergency pause feature was deployed to Sepolia. During functional testing, pausing the contract made it impossible to execute the unpause transaction — creating a permanent lockout with no recovery path.

### Root Cause

`whenNotPaused` was applied at the `executeTransaction` function level:

```solidity
// BROKEN — blocks ALL execution including governance unpause
function executeTransaction(uint _txIndex)
    public
    onlyOwner
    txExists(_txIndex)
    notExecuted(_txIndex)
    whenNotPaused    // ← blocked unpause governance tx from executing
{
    (bool success,) = transaction.to.call{value: transaction.value}(transaction.data);
}
```

### Fix

```solidity
// FIXED — governance always works; only external fund movement is gated
function executeTransaction(uint _txIndex)
    public
    onlyOwner
    txExists(_txIndex)
    notExecuted(_txIndex)
{
    require(!paused || transaction.to == address(this), "Contract is paused");
    (bool success,) = transaction.to.call{value: transaction.value}(transaction.data);
}
```

### Lesson

Modifiers apply at function entry, not at a specific line. When adding cross-cutting concerns to a complex function, map exactly which operations should be gated — apply the check there, not at the function boundary. Test failure modes explicitly, not just success paths.

---

## Why Not Gnosis Safe?

Gnosis Safe is the correct answer for any production treasury holding real assets. This project is not a Safe replacement — it is an architectural implementation built to demonstrate understanding of how multi-signature systems work at the contract level. Using Safe for a portfolio project demonstrates the ability to configure an existing tool. Building from scratch demonstrates understanding of what that tool is actually doing.

For any real treasury: use Safe. For understanding what Safe is doing under the hood: this codebase.

---

## Project Structure

```
01-multisig-treasury/
├── contracts/
│   └── MultiSigWallet.sol          # Core contract
├── scripts/
│   ├── deploy.js                   # Deployment script
│   ├── setup.sh                    # Interactive installer
│   ├── uninstall.sh                # Clean uninstall
│   └── startMonitor.js             # Production monitoring
├── test/
│   ├── MultiSigWallet.test.js      # Core 25-test suite
│   └── OwnerManagement.test.js     # Owner management tests
├── monitoring/
│   ├── monitor.js                  # Event listener + health checks
│   ├── metrics.js                  # Prometheus HTTP endpoint (:9090)
│   └── alerts.js                   # Discord webhook alerts
├── frontend/
│   └── src/
│       └── App.js                  # React + MetaMask interface
├── config/
│   └── monitor.config.json         # Monitoring configuration
├── hardhat.config.js               # Gas reporter + network config
└── .env.example                    # Environment variable template
```

## Tech Stack

| Layer | Technology |
|---|---|
| Smart Contract | Solidity 0.8.28, Hardhat |
| Blockchain Interaction | Ethers.js v6 |
| Testnet RPC | Alchemy (Sepolia) — WebSocket + HTTP |
| Monitoring | Node.js, Prometheus HTTP server, structured JSON logging |
| Alerting | Discord webhooks, configurable thresholds |
| Gas Reporting | hardhat-gas-reporter v2, CoinMarketCap API, Etherscan V2 API |
| Frontend | React, MetaMask EIP-1193, ethers.js |
| Testing | Hardhat, Chai, 25 tests |
| CI/CD | GitHub Actions — compile on every push |

## Deployment History

| Version | Address | Change |
|---|---|---|
| v1 | `0xFbe6d25980243922d94a774255217be1c62a3D1D` | Initial deployment |
| v2 | `0xdc8d6F7aF51120af2D6c5de861dfdC187eFE70a2` | Dynamic owner governance |
| v3 | `0xeD092f9AaC91F5E491264187Fb539153B31F9D26` | Pause mechanism design flaw fixed |
| v4 | `0x60Baaa4E30b48a74c40F2bFA85866C0b48f21aB7` | Prometheus endpoint, live USD gas, Discord env var |

---

## Roadmap

**Near-term:**
- Timelock on execution (configurable delay, set via governance)
- Transaction cancellation by owner consensus
- Block-range backfill on monitor reconnection
- Grafana dashboard for Prometheus metrics
- Auto-restart on monitor crash (PM2 or systemd process manager)
- Historical transaction backfill on monitor reconnection
- Persistent event storage so history survives restarts

**Infrastructure evolution:**
- Self-operated Geth/Erigon node to eliminate RPC dependency
- Kubernetes deployment for monitoring system

**Network migration:**
- L2 deployment (Arbitrum or Base) for 10-100x gas cost reduction

---

## License

MIT
