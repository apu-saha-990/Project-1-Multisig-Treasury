#!/bin/bash

# ============================================
#   MultiSig Treasury — Uninstall Script
# ============================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo ""
echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}   MultiSig Treasury — Uninstall Script    ${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""
echo -e "${YELLOW}This will remove all installed dependencies from this project.${NC}"
echo -e "${YELLOW}Your source code, contracts, and config files will NOT be touched.${NC}"
echo ""
echo "The following will be removed:"
echo "  - node_modules/           (main dependencies)"
echo "  - frontend/node_modules/  (frontend dependencies)"
echo "  - artifacts/              (compiled contracts)"
echo "  - cache/                  (hardhat cache)"
echo "  - frontend/.next/         (if exists)"
echo "  - frontend/dist/          (if exists)"
echo ""
echo -e "${RED}Are you sure you want to continue? (y/n):${NC} \c"
read confirm

if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
    echo ""
    echo -e "${YELLOW}Uninstall cancelled. Nothing was removed.${NC}"
    echo ""
    exit 0
fi

echo ""
echo -e "${BLUE}Starting uninstall...${NC}"
echo ""

# Function to remove a directory and verify
remove_dir() {
    local dir=$1
    local label=$2

    if [ -d "$dir" ]; then
        echo -e "Removing ${label}..."
        echo -e "  Running: rm -rf ${dir}"
        rm -rf "$dir"

        if [ ! -d "$dir" ]; then
            echo -e "  ${GREEN}✓ ${label} removed successfully${NC}"
        else
            echo -e "  ${RED}✗ Failed to remove ${label}${NC}"
        fi
    else
        echo -e "  ${YELLOW}⚠ ${label} not found — skipping${NC}"
    fi
    echo ""
}

# Remove each item
remove_dir "node_modules" "node_modules (main dependencies)"
remove_dir "artifacts" "artifacts (compiled contracts)"
remove_dir "cache" "hardhat cache"
remove_dir "frontend/node_modules" "frontend/node_modules"
remove_dir "frontend/.next" "frontend/.next"
remove_dir "frontend/dist" "frontend/dist"

# Final verification scan
echo -e "${BLUE}--------------------------------------------${NC}"
echo -e "${BLUE}Running final verification scan...${NC}"
echo ""

all_clean=true

check_removed() {
    local dir=$1
    local label=$2

    if [ -d "$dir" ]; then
        echo -e "  ${RED}✗ ${label} still exists — something went wrong${NC}"
        all_clean=false
    else
        echo -e "  ${GREEN}✓ ${label} confirmed removed${NC}"
    fi
}

check_removed "node_modules" "node_modules"
check_removed "artifacts" "artifacts"
check_removed "cache" "cache"
check_removed "frontend/node_modules" "frontend/node_modules"

echo ""

if [ "$all_clean" = true ]; then
    echo -e "${GREEN}============================================${NC}"
    echo -e "${GREEN}   Clean uninstall complete.               ${NC}"
    echo -e "${GREEN}   Project is ready for fresh setup.       ${NC}"
    echo -e "${GREEN}============================================${NC}"
else
    echo -e "${RED}============================================${NC}"
    echo -e "${RED}   Some items could not be removed.        ${NC}"
    echo -e "${RED}   Try running with sudo if issues persist. ${NC}"
    echo -e "${RED}============================================${NC}"
fi

echo ""
