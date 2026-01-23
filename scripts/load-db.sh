#!/usr/bin/env bash
# Load Database to iOS Simulator
# Copies a database file to a booted iOS simulator for the LiftMark app

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Constants
DB_NAME="liftmark.db"
APP_BUNDLE_ID="com.eff3.liftmark"

echo -e "${BLUE}=== LiftMark Database Loader ===${NC}"
echo ""

# Check prerequisites
if ! command -v xcrun &> /dev/null; then
  echo -e "${RED}Error: Xcode command line tools not found${NC}"
  echo "Install with: xcode-select --install"
  exit 1
fi

# Get database file path from argument or prompt
DB_FILE="${1:-}"

if [ -z "$DB_FILE" ]; then
  echo -e "${YELLOW}Usage: $0 <path-to-database.db>${NC}"
  echo ""
  echo "Example:"
  echo "  $0 ~/Downloads/liftmark.db"
  echo "  make load-db DB=~/Downloads/liftmark.db"
  exit 1
fi

# Expand tilde in path
DB_FILE="${DB_FILE/#\~/$HOME}"

# Verify database file exists
if [ ! -f "$DB_FILE" ]; then
  echo -e "${RED}Error: Database file not found: $DB_FILE${NC}"
  exit 1
fi

echo -e "${GREEN}✓${NC} Database file: $DB_FILE"
echo ""

# Find booted simulators
echo -e "${BLUE}Finding booted iOS simulators...${NC}"
BOOTED_SIMS=$(xcrun simctl list devices | grep "(Booted)" | grep -E "(iPhone|iPad)" || true)

if [ -z "$BOOTED_SIMS" ]; then
  echo -e "${RED}Error: No booted iOS simulators found${NC}"
  echo ""
  echo "Please start a simulator first:"
  echo "  • Run: make ios"
  echo "  • Or open Simulator.app and boot a device"
  exit 1
fi

# Display booted simulators with numbers
echo ""
echo "Booted simulators:"
echo "$BOOTED_SIMS" | nl -w2 -s'. '
echo ""

# Get simulator selection from user
read -p "Select simulator number (or press Enter for #1): " SIM_NUM
if [ -z "$SIM_NUM" ]; then
  SIM_NUM=1
fi

# Extract selected simulator info
SELECTED_LINE=$(echo "$BOOTED_SIMS" | sed -n "${SIM_NUM}p")
if [ -z "$SELECTED_LINE" ]; then
  echo -e "${RED}Error: Invalid selection${NC}"
  exit 1
fi

# Parse simulator name and UDID
SIM_NAME=$(echo "$SELECTED_LINE" | sed -E 's/^[[:space:]]+//' | sed 's/ (.*//')
SIM_UDID=$(echo "$SELECTED_LINE" | sed -E 's/.*\(([A-F0-9-]+)\).*/\1/')

echo -e "${GREEN}✓${NC} Selected: $SIM_NAME"
echo ""

# Find LiftMark app directory in simulator
echo -e "${BLUE}Locating LiftMark app in simulator...${NC}"

# Search for the database file in the simulator
DB_PATH=$(find ~/Library/Developer/CoreSimulator/Devices/"$SIM_UDID"/data/Containers/Data/Application -name "$DB_NAME" 2>/dev/null | head -1)

if [ -z "$DB_PATH" ]; then
  echo -e "${RED}Error: LiftMark app not found in simulator${NC}"
  echo ""
  echo "Please install the app first:"
  echo "  1. Run: make ios"
  echo "  2. Wait for app to install and launch"
  echo "  3. Try this command again"
  exit 1
fi

# Get app directory (database is in Documents/)
APP_DIR=$(dirname "$DB_PATH")
echo -e "${GREEN}✓${NC} Found app at: $APP_DIR"
echo ""

# Create backup of existing database
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_PATH="${APP_DIR}/${DB_NAME}.backup_${TIMESTAMP}"

echo -e "${BLUE}Creating backup...${NC}"
cp "$DB_PATH" "$BACKUP_PATH"
echo -e "${GREEN}✓${NC} Backup saved: ${DB_NAME}.backup_${TIMESTAMP}"
echo ""

# Copy new database
echo -e "${BLUE}Loading new database...${NC}"
cp "$DB_FILE" "$DB_PATH"
echo -e "${GREEN}✓${NC} Database loaded successfully!"
echo ""

# Instructions
echo -e "${YELLOW}⚠️  To see the changes:${NC}"
echo "  1. Close the LiftMark app completely (swipe up from app switcher)"
echo "  2. Reopen the app"
echo ""
echo -e "${GREEN}Done!${NC}"
