# MultiSig Treasury Wallet

A production-grade multi-signature treasury wallet deployed on Ethereum Sepolia testnet. Demonstrates operational infrastructure capabilities: smart contract governance, real-time monitoring with Prometheus metrics, and a MetaMask-connected React interface for multi-party transaction workflows.

**Live Contract:** [`0xdc8d6F7aF51120af2D6c5de861dfdC187eFE70a2`](https://sepolia.etherscan.io/address/0xdc8d6F7aF51120af2D6c5de861dfdC187eFE70a2) — Sepolia testnet, source verified on Etherscan.

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

- **Gas efficiency:** Optimizer enabled at 200 runs. Core operations measured at real gas costs (see Gas Analysis section).
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
│  │ • Submit TX     │  │ • Health checks   │  │ • submitTx.js    │   │
│  │ • Confirm TX    │  │ • Prometheus      │  │ • confirmTx.js   │   │
│  │ • Execute TX    │  │   /metrics        │  │ • executeTx.js   │   │
│  │ • Pause/Unpause │  │ • Structured logs │  │                  │   │
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
│               │  0xdc8d6F7aF51120af2D6c5de...  │                     │
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

**What this means in practice:**

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

Gas measured with Solidity optimizer enabled, 200 runs, Solc 0.8.28. Block gas limit: 60,000,000.

### Function Gas Costs (Real Measurements)

| Function | Min Gas | Max Gas | Avg Gas | Notes |
|---|---|---|---|---|
| `submitTransaction` | 101,411 | 146,978 | 120,885 | Range driven by calldata size |
| `confirmTransaction` | 57,478 | 74,590 | 67,326 | Higher on threshold-crossing confirm |
| `executeTransaction` | 72,056 | 116,885 | 88,569 | Max includes governance self-calls |
| `revokeConfirmation` | 32,308 | 32,308 | 32,308 | Consistent — only clears a mapping slot |
| Contract deployment | — | — | 1,604,588 | 2.7% of block gas limit |

### Gas Cost in USD Context

At 20 gwei gas price and ETH at $3,000 USD:

| Operation | Gas | Cost (USD) |
|---|---|---|
| Submit transaction | ~121,000 | ~$0.007 |
| Confirm transaction | ~67,000 | ~$0.004 |
| Execute transaction | ~89,000 | ~$0.005 |
| Full 2-of-3 lifecycle | ~277,000 | ~$0.016 |
| Deploy contract | ~1,605,000 | ~$0.096 |

For treasury operations where transactions are measured in thousands of dollars, these costs are negligible.

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

### Storage Growth Over Time

Each transaction stored in the `transactions` array adds approximately 5 storage slots. At 100 transactions per month, annual storage growth is ~6,000 slots. Not a concern at the scale this system targets.

---

## Failure Mode Analysis

### RPC Outage

**Scenario:** Alchemy experiences an outage during active monitoring.

**Detection:** Health check loop runs every 10 seconds. On failed RPC call, the monitor logs `[ERROR]` and sets `multisig_health_check_status` metric to 0. Prometheus alerting pages on this metric dropping below 1.

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

### Partial Confirmations and Stuck Transactions

If a transaction reaches some but not all required confirmations and sits indefinitely — for example, if an owner becomes unavailable — it is stuck pending. There is no timeout or expiry mechanism in the current implementation.

**Current limitation:** Stuck transactions cannot be cancelled. They remain permanently pending unless confirmations are eventually reached.

**Production mitigation:** A `cancelTransaction` function gated by owner consensus, or a timelock expiry — listed in the roadmap.

---

## Security Threat Model

### Key Compromise

**Scenario:** One owner's private key is stolen.

**Impact:** Attacker can submit and confirm transactions but cannot execute alone — M-of-N threshold requires consensus. With 2-of-3, one compromised key is insufficient for unilateral action.

**Mitigation limit:** If M keys are compromised simultaneously (both keys in a 2-of-3 setup), the attacker has full control. No on-chain recovery from majority key compromise exists — this is a fundamental property of M-of-N systems. Keys must be stored in hardware wallets with no two keys on the same device.

### Collusion Risk

**Scenario:** M owners collude to drain the treasury against the wishes of remaining owners.

**Current mitigation:** All transactions are transparent on-chain before execution. A vigilant third owner can detect a suspicious proposal and attempt off-chain intervention.

**Production mitigation:** Timelocks between approval and execution provide a response window. Listed in roadmap.

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

By marking `executed = true` before the external call, any reentrancy attempt hits `require(!transaction.executed)` and reverts. The contract is not vulnerable to reentrancy on the execution path.

### EVM-Level Design Decisions

**Why `.call` instead of `.transfer` or `.send`?**

Solidity has three ways to send ETH:

```solidity
recipient.transfer(amount)   // forwards 2300 gas, reverts on failure
recipient.send(amount)       // forwards 2300 gas, returns bool
recipient.call{value: amount}("")  // forwards all remaining gas, returns bool
```

`.transfer` and `.send` only forward 2300 gas to the recipient. This was considered "safe" against reentrancy because 2300 gas is barely enough to log an event — not enough to call back into the contract. But it breaks any recipient contract that needs more than 2300 gas to handle incoming ETH (for example, a Gnosis Safe or any contract with a non-trivial `receive()` function).

After EIP-1884 in 2019, the gas cost of certain opcodes increased. Contracts that previously worked fine with `.transfer` started failing. The Ethereum community now recommends `.call` universally, with reentrancy handled explicitly through the checks-effects-interactions pattern — which this contract implements.

**What if `.call` returns false but doesn't revert?**

`.call` returns a success boolean. A failed call does not automatically revert the transaction — you have to check the return value yourself:

```solidity
(bool success, ) = transaction.to.call{value: transaction.value}(transaction.data);
require(success, "tx failed");
```

If you skip the `require(success)` check, a failed ETH transfer would be silently ignored — the transaction would be marked as executed even though the funds never moved. The contract checks this explicitly. A failed call reverts the entire execution, preserving the `executed = false` state so the transaction can be retried.

**Why not use OpenZeppelin's `ReentrancyGuard`?**

`ReentrancyGuard` adds a mutex — a lock that prevents any function with the `nonReentrant` modifier from being called while it is already executing. It works and is widely used.

This contract handles reentrancy through the checks-effects-interactions pattern instead, which is more gas-efficient (no additional storage read/write for the lock) and more instructive — the protection comes from the logical ordering of operations rather than a bolt-on modifier. Both approaches are valid. The CEI pattern is the more fundamental understanding.

**Storage packing opportunities:**

The `Transaction` struct currently stores:

```solidity
struct Transaction {
    address to;        // 20 bytes
    uint value;        // 32 bytes
    bytes data;        // dynamic
    bool executed;     // 1 byte
    uint numConfirmations;  // 32 bytes
}
```

`executed` (1 byte) and `to` (20 bytes) could share a single 32-byte storage slot if packed together. However, `uint value` and `uint numConfirmations` each occupy a full slot regardless. The gas saving from packing here is marginal — approximately 200 gas per transaction storage — and was deprioritised in favour of readability. In a high-volume production system processing thousands of transactions, this would be worth revisiting.

### Replay Protection

Each transaction is stored at a unique index. The `executed` flag is set atomically with execution. `require(!transaction.executed)` permanently prevents re-execution at the same index. Cross-chain replay is not applicable — the contract is deployed at a specific address on a specific chain with separate state.

### Denial-of-Service Vectors

**Gas griefing via large calldata:** An owner could submit transactions with large `data` payloads, inflating gas costs. Mitigation: calldata size is bounded by block gas limits. No unbounded loops process calldata.

**Spam confirmations:** A malicious owner could flood the pending queue. Mitigation: only owners can submit transactions, limiting attack surface to trusted participants. Pending transactions with no confirmations do not consume execution gas.

---

## Monitoring & Observability

### Why Metrics Matter in Treasury Systems

A treasury wallet securing real assets requires continuous observability. Silent failures — missed events, degraded RPC connectivity, unexpected state changes — can mean the difference between detecting an attack in progress and discovering it after funds are gone. Logs answer "what happened." Metrics answer "what is the current state and is it normal." Both are required in production.

### Prometheus Metrics

| Metric | Type | Description | Alert Threshold |
|---|---|---|---|
| `multisig_transactions_total` | Counter | Cumulative transactions submitted | Spike > 10/hour |
| `multisig_confirmations_pending` | Gauge | Unconfirmed transaction count | > 5 pending |
| `multisig_contract_balance_eth` | Gauge | ETH held in contract | Unexpected drop > 10% |
| `multisig_owners_count` | Gauge | Registered owner count | Any change |
| `multisig_health_check_status` | Gauge | 1 = healthy, 0 = degraded | < 1 pages immediately |

### Alert Thresholds and Reasoning

`multisig_owners_count` changing is the highest-priority alert. Owner additions or removals are rare governance events — an unexpected change could indicate a governance attack in progress. `multisig_health_check_status` dropping to 0 means the monitoring system has lost visibility entirely and should page immediately.

### Log Structure Philosophy

The monitoring system uses structured JSON logs:

```
[2026-02-05T08:45:19.346Z] [SUCCESS] Health check passed {"owners":3,"transactions":"0","balance":"0.0"}
[2026-02-05T08:45:08.150Z] [SUCCESS] Event listeners active {"contract":"0xdc8d6F7aF51120..."}
[2026-02-05T08:45:08.147Z] [ERROR]   RPC connection lost {"attempt":1,"retryIn":"5000ms"}
```

Structured logs are machine-parseable — ingestible by Loki, Elasticsearch, or CloudWatch without custom parsing rules. ISO timestamps enable precise correlation across distributed systems.

### Event Backfill on Reconnection

The current monitor loses events that occur during an RPC disconnection window. This is a known gap. The production-hardened approach:

```javascript
// On reconnection, store last processed block number
// Query historical logs to catch up on missed events

const lastProcessedBlock = await loadLastProcessedBlock(); // read from disk/db

const missedEvents = await contract.queryFilter(
    contract.filters.TransactionSubmitted(),  // or any event
    lastProcessedBlock + 1,                    // from last known block
    'latest'                                   // to current
);

// Process missed events in order
for (const event of missedEvents) {
    await processEvent(event);
    await saveLastProcessedBlock(event.blockNumber);
}
```

**Idempotent event processing** — events must be processed safely even if received twice (e.g., during a restart overlap). Each event should check: "have I already processed this transaction hash?" before updating state or firing alerts. This prevents duplicate alerts on the same event.

**Why this matters operationally:** A monitoring system that silently misses events during reconnection cannot be trusted for treasury oversight. The backfill implementation is listed in the roadmap as a near-term improvement.

### Incident Detection Workflow

```
Event detected on-chain
        │
        ▼
Monitor logs event with full context
        │
        ▼
Prometheus counter/gauge updated
        │
        ▼
Alertmanager evaluates thresholds
        │
   ┌────┴────┐
Normal     Anomaly
   │            │
   │        Alert fires → PagerDuty / Slack
   │            │
   └────────────┘
        │
        ▼
Engineer reviews logs + Etherscan for full audit trail
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

### Adversarial Scenario Tests

- Attempt to remove an owner that would break the threshold
- Attempt to set threshold to 0
- Attempt to set threshold above owner count
- Attempt to add the zero address as owner
- Attempt to add an existing owner (duplicate)
- Non-owner attempting every privileged function

### Gas Regression Approach

`hardhat-gas-reporter` runs with every test suite execution. Any function whose gas cost increases significantly between commits flags a potential regression — usually an unintentional storage write or added loop. The gas table in this README reflects actual measured values from the current codebase.

---

## Deployment & Operations

### Environment Configuration

```bash
PRIVATE_KEY=                    # Deployer private key — never commit
SEPOLIA_RPC_URL=               # Alchemy or Infura endpoint
ETHERSCAN_API_KEY=             # For contract verification
OWNER_1=0x...
OWNER_2=0x...
OWNER_3=0x...
REQUIRED_CONFIRMATIONS=2
```

`.env` excluded from version control via `.gitignore`. `.env.example` documents required variables without values.

### Secure Key Handling Policy

Private keys exist only in `.env` on the development machine. Never committed, never logged, never transmitted. For production: keys must be in hardware wallets. The deployment script is the only context where a software key is acceptable — and only on testnet.

### Deployment Steps

```bash
npm install
cp .env.example .env          # Configure with your values
npx hardhat compile
npx hardhat test              # All 25 must pass before deploying
npx hardhat run scripts/deploy.js --network sepolia
npx hardhat verify --network sepolia <ADDRESS> "<O1>" "<O2>" "<O3>" <THRESHOLD>
```

### Immutability Reasoning

The contract has no upgrade mechanism. This is intentional. Upgradeable proxy patterns introduce significant complexity and their own attack surfaces — the proxy admin key becomes a superuser that can swap in arbitrary logic. For a treasury wallet where the security guarantee is "no one can act unilaterally," a mutable contract is a contradiction. If a bug is found, deploy a fixed contract and migrate funds through the MultiSig governance flow.

---

## Load & Stress Testing

### High-Transaction Volume

A batch submission script was run submitting 20 transactions in rapid succession, then confirming and executing them sequentially. The event listener processed all 20 `TransactionSubmitted` events without dropping any. Health check interval remained stable. Prometheus metrics updated correctly for all state transitions. No WebSocket disconnections observed.

### Owner Count Stress Testing

Tests run with owner arrays of 3, 5, and 10 addresses. Deployment cost scales linearly (~8,000 gas per additional owner in the constructor). Runtime confirmation cost remains constant at ~67,000 gas regardless of owner count — confirming the O(1) mapping design holds.

### Event Listener Resilience

Tested against intentional RPC interruption (kill and restart). On reconnection, the monitor re-initialises listeners and resumes health checks. Events during the disconnection window are not replayed — a known limitation. Production mitigation: implement block-range backfill on reconnection.

---

## Post-Mortem: Emergency Pause Lockout

**Date:** February 2026 (Sepolia testnet)
**Severity:** Critical (would have been funds-at-risk on mainnet)
**Status:** Resolved — contract redeployed with fix

### Summary

The emergency pause feature was deployed to Sepolia. During functional testing, pausing the contract made it impossible to execute the unpause transaction — creating a permanent lockout with no recovery path.

### Detection

Discovered during manual testing within minutes of deployment. The unpause transaction was submitted and confirmed by 2-of-3 owners but `executeTransaction` reverted. Code review identified the cause immediately.

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

When paused, every call to `executeTransaction` reverted — including the unpause payload. No recovery path existed.

### Impact

0.5 Sepolia ETH locked with no recovery. On mainnet, this would be permanent loss of funds.

### Fix

Moved the pause gate to apply only to the external call, not the execution mechanism:

```solidity
// FIXED — governance always works; only external fund movement is gated
function executeTransaction(uint _txIndex)
    public
    onlyOwner
    txExists(_txIndex)
    notExecuted(_txIndex)
{
    // Self-calls (governance) always permitted; external calls gated by pause
    require(!paused || transaction.to == address(this), "Contract is paused");
    (bool success,) = transaction.to.call{value: transaction.value}(transaction.data);
}
```

Contract redeployed. Pause/unpause flow verified through full test cycle.

### Lesson

Modifiers apply at function entry, not at a specific line. When adding cross-cutting concerns to a complex function, map exactly which operations should be gated — apply the check there, not at the function boundary. Test failure modes explicitly, not just success paths.

---

## Why Not Gnosis Safe?

Gnosis Safe is the correct answer for any production treasury holding real assets. It is professionally audited, battle-tested across billions of dollars, has a mature module system for extensibility, and has been running in production since 2018.

This project is not a Safe replacement. It is an architectural implementation built to demonstrate understanding of how multi-signature systems work at the contract level — the state management, the governance patterns, the security considerations, and the operational infrastructure around them.

Using Safe for a portfolio project would demonstrate the ability to configure an existing tool. Building from scratch demonstrates understanding of what that tool is actually doing. The value here is in the reasoning, the design decisions, the post-mortem, and the surrounding infrastructure — not in claiming the contract is production-ready.

For any real treasury: use Safe. For understanding what Safe is doing under the hood: this codebase.

---

## Tradeoff Transparency

### Intentional Omissions

**No timelock on execution.** Production treasuries add a 24–48 hour delay between reaching threshold and allowing execution. Omitted to keep the demo flow fast and demonstrable. Listed in roadmap.

**No transaction cancellation.** Once proposed, a transaction cannot be withdrawn. Simplifies the state machine but creates stuck transaction risk. Listed in roadmap.

**No EIP-712 off-chain signatures.** Production systems like Gnosis Safe use off-chain signing to reduce gas costs for signers. Requires significantly more complex signature verification — out of scope for this project.

**No formal audit.** Not audited for mainnet use.

### What a Production Audit Would Focus On

- Reentrancy in `executeTransaction` — checks-effects-interactions pattern should satisfy auditors; they would verify formally
- Access control completeness — every privileged function verified to have `onlyOwner`
- The governance self-call mechanism — auditors would verify only the contract itself can call addOwner/removeOwner/changeRequirement
- Pause mechanism correctness — specifically the fix described in the post-mortem
- Integer boundary conditions in threshold arithmetic

---

## Roadmap

**Near-term:**
- Timelock on execution (configurable delay, set via governance)
- Transaction cancellation by owner consensus
- EIP-712 off-chain signature support
- Block-range backfill on monitor reconnection

**Infrastructure evolution:**
- Self-operated Geth/Erigon node to eliminate RPC dependency
- Kubernetes deployment for monitoring system
- Purpose-built Grafana dashboards for treasury observability

**Network migration:**
- L2 deployment (Arbitrum or Base) for 10-100x gas cost reduction
- Architecture is chain-agnostic; requires redeployment and RPC config update

---

## Project Structure

```
01-multisig-treasury/
├── contracts/
│   └── MultiSigWallet.sol        # Core contract
├── scripts/
│   ├── deploy.js
│   ├── startMonitor.js           # Production monitoring
│   ├── submitTransaction.js
│   ├── confirmTransaction.js
│   └── executeTransaction.js
├── test/
│   └── MultiSigWallet.test.js    # 25 tests
├── monitoring/
│   └── metrics.js                # Prometheus export
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   └── utils/contractUtils.js
│   └── public/
├── hardhat.config.js
└── .env.example
```

## Tech Stack

| Layer | Technology |
|---|---|
| Smart Contract | Solidity 0.8.28, Hardhat |
| Blockchain Interaction | Ethers.js v6 |
| Testnet RPC | Alchemy (Sepolia) — WebSocket + HTTP |
| Monitoring | Node.js, Prometheus, structured JSON logging |
| Frontend | React (Vite), MetaMask EIP-1193, ethers.js |
| Testing | Hardhat, Chai, hardhat-gas-reporter |

## Deployment History

| Version | Address | Change |
|---|---|---|
| v1 | `0xFbe6d25980243922d94a774255217be1c62a3D1D` | Initial deployment |
| v2 | `0xdc8d6F7aF51120af2D6c5de861dfdC187eFE70a2` | Dynamic owner governance |
| v3 | *(current)* | Pause mechanism design flaw fixed |

---

## License

MIT
