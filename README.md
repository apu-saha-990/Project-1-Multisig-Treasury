# MultiSig Treasury Wallet

A multi-signature treasury wallet built on Ethereum Sepolia testnet.

**Live Contract:** [`0x60Baaa4E30b48a74c40F2bFA85866C0b48f21aB7`](https://sepolia.etherscan.io/address/0x60Baaa4E30b48a74c40F2bFA85866C0b48f21aB7) — verified on Etherscan.

---

## What It Does

A smart contract wallet that requires multiple signatures before any transaction executes. M-of-N owners must approve before funds move — no single person can act alone.

- Configurable signature threshold (e.g. 2-of-3)
- Any owner can propose a transaction
- Required number of owners must approve before execution
- Owner management (add/remove) goes through the same approval process
- Emergency pause — blocks fund movement while governance still works
- Real-time monitoring with Prometheus metrics and Discord alerts

The frontend lets owners connect with MetaMask, submit transactions, confirm them, and execute once the threshold is met.

Same architecture used by Gnosis Safe and real DAO treasuries — built from scratch to understand how it works under the hood, not just how to use it.

---

## Why This Project Matters

Multi-signature wallets remove single-key risk. If one private key is lost, hacked, or compromised, the attacker still cannot move funds without the required number of approvals. This is why DAOs, startups, and protocols use multi-sig for treasury operations, shared custody, and governance. Building this from scratch helped me understand how these systems actually work under the hood.

---

## How I Built This

I'm a career changer coming from a factory background — no CS degree, no bootcamp. I use AI (Claude) throughout my work as a learning tool, code reviewer, and debugging partner. Every terminal error went back to Claude. Every concept I didn't understand, I worked through with it.

What I own: the decisions. What to build, how it's structured, when something broke and why. The Post-Mortem below is a real example of that process.

The system is fully test-covered and demo-ready.

---

## What I Learned

- How multi-sig works at the contract level — not just how to configure one
- Solidity access control and why modifiers apply at function entry (learned this the hard way — see Post-Mortem)
- Writing tests that cover edge cases, not just the happy path
- Hardhat, testnet deployment, and Etherscan verification
- Prometheus metrics and Discord alerting from a Node.js monitoring system
- GitHub Actions CI — tests run automatically on every push
- Reading terminal errors and working through them systematically

---

## Post-Mortem: The Pause Lockout Bug

I deployed an emergency pause feature. During testing, pausing the contract made it impossible to execute the unpause transaction — permanent lockout, no recovery path.

**Root cause:** `whenNotPaused` was applied at the `executeTransaction` level, blocking all execution — including the governance call to unpause.

```solidity
// BROKEN — governance can't run while paused
function executeTransaction(uint _txIndex) public onlyOwner whenNotPaused {
    (bool success,) = transaction.to.call{value: transaction.value}(transaction.data);
}
```

**Fix:** Gate only external fund movement — governance self-calls always work.

```solidity
// FIXED
function executeTransaction(uint _txIndex) public onlyOwner {
    require(!paused || transaction.to == address(this), "Contract is paused");
    (bool success,) = transaction.to.call{value: transaction.value}(transaction.data);
}
```

**Lesson:** Modifiers apply at function entry, not at a specific line. Test failure modes explicitly. Contract redeployed as v4 with this fix.

---

## Running It

```bash
# Install and deploy
bash scripts/setup.sh
```

Handles everything: dependencies, compilation, 25-test verification, Sepolia deployment, Etherscan verification. Deployment is blocked if any test fails.

```bash
# Start monitoring
npx hardhat run scripts/startMonitor.js --network sepolia

# Start frontend
cd frontend && npm start
# Open http://localhost:3000

# Check Prometheus metrics
curl http://localhost:9090/metrics
```

---

## Environment Setup

```bash
PRIVATE_KEY=                   # Deployer private key — never commit
SEPOLIA_RPC_URL=               # Alchemy endpoint
ETHERSCAN_API_KEY=             # Contract verification
COINMARKETCAP_API_KEY=         # Live USD gas pricing
DISCORD_WEBHOOK_URL=           # Transaction alerts
OWNER_1=0x...
OWNER_2=0x...
OWNER_3=0x...
REQUIRED_CONFIRMATIONS=2
```

Copy `.env.example` to `.env`. Never commit your `.env`.

---

## Deployment History

| Version | Address | What Changed |
|---|---|---|
| v1 | `0xFbe6d25980243922d94a774255217be1c62a3D1D` | Initial deployment |
| v2 | `0xdc8d6F7aF51120af2D6c5de861dfdC187eFE70a2` | Dynamic owner governance |
| v3 | `0xeD092f9AaC91F5E491264187Fb539153B31F9D26` | Pause mechanism (broke — see Post-Mortem) |
| v4 | `0x60Baaa4E30b48a74c40F2bFA85866C0b48f21aB7` | Pause fixed, Prometheus, live USD gas, Discord |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Smart Contract | Solidity 0.8.28, Hardhat |
| Blockchain SDK | Ethers.js v6 |
| Testnet RPC | Alchemy (Sepolia) |
| Monitoring | Node.js, Prometheus, structured JSON logging |
| Alerting | Discord webhooks |
| Gas Reporting | hardhat-gas-reporter, CoinMarketCap API |
| Frontend | React, MetaMask, Ethers.js |
| Testing | Hardhat, Chai — 25 tests |
| CI/CD | GitHub Actions |

---

## Project Structure

```
01-multisig-treasury/
├── contracts/
│   └── MultiSigWallet.sol
├── scripts/
│   ├── deploy.js
│   ├── setup.sh
│   ├── uninstall.sh
│   └── startMonitor.js
├── test/
│   ├── MultiSigWallet.test.js
│   └── OwnerManagement.test.js
├── monitoring/
│   ├── monitor.js
│   ├── metrics.js
│   └── alerts.js
├── frontend/
│   └── src/App.js
└── hardhat.config.js
```

---

## Roadmap

- Timelock on execution — configurable delay before a transaction can run
- Transaction cancellation by owner consensus
- Grafana dashboard for Prometheus metrics
- Auto-restart on monitor crash (PM2 or systemd)
- Persistent event storage so history survives restarts
- L2 deployment (Arbitrum or Base) for lower gas costs

---

## Why Not Just Use Gnosis Safe?

For a real treasury — use Safe. This project exists to understand what Safe is doing at the contract level. Using an existing tool is one skill. Building the same thing from scratch is a different one.

---

*Career changer from manufacturing. Learning in public. Building real things.*
