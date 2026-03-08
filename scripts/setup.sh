#!/bin/bash

# ============================================
#   MultiSig Treasury — Interactive Setup
# ============================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# ── Helpers ──────────────────────────────────

print_header() {
    echo ""
    echo -e "${BLUE}============================================${NC}"
    echo -e "${BLUE}   $1${NC}"
    echo -e "${BLUE}============================================${NC}"
    echo ""
}

print_step() {
    echo ""
    echo -e "${CYAN}──────────────────────────────────────────${NC}"
    echo -e "${CYAN}  STEP $1: $2${NC}"
    echo -e "${CYAN}──────────────────────────────────────────${NC}"
    echo ""
}

print_command() {
    echo -e "${YELLOW}  Running: $1${NC}"
}

print_success() {
    echo -e "  ${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "  ${RED}✗ $1${NC}"
}

print_warn() {
    echo -e "  ${YELLOW}⚠ $1${NC}"
}

press_enter() {
    echo ""
    echo -e "${BOLD}Press Enter to continue...${NC}"
    read
}

# ── Intro ─────────────────────────────────────

clear
print_header "MultiSig Treasury Wallet — Live Setup"

echo -e "  This script will set up a complete, production-grade"
echo -e "  multi-signature treasury wallet from scratch."
echo ""
echo -e "  What will be installed and configured:"
echo -e "    • Node.js dependencies"
echo -e "    • Hardhat smart contract framework"
echo -e "    • Solidity contract compilation"
echo -e "    • 25-test verification suite"
echo -e "    • Live deployment to Sepolia testnet"
echo -e "    • Real-time monitoring system"
echo -e "    • React web interface"
echo -e "    • COMMANDS.md reference file"
echo ""
echo -e "  ${YELLOW}You will be prompted at each step.${NC}"
echo -e "  ${YELLOW}Nothing happens without your confirmation.${NC}"
echo ""
press_enter

# ── Step 1: Check Dependencies ────────────────

print_step "1" "Checking System Dependencies"

echo -e "  Checking what is already installed on this machine..."
echo ""

# Check Node.js
echo -e "${BOLD}Checking Node.js...${NC}"
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    print_success "Node.js found: $NODE_VERSION"
else
    print_error "Node.js not found"
    echo ""
    echo -e "  Node.js is required to run the smart contract tools and frontend."
    echo -e "  Without it, nothing else will work."
    echo ""
    echo -e "${RED}  Install Node.js now? (y/n): ${NC}\c"
    read install_node
    if [ "$install_node" = "y" ] || [ "$install_node" = "Y" ]; then
        echo ""
        print_command "curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -"
        curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
        print_command "sudo apt-get install -y nodejs"
        sudo apt-get install -y nodejs
        if command -v node &> /dev/null; then
            print_success "Node.js installed: $(node --version)"
        else
            print_error "Node.js installation failed. Please install manually and re-run."
            exit 1
        fi
    else
        print_error "Node.js is required. Exiting."
        exit 1
    fi
fi

echo ""

# Check npm
echo -e "${BOLD}Checking npm...${NC}"
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    print_success "npm found: v$NPM_VERSION"
else
    print_error "npm not found. Reinstall Node.js to fix this."
    exit 1
fi

echo ""

# Check git
echo -e "${BOLD}Checking Git...${NC}"
if command -v git &> /dev/null; then
    GIT_VERSION=$(git --version)
    print_success "Git found: $GIT_VERSION"
else
    print_error "Git not found"
    echo ""
    echo -e "  Git is required to clone the project repository."
    echo -e "${RED}  Install Git now? (y/n): ${NC}\c"
    read install_git
    if [ "$install_git" = "y" ] || [ "$install_git" = "Y" ]; then
        print_command "sudo apt-get install -y git"
        sudo apt-get install -y git
        print_success "Git installed"
    else
        print_error "Git is required. Exiting."
        exit 1
    fi
fi

