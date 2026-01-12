#!/usr/bin/env bash
#
# Refinery Version Bump Script
#
# This script is called by the Refinery during merge operations to automatically
# bump the package version. It's designed to be idempotent and safe for automated use.
#
# Usage:
#   .refinery/bump-version.sh [patch|minor|major]
#
# Default: patch
#
# Exit codes:
#   0 - Success
#   1 - Error (with descriptive message)
#

set -e

# Configuration
BUMP_TYPE="${1:-patch}"
PACKAGE_JSON="package.json"
PACKAGE_LOCK="package-lock.json"

# Validate bump type
if [[ ! "$BUMP_TYPE" =~ ^(patch|minor|major)$ ]]; then
  echo "Error: Invalid bump type '$BUMP_TYPE'. Must be patch, minor, or major."
  exit 1
fi

# Check if package.json exists
if [[ ! -f "$PACKAGE_JSON" ]]; then
  echo "Error: package.json not found in current directory"
  exit 1
fi

# Get current version
CURRENT_VERSION=$(node -p "require('./$PACKAGE_JSON').version")
echo "Current version: $CURRENT_VERSION"

# Bump version using npm
echo "Bumping $BUMP_TYPE version..."
npm version "$BUMP_TYPE" --no-git-tag-version --allow-same-version=false

# Get new version
NEW_VERSION=$(node -p "require('./$PACKAGE_JSON').version")
echo "New version: $NEW_VERSION"

# Stage the changed files
echo "Staging version bump files..."
git add "$PACKAGE_JSON"

# Only add package-lock.json if it exists
if [[ -f "$PACKAGE_LOCK" ]]; then
  git add "$PACKAGE_LOCK"
fi

# Output the new version for the caller
echo "VERSION_BUMPED=$NEW_VERSION"
echo "✅ Version bumped from $CURRENT_VERSION to $NEW_VERSION"

exit 0
