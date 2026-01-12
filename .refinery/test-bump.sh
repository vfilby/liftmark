#!/usr/bin/env bash
#
# Test script for bump-version.sh
#
# This script tests the version bumping logic in a safe, isolated way
# without modifying the actual package.json
#

set -e

echo "🧪 Testing Refinery version bump script..."
echo ""

# Create a temporary directory for testing
TEST_DIR=$(mktemp -d)
trap "rm -rf $TEST_DIR" EXIT

echo "📁 Test directory: $TEST_DIR"
echo ""

# Copy package.json to test directory
cp package.json "$TEST_DIR/package.json"
if [[ -f package-lock.json ]]; then
  cp package-lock.json "$TEST_DIR/package-lock.json"
fi

# Initialize git in test directory
cd "$TEST_DIR"
git init -q
git config user.name "Test"
git config user.email "test@test.com"
git add .
git commit -q -m "Initial commit"

# Get original version
ORIGINAL_VERSION=$(node -p "require('./package.json').version")
echo "📦 Original version: $ORIGINAL_VERSION"

# Test patch bump
echo "⬆️  Testing patch bump..."
bash "$OLDPWD/.refinery/bump-version.sh" patch

# Verify version was bumped
NEW_VERSION=$(node -p "require('./package.json').version")
echo "📦 New version: $NEW_VERSION"

# Verify files are staged
STAGED_FILES=$(git diff --cached --name-only)
echo "📝 Staged files:"
echo "$STAGED_FILES"

# Verify version increased
if [[ "$NEW_VERSION" == "$ORIGINAL_VERSION" ]]; then
  echo ""
  echo "❌ FAIL: Version was not bumped"
  exit 1
fi

# Parse versions to verify it's a patch bump
IFS='.' read -r -a ORIG_PARTS <<< "$ORIGINAL_VERSION"
IFS='.' read -r -a NEW_PARTS <<< "$NEW_VERSION"

EXPECTED_PATCH=$((${ORIG_PARTS[2]} + 1))

if [[ "${NEW_PARTS[2]}" != "$EXPECTED_PATCH" ]]; then
  echo ""
  echo "❌ FAIL: Expected patch version ${EXPECTED_PATCH}, got ${NEW_PARTS[2]}"
  exit 1
fi

if [[ "${NEW_PARTS[0]}" != "${ORIG_PARTS[0]}" ]] || [[ "${NEW_PARTS[1]}" != "${ORIG_PARTS[1]}" ]]; then
  echo ""
  echo "❌ FAIL: Major or minor version changed unexpectedly"
  exit 1
fi

echo ""
echo "✅ All tests passed!"
echo ""
echo "Summary:"
echo "  - Version bumped from $ORIGINAL_VERSION to $NEW_VERSION"
echo "  - Files staged: $(echo $STAGED_FILES | tr '\n' ' ')"
echo "  - Script exit code: 0"