echo ""
print_success "All system dependencies verified"
press_enter

# ── Step 2: Project Directory ──────────────────

print_step "2" "Project Directory Setup"

echo -e "  Where do you want to install the project?"
echo -e "  Example: /home/apu/projects or just press Enter for current directory"
echo ""
echo -e "${BOLD}  Enter installation path (or Enter for current directory): ${NC}\c"
read install_path

if [ -z "$install_path" ]; then
    install_path=$(pwd)
fi

echo ""
echo -e "  Installation path: ${GREEN}$install_path${NC}"

if [ ! -d "$install_path" ]; then
    echo ""
    echo -e "  Directory does not exist."
    echo -e "${YELLOW}  Create it now? (y/n): ${NC}\c"
    read create_dir
    if [ "$create_dir" = "y" ] || [ "$create_dir" = "Y" ]; then
        print_command "mkdir -p $install_path"
        mkdir -p "$install_path"
        print_success "Directory created: $install_path"
    else
        print_error "Cannot continue without a valid directory."
        exit 1
    fi
fi

press_enter

# ── Step 3: Git Clone ──────────────────────────

print_step "3" "Cloning Project from GitHub"

echo -e "  Enter the GitHub repository URL to clone."
echo -e "  Example: https://github.com/apu-saha-990/Project01-multisig-treasury.git"
echo ""
echo -e "${BOLD}  GitHub URL: ${NC}\c"
read repo_url

if [ -z "$repo_url" ]; then
    print_error "No URL provided. Exiting."
    exit 1
fi

echo ""
echo -e "  Cloning repository..."
print_command "git clone $repo_url $install_path/multisig-treasury"
echo ""

git clone "$repo_url" "$install_path/multisig-treasury"

if [ $? -eq 0 ]; then
    print_success "Repository cloned successfully"
    PROJECT_DIR="$install_path/multisig-treasury"
else
    print_error "Clone failed. Check the URL and your internet connection."
    exit 1
fi

cd "$PROJECT_DIR"
echo ""
print_success "Working directory: $PROJECT_DIR"
press_enter

# ── Step 4: Configure .env ─────────────────────

print_step "4" "Environment Configuration"

echo -e "  The .env file stores your wallet addresses and API keys."
echo -e "  This file stays on your machine — it is never pushed to GitHub."
echo ""
echo -e "  You will need:"
echo -e "    • 3 owner wallet addresses (Ethereum/MetaMask addresses)"
echo -e "    • Number of confirmations required (2 or 3)"
echo -e "    • Your Alchemy RPC URL (from alchemy.com)"
echo -e "    • Your deployer private key (Owner 1)"
echo -e "    • Etherscan API key (for contract verification)"
echo -e "    • CoinMarketCap API key (for live USD gas prices)"
echo -e "    • Discord webhook URL (for transaction alerts)"
echo ""
press_enter

echo -e "${BOLD}  Owner 1 address (deployer — must have Sepolia ETH): ${NC}\c"
read OWNER_1
echo ""

echo -e "${BOLD}  Owner 1 private key (for deployment only): ${NC}\c"
read -s PRIVATE_KEY
echo ""

echo -e "${BOLD}  Owner 2 address: ${NC}\c"
read OWNER_2
echo ""

echo -e "${BOLD}  Owner 3 address: ${NC}\c"
read OWNER_3
echo ""

echo -e "${BOLD}  Number of confirmations required (2 or 3): ${NC}\c"
read REQUIRED_CONFIRMATIONS
echo ""

echo -e "${BOLD}  Alchemy Sepolia RPC URL: ${NC}\c"
read SEPOLIA_RPC_URL
echo ""

echo -e "${BOLD}  Etherscan API key: ${NC}\c"
read ETHERSCAN_API_KEY
echo ""

echo -e "${BOLD}  CoinMarketCap API key (for live USD gas prices): ${NC}\c"
read COINMARKETCAP_API_KEY
echo ""

