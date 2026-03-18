# MultiSig Treasury Wallet

A shared wallet where multiple people must agree before any money moves.

**Live:** [View on Etherscan](https://sepolia.etherscan.io/address/0x60Baaa4E30b48a74c40F2bFA85866C0b48f21aB7)

---

## What Problem Does This Solve

If one person controls a wallet and their password gets stolen — the money is gone. There is no recovery path. No way to stop it.

This project solves that. It requires two out of three people to approve any transaction before a single penny moves. Even if one person's account is fully compromised, the attacker still cannot do anything alone. They need a second approval. That second approval is never coming.

This is the same approach used by major organisations to protect shared funds worth billions of dollars. I built it from scratch to understand exactly how it works.

---

## How It Works

1. One of the wallet owners proposes a transaction — who to pay and how much
2. The other owners are notified and review the proposal
3. Each owner votes to approve or reject it
4. Once enough approvals are collected, anyone can trigger the payment
5. If the required number of approvals is never reached, the money never moves

No single person can act alone. The rules are enforced automatically — there is no admin who can override them.

---

## What's Built

**The wallet itself** — the core rules that live on the network and enforce the approval process. Once deployed, nobody can change how it works without going through the same approval process.

**A web interface** — owners connect their personal wallet, see all pending transactions, approve or reject them, and trigger payments once enough approvals are collected.

**A monitoring system** — watches the wallet around the clock and sends an alert to Discord the moment a large transaction is proposed or ownership changes hands.

**A live activity tracker** — keeps a running count of every transaction, approval, and execution. Plugs into standard industry monitoring tools without any extra setup.

**Automated tests** — 25 tests that verify every feature works correctly before anything gets deployed. If any test fails, deployment is blocked.

**Automatic code checks** — every time code is pushed to GitHub, all tests run automatically. Broken code is caught immediately before it can cause problems.

---

## Why I Built This From Scratch

A tool already exists that does this. I could have used it in an afternoon.

But using an existing tool shows you know how to configure it. Building it from scratch shows you understand what it is actually doing — the rules it enforces, the decisions it makes, and the ways it can fail. That is a different skill entirely. That is what this build is about.

---

## A Bug I Found

I added an emergency pause feature — a way to freeze the wallet completely if something suspicious was happening. I deployed it to the test network and ran through my tests. Pausing worked perfectly.

Then I tried to unpause it. The transaction failed. I ran it again. Failed again. I had locked myself out of my own wallet with no way back in.

On a real deployment with real money, that would have been permanent. Everything frozen. No recovery.

The problem turned out to be one line of logic. The pause was blocking everything — including the transaction that was supposed to turn it off. The rule I wrote to protect the wallet was protecting it from me.

Here is what the broken version looked like:

```solidity
// BROKEN — the pause blocks everything, including the unpause itself
function executeTransaction(uint _txIndex) public onlyOwner whenNotPaused {
    (bool success,) = transaction.to.call{value: transaction.value}(transaction.data);
}
```

The fix was to only block payments going out. Internal instructions — like unpausing — always go through:

```solidity
// FIXED — payments are blocked when paused, but internal instructions always work
function executeTransaction(uint _txIndex) public onlyOwner {
    require(!paused || transaction.to == address(this), "Contract is paused");
    (bool success,) = transaction.to.call{value: transaction.value}(transaction.data);
}
```

The lesson: test what happens when things go wrong, not just when they go right. The wallet was redeployed with the fix. That version is live today.

---

## How I Built This

I came from a factory background. No degree in this field. No bootcamp.

I use AI (Claude) throughout development — as a learning tool, code reviewer, and debugging partner. Every terminal error went back to Claude. Every concept I didn't understand, I worked through until I did.

What I own: the decisions. What to build, how to structure it, what broke, and why. The bug above is a real example of that process — not a story I read, but a mistake I made and fixed myself.

The systems run. The tests pass. I can demo everything live.

---

## What I Learned

- How a shared approval wallet works at the rule level — not just how to use one
- Why the order of operations matters when money is involved — update the records before sending, not after
- How to write tests that check for failure, not just success
- Why sending ETH the old way breaks with modern wallets — and what the current standard is
- How to build a real-time monitoring system that connects to industry-standard tools
- How to publish contract source code publicly so anyone can inspect it
- How to automate deployment so broken code can never reach the network

---

## Deployment History

| Version | What Changed |
|---|---|
| v1 | First working deployment |
| v2 | Added ability to add and remove owners without redeploying the whole wallet |
| v3 | Added emergency pause — had a critical bug (see above) |
| v4 | Bug fixed. Added live monitoring, real-time USD cost display, Discord alerts — **current** |

---

## Running It

```bash
# Full setup — installs everything, runs all tests, deploys
bash scripts/setup.sh

# Start the monitoring system
npx hardhat run scripts/startMonitor.js --network sepolia

# Start the web interface
cd frontend && npm start

# Check live activity stats
curl http://localhost:9090/metrics
```

---

## Environment Variables

```bash
PRIVATE_KEY=                   # The deployer's private key — never commit this
SEPOLIA_RPC_URL=               # Network connection endpoint from Alchemy
ETHERSCAN_API_KEY=             # For publishing the source code publicly
COINMARKETCAP_API_KEY=         # For showing live USD transaction costs
DISCORD_WEBHOOK_URL=           # Where alerts get sent
OWNER_1=0x...                  # First wallet owner address
OWNER_2=0x...                  # Second wallet owner address
OWNER_3=0x...                  # Third wallet owner address
REQUIRED_CONFIRMATIONS=2       # How many approvals are needed
```

Copy `.env.example` to `.env`. Never commit your `.env` file.

---

## What's Next

- Add a time delay — once approved, wait 24 to 48 hours before the payment can be sent
- Let owners cancel a transaction by agreement
- Keep monitoring history saved so it survives restarts
- Add a visual dashboard for the activity stats
- Auto-restart the monitoring system if it crashes

---

## Tech Stack

| What it does | Technology |
|---|---|
| Wallet logic and approval rules | Solidity 0.8.28 |
| Development and testing environment | Hardhat |
| Connects the app to the network | Ethers.js v6 |
| Network connection | Alchemy (Sepolia testnet) |
| Web interface | React + MetaMask |
| Real-time monitoring system | Node.js |
| Activity metrics format | Prometheus |
| Transaction alerts | Discord Webhooks |
| Live USD cost display | CoinMarketCap API |
| Automatic test runs on every code push | GitHub Actions |

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

## Why Not Use An Existing Tool

For a real treasury holding real money — use the existing tool. It has been audited, tested, and billions of dollars depend on it.

This project exists to understand what that tool is doing under the hood. Using it is one skill. Understanding it is another. This build is about the second one.

---

*Career changer from manufacturing. Learning in public. Building real things.*
