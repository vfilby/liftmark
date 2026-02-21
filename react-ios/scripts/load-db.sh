#!/bin/bash

# Load Database Script for LiftMark
# Usage: make load-db DB=/path/to/database.db
# or: ./scripts/load-db.sh /path/to/database.db

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

# Check if database file path is provided
if [ -z "$1" ]; then
  echo -e "${RED}Error: Database file path required${NC}"
  echo "Usage: make load-db DB=/path/to/database.db"
  echo "   or: ./scripts/load-db.sh /path/to/database.db"
  exit 1
fi

DB_FILE="$1"

# Check if file exists
if [ ! -f "$DB_FILE" ]; then
  echo -e "${RED}Error: Database file not found: $DB_FILE${NC}"
  exit 1
fi

echo -e "${BLUE}Loading database into simulator...${NC}"
echo -e "Source: ${GREEN}$DB_FILE${NC}"

# Get the app's bundle identifier
BUNDLE_ID="com.eff3.liftmark"

# Get list of booted simulators only
echo -e "${BLUE}Finding booted simulators...${NC}"
BOOTED_SIMS=$(xcrun simctl list devices | grep "iPhone" | grep "Booted" | sed 's/^ *//')

# Count booted simulators
SIM_COUNT=$(echo "$BOOTED_SIMS" | grep -c "Booted" || true)

if [ "$SIM_COUNT" -eq 0 ]; then
  echo -e "${RED}Error: No booted simulator found${NC}"
  echo "Please start the iOS simulator first with: make ios"
  exit 1
fi

# If only one simulator, use it automatically
if [ "$SIM_COUNT" -eq 1 ]; then
  SIMULATOR_UUID=$(echo "$BOOTED_SIMS" | sed -E 's/.+\(([A-F0-9-]+)\) \(Booted\).*/\1/')
  SIMULATOR_NAME=$(echo "$BOOTED_SIMS" | sed -E 's/(.+) \([A-F0-9-]+\) \(Booted\).*/\1/')
  echo -e "${GREEN}Using simulator: $SIMULATOR_NAME${NC}"
else
  # Show list of running simulators
  echo ""
  echo "Running iPhone simulators:"
  echo ""

  # Create array of simulator info
  INDEX=1
  declare -a SIM_NAMES
  declare -a SIM_UDIDS

  while IFS= read -r line; do
    if [ -n "$line" ]; then
      NAME=$(echo "$line" | sed -E 's/(.+) \([A-F0-9-]+\) \(Booted\).*/\1/')
      UDID=$(echo "$line" | sed -E 's/.+\(([A-F0-9-]+)\) \(Booted\).*/\1/')

      SIM_NAMES+=("$NAME")
      SIM_UDIDS+=("$UDID")

      echo " [$INDEX] $NAME"
      INDEX=$((INDEX + 1))
    fi
  done <<< "$BOOTED_SIMS"

  echo ""
  echo -n "Select simulator (1-$SIM_COUNT): "
  read SELECTION

  # Validate selection
  if ! [[ "$SELECTION" =~ ^[0-9]+$ ]] || [ "$SELECTION" -lt 1 ] || [ "$SELECTION" -gt "$SIM_COUNT" ]; then
    echo -e "${RED}Error: Invalid selection. Please enter a number between 1 and $SIM_COUNT${NC}"
    exit 1
  fi

  # Get selected simulator (arrays are 0-indexed)
  SELECTED_INDEX=$((SELECTION - 1))
  SIMULATOR_NAME="${SIM_NAMES[$SELECTED_INDEX]}"
  SIMULATOR_UUID="${SIM_UDIDS[$SELECTED_INDEX]}"

  echo ""
  echo -e "${GREEN}Selected: $SIMULATOR_NAME${NC}"
fi

# Find the app's data directory
echo -e "${BLUE}Finding app data directory...${NC}"
APP_DATA_DIR=$(xcrun simctl get_app_container "$SIMULATOR_UUID" "$BUNDLE_ID" data 2>/dev/null)

if [ -z "$APP_DATA_DIR" ]; then
  echo -e "${RED}Error: App not installed on simulator${NC}"
  echo "Please build and run the app first with: make ios"
  exit 1
fi

echo -e "${GREEN}App data directory: $APP_DATA_DIR${NC}"

# SQLite database location
DB_DIR="$APP_DATA_DIR/Documents/SQLite"
TARGET_DB="$DB_DIR/liftmark.db"

# Create SQLite directory if it doesn't exist
mkdir -p "$DB_DIR"

# Backup existing database if it exists
BACKUP_FILE=""
if [ -f "$TARGET_DB" ]; then
  BACKUP_FILE="$DB_DIR/liftmark.backup.$(date +%s).db"
  echo -e "${YELLOW}Backing up existing database to: $(basename $BACKUP_FILE)${NC}"
  cp "$TARGET_DB" "$BACKUP_FILE"
fi

# Copy the database
echo -e "${BLUE}Copying database file...${NC}"
cp "$DB_FILE" "$TARGET_DB"

# Set proper permissions
chmod 644 "$TARGET_DB"

echo -e "${GREEN}✅ Database loaded successfully!${NC}"
echo -e "${BLUE}Restarting app to apply changes...${NC}"

# Kill the app to force reload
xcrun simctl terminate "$SIMULATOR_UUID" "$BUNDLE_ID" 2>/dev/null || true

# Wait a moment
sleep 1

# Relaunch the app
xcrun simctl launch "$SIMULATOR_UUID" "$BUNDLE_ID"

echo -e "${GREEN}✅ App restarted with new database${NC}"
echo ""
echo -e "${BLUE}Database location:${NC} $TARGET_DB"
if [ -n "$BACKUP_FILE" ]; then
  echo -e "${BLUE}Backup location:${NC} $BACKUP_FILE"
fi
echo ""
echo -e "${GREEN}LiftMark is now running with your database!${NC}"