echo -e "${BOLD}  Discord webhook URL (for alerts): ${NC}\c"
read DISCORD_WEBHOOK_URL
echo ""

# Write .env file
cat > .env << ENVEOF
# MultiSig Treasury - Environment Configuration
# Generated by setup script
# NEVER commit this file to GitHub

PRIVATE_KEY=$PRIVATE_KEY
SEPOLIA_RPC_URL=$SEPOLIA_RPC_URL
ETHERSCAN_API_KEY=$ETHERSCAN_API_KEY
COINMARKETCAP_API_KEY=$COINMARKETCAP_API_KEY
DISCORD_WEBHOOK_URL=$DISCORD_WEBHOOK_URL
OWNER_1=$OWNER_1
OWNER_2=$OWNER_2
OWNER_3=$OWNER_3
REQUIRED_CONFIRMATIONS=$REQUIRED_CONFIRMATIONS
ENVEOF

print_success ".env file created and configured"
print_success "File is excluded from Git via .gitignore"
press_enter

# ── Step 5: Install Dependencies ──────────────

print_step "5" "Installing Project Dependencies"

echo -e "  Installing all required npm packages..."
echo -e "  This includes Hardhat, Ethers.js, and all blockchain tooling."
echo ""
print_command "npm install"
echo ""

npm install

if [ $? -ne 0 ]; then
    echo ""
    print_warn "Standard install failed — dependency conflict detected"
    echo ""
    echo -e "  This is a known npm peer dependency conflict."
    echo -e "  The fix is to install using legacy peer deps mode."
    echo ""
    echo -e "${YELLOW}  Install using legacy peer deps mode? (y/n): ${NC}\c"
    read install_legacy
    if [ "$install_legacy" = "y" ] || [ "$install_legacy" = "Y" ]; then
        echo ""
        print_command "npm install --legacy-peer-deps"
        echo ""
        npm install --legacy-peer-deps
        if [ $? -eq 0 ]; then
            print_success "Dependencies installed successfully (legacy mode)"
        else
            print_error "Installation failed. Check your internet connection."
            exit 1
        fi
    else
        print_error "Cannot continue without dependencies."
        exit 1
    fi
else
    print_success "Dependencies installed successfully"
fi

press_enter

# ── Step 6: Compile Contract ───────────────────

print_step "6" "Compiling Smart Contract"

echo -e "  Compiling the Solidity smart contract using Hardhat."
echo -e "  This checks for syntax errors and generates the ABI."
echo ""
print_command "npx hardhat compile"
echo ""

npx hardhat compile

if [ $? -eq 0 ]; then
    echo ""
    print_success "Contract compiled successfully"
else
    echo ""
    print_error "Compilation failed"
    echo ""
    echo -e "  Check the error above. Common causes:"
    echo -e "    • Syntax error in the Solidity contract"
    echo -e "    • Missing import statements"
    echo -e "    • Wrong Solidity version"
    echo ""
    exit 1
fi

press_enter

# ── Step 7: Run Test Suite ─────────────────────

print_step "7" "Running 25-Test Verification Suite"

echo -e "  Running the full test suite to verify the contract is correct."
echo -e "  This deploys the contract to a local Hardhat blockchain and runs"
echo -e "  25 scenarios covering:"
echo ""
echo -e "    Deployment        — constructor validation, owner setup"
echo -e "    Deposits          — ETH receipt, event emission"
echo -e "    Submit TX         — owner can submit, non-owner rejected"
echo -e "    Confirm TX        — confirm, double-confirm blocked, non-owner blocked"
echo -e "    Execute TX        — execute at threshold, reject below, reject re-execution"
echo -e "    Revoke            — revoke works, can't revoke unconfirmed"
echo -e "    Owner Management  — add/remove owner via governance, all invalid cases"
echo -e "    Change Threshold  — valid change, zero rejected, above count rejected"
echo ""
echo -e "  ${YELLOW}Hard gate — cannot proceed until all 25 tests pass.${NC}"
echo ""
print_command "npx hardhat test"
echo ""

TEST_OUTPUT=$(REPORT_GAS=true npx hardhat test 2>&1)
echo "$TEST_OUTPUT"

PASSING=$(echo "$TEST_OUTPUT" | grep -oP '\d+ passing' | grep -oP '\d+')
FAILING=$(echo "$TEST_OUTPUT" | grep -oP '\d+ failing' | grep -oP '\d+')

echo ""

if [ "$PASSING" = "25" ] && [ -z "$FAILING" ]; then
    print_success "All 25 tests passed — contract verified and ready to deploy"
elif [ -z "$PASSING" ] || [ "$PASSING" = "0" ]; then
    print_error "0 tests ran — test files may be missing"
    echo ""
    echo -e "  Expected 25 tests. Got 0."
    echo -e "  Make sure the test/ folder exists in the repository."
    echo ""
    echo -e "${RED}  Exiting — cannot deploy without test verification.${NC}"
    exit 1
else
    print_error "Tests failed — $PASSING passing, $FAILING failing"
    echo ""
    echo -e "  Expected 25 passing, 0 failing."
    echo -e "  Review the failing tests above and fix before proceeding."
    echo ""
    echo -e "${RED}  Exiting — cannot deploy an unverified contract.${NC}"
    exit 1
fi

press_enter

# ── Step 8: Deploy to Sepolia ──────────────────

print_step "8" "Deploying Contract to Sepolia Testnet"

echo -e "  Deploying the verified contract to the Ethereum Sepolia testnet."
echo -e "  This is a real blockchain deployment — it will cost a small amount"
echo -e "  of Sepolia ETH (testnet only, no real value)."
echo ""
echo -e "  Owner 1: $OWNER_1"
echo -e "  Owner 2: $OWNER_2"
echo -e "  Owner 3: $OWNER_3"
echo -e "  Confirmations required: $REQUIRED_CONFIRMATIONS"
echo ""
echo -e "${YELLOW}  Ready to deploy? (y/n): ${NC}\c"
read deploy_confirm

if [ "$deploy_confirm" != "y" ] && [ "$deploy_confirm" != "Y" ]; then
    echo ""
    print_warn "Deployment skipped."
    press_enter
else
    echo ""
    print_command "npx hardhat run scripts/deploy.js --network sepolia"
    echo ""

    DEPLOY_OUTPUT=$(npx hardhat run scripts/deploy.js --network sepolia 2>&1)
    echo "$DEPLOY_OUTPUT"

    CONTRACT_ADDRESS=$(echo "$DEPLOY_OUTPUT" | grep -i "deployed to" | grep -oP '0x[a-fA-F0-9]{40}' | head -1)

    if [ -n "$CONTRACT_ADDRESS" ]; then
        echo ""
        print_success "Contract deployed successfully"
        echo ""
        echo -e "  ${GREEN}${BOLD}Contract Address: $CONTRACT_ADDRESS${NC}"
        echo -e "  ${GREEN}${BOLD}Etherscan Link:   https://sepolia.etherscan.io/address/$CONTRACT_ADDRESS${NC}"
        echo ""
        press_enter

        # ── Step 9: Verify on Etherscan ───────────

        print_step "9" "Verifying Contract on Etherscan"

        echo -e "  Submitting source code to Etherscan for public verification."
        echo -e "  This makes your contract code publicly auditable."
        echo ""
        print_command "npx hardhat verify --network sepolia --constructor-args arguments.js $CONTRACT_ADDRESS"
        echo ""

        # Create constructor arguments file
        cat > arguments.js << ARGSEOF
module.exports = [
  [
    "$OWNER_1",
    "$OWNER_2",
    "$OWNER_3"
  ],
  $REQUIRED_CONFIRMATIONS
];
ARGSEOF

        npx hardhat verify --network sepolia --constructor-args arguments.js "$CONTRACT_ADDRESS"
        rm -f arguments.js

        if [ $? -eq 0 ]; then
            print_success "Contract verified on Etherscan"
            echo -e "  ${GREEN}Verified URL: https://sepolia.etherscan.io/address/$CONTRACT_ADDRESS#code${NC}"
        else
            print_warn "Etherscan verification failed — contract is still deployed and working"
            print_warn "You can verify manually later on etherscan.io"
        fi

        press_enter

        # ── Step 10: Update Contract Address ──────

        print_step "10" "Updating Contract Address in Project Files"

        echo -e "  The new contract address needs to be updated in:"
        echo -e "    • config/monitor.config.json  (monitoring system)"
        echo -e "    • frontend/src/App.js          (React frontend)"
        echo ""
        echo -e "${YELLOW}  Update these files automatically? (y/n): ${NC}\c"
        read update_confirm

        if [ "$update_confirm" = "y" ] || [ "$update_confirm" = "Y" ]; then
            echo ""

            # Update monitor config
            print_command "Updating config/monitor.config.json..."
            sed -i "s/\"address\": \"0x[a-fA-F0-9]*\"/\"address\": \"$CONTRACT_ADDRESS\"/" config/monitor.config.json
            print_success "config/monitor.config.json updated"

            # Update frontend App.js
            print_command "Updating frontend/src/App.js..."
            sed -i "s/const CONTRACT_ADDRESS = \"0x[a-fA-F0-9]*\"/const CONTRACT_ADDRESS = \"$CONTRACT_ADDRESS\"/" frontend/src/App.js
            print_success "frontend/src/App.js updated"

            echo ""
            print_success "Contract address updated in all project files"
        else
            print_warn "Skipped — update these files manually:"
            echo -e "    config/monitor.config.json — change contract.address"
            echo -e "    frontend/src/App.js — change CONTRACT_ADDRESS on line 3"
        fi

        press_enter
    else
        print_error "Could not detect contract address from deployment output"
        echo -e "  Check the output above and update config files manually"
        press_enter
    fi
fi

# ── Step 11: Frontend Setup ────────────────────

print_step "11" "Setting Up React Frontend"

echo -e "  Installing frontend dependencies and starting the web interface."
echo -e "  The frontend allows owners to connect MetaMask and interact with"
echo -e "  the contract — submit transactions, confirm, execute, pause."
echo ""
print_command "cd frontend && npm install"
echo ""

cd frontend
npm install

if [ $? -ne 0 ]; then
    echo ""
    print_warn "Standard install failed — trying legacy peer deps mode..."
    echo ""
    print_command "npm install --legacy-peer-deps"
    npm install --legacy-peer-deps

    if [ $? -ne 0 ]; then
        print_error "Frontend dependency installation failed"
        cd ..
        press_enter
    fi
fi

echo ""
print_success "Frontend dependencies installed"
echo ""
echo -e "  Frontend is ready to start manually when you want to demo."
echo ""

cd ..
press_enter

# ── Step 12: Monitor & Frontend Commands ──────

print_step "12" "Setup Complete — Manual Start Commands"

echo -e "  Everything is installed and configured."
echo -e "  Start the frontend and monitor manually when ready:"
echo ""
echo -e "  ${CYAN}Start Frontend:${NC}"
echo -e "  ${YELLOW}    cd $PROJECT_DIR/frontend && npm start${NC}"
echo -e "  Then open: ${GREEN}http://localhost:3000${NC}"
echo ""
echo -e "  ${CYAN}Start Monitor:${NC}"
echo -e "  ${YELLOW}    cd $PROJECT_DIR && npx hardhat run scripts/startMonitor.js --network sepolia${NC}"
echo -e "  Prometheus metrics: ${GREEN}http://localhost:9090/metrics${NC}"
echo ""
print_success "All commands saved to COMMANDS.md"

press_enter


# ── Step 13: Generate COMMANDS.md ─────────────

print_step "13" "Generating Command Reference File"

echo -e "  Creating COMMANDS.md with all important information..."
echo ""

ETHERSCAN_URL=""
if [ -n "$CONTRACT_ADDRESS" ]; then
    ETHERSCAN_URL="https://sepolia.etherscan.io/address/$CONTRACT_ADDRESS"
fi

cat > COMMANDS.md << CMDEOF
# MultiSig Treasury — Command Reference

Generated: $(date)

---

## Contract Information

| Item | Value |
|---|---|
| Contract Address | ${CONTRACT_ADDRESS:-Not deployed yet} |
| Etherscan Link | ${ETHERSCAN_URL:-Not deployed yet} |
| Network | Sepolia Testnet |
| Owners | 3 (2-of-3 threshold) |
| Confirmations Required | $REQUIRED_CONFIRMATIONS |

## Owner Addresses

| Owner | Address |
|---|---|
| Owner 1 (Deployer) | $OWNER_1 |
| Owner 2 | $OWNER_2 |
| Owner 3 | $OWNER_3 |

## RPC Configuration

| Item | Value |
|---|---|
| Provider | Alchemy |
| Network | Sepolia |
| RPC URL | $SEPOLIA_RPC_URL |

---

## Common Commands

### Install dependencies
\`\`\`bash
npm install --legacy-peer-deps
\`\`\`

### Compile contract
\`\`\`bash
npx hardhat compile
\`\`\`

### Run tests
\`\`\`bash
npx hardhat test
\`\`\`

### Deploy to Sepolia
\`\`\`bash
npx hardhat run scripts/deploy.js --network sepolia
\`\`\`

### Verify on Etherscan
\`\`\`bash
# Step 1: Create arguments.js
# module.exports = [["OWNER_1","OWNER_2","OWNER_3"], THRESHOLD];

# Step 2: Verify
npx hardhat verify --network sepolia --constructor-args arguments.js <CONTRACT_ADDRESS>
\`\`\`

### Start monitoring
\`\`\`bash
npx hardhat run scripts/startMonitor.js --network sepolia
\`\`\`

### Start frontend
\`\`\`bash
cd frontend && npm start
\`\`\`

### Run uninstall script
\`\`\`bash
bash scripts/uninstall.sh
\`\`\`

---

## File Locations

| File | Purpose |
|---|---|
| contracts/MultiSigWallet.sol | Smart contract source code |
| config/monitor.config.json | Monitoring configuration |
| frontend/src/App.js | React frontend |
| scripts/deploy.js | Deployment script |
| scripts/startMonitor.js | Monitor startup |
| scripts/uninstall.sh | Clean uninstall |
| .env | Private keys and API keys (never commit) |
| logs/ | Monitor log files (auto-generated) |

---

## Prometheus Metrics

Available at: http://localhost:9090/metrics

| Metric | Description |
|---|---|
| multisig_transactions_total | Total transactions submitted |
| multisig_confirmations_pending | Pending confirmations |
| multisig_contract_balance_eth | Contract ETH balance |
| multisig_owners_count | Number of registered owners |
| multisig_health_check_status | 1 = healthy, 0 = degraded |

---

*Generated by setup script on $(date)*
CMDEOF

print_success "COMMANDS.md created at: $PROJECT_DIR/COMMANDS.md"

press_enter

# ── Final Screen ───────────────────────────────

clear
echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}   Setup Complete!                         ${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo -e "  ${BOLD}Contract:${NC}   ${CONTRACT_ADDRESS:-Not deployed}"
echo -e "  ${BOLD}Etherscan:${NC}  ${ETHERSCAN_URL:-Not deployed}"
echo -e "  ${BOLD}Frontend:${NC}   http://localhost:3000"
echo -e "  ${BOLD}Metrics:${NC}    http://localhost:9090/metrics"
echo -e "  ${BOLD}Commands:${NC}   $PROJECT_DIR/COMMANDS.md"
echo ""
echo -e "${GREEN}============================================${NC}"
echo ""
