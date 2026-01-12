# Refinery Integration

This directory contains configuration and scripts for integrating with the Refinery, Gas Town's merge queue processor.

## Overview

The Refinery automatically processes merge requests from the merge queue, merging approved PRs to the main branch. For LiftMark, the Refinery is configured to automatically bump the package version during each merge, ensuring that every merge to main includes a version increment.

## Files

### `refinery.yml`

Configuration file that tells the Refinery how to handle merges for this repository.

Key configuration:
- **version_bump.enabled**: `true` - Enables automatic version bumping
- **version_bump.strategy**: `patch` - Bumps patch version (e.g., 1.0.24 → 1.0.25)
- **version_bump.script**: Points to `bump-version.sh`

### `bump-version.sh`

Executable script that performs the version bump operation. This script:

1. Validates the bump type (patch/minor/major)
2. Reads the current version from `package.json`
3. Runs `npm version <type> --no-git-tag-version`
4. Stages `package.json` and `package-lock.json` with `git add`
5. Outputs the new version number

**Usage:**
```bash
.refinery/bump-version.sh [patch|minor|major]
```

**Default:** `patch`

## How It Works

When the Refinery processes a merge request:

1. Checks out the main branch
2. Pulls latest changes
3. Runs `.refinery/bump-version.sh patch`
4. The script bumps the version and stages files
5. Refinery creates merge commit with version in message:
   ```
   Merge PR #123: Add feature XYZ

   Version: 1.0.25

   Co-Authored-By: polecat-name <email>
   ```
6. Pushes merge commit to main

## Version Bumping Strategy

**Current Strategy:** `patch`

- Every merge increments the patch version
- Format: `MAJOR.MINOR.PATCH`
- Example: `1.0.24` → `1.0.25`

**When to change strategy:**

- Use `minor` for feature releases with new functionality
- Use `major` for breaking changes or major releases

To change the strategy, edit `refinery.yml` and update the `version_bump.strategy` field.

## Testing the Script

To test the version bump script locally without committing:

```bash
# Create a test branch
git checkout -b test-version-bump

# Run the script
.refinery/bump-version.sh patch

# Check the changes
git diff package.json package-lock.json

# Reset changes
git checkout package.json package-lock.json
git checkout main
git branch -D test-version-bump
```

## Troubleshooting

### Script fails with "command not found"

Ensure the script is executable:
```bash
chmod +x .refinery/bump-version.sh
```

### Version bump creates merge conflicts

This shouldn't happen because:
- Refinery always pulls latest main before bumping
- Version bump happens atomically with merge
- Only one merge processes at a time

If it does happen, the Refinery will abort and flag the merge for human review.

### Want to skip version bump for a specific merge

The Refinery respects special commit message flags:
```
[skip version]
```

Include this in the PR description to skip version bumping for that merge.

## Integration with Release Process

After the Refinery merges and bumps the version:

1. Main branch now has new version (e.g., 1.0.25)
2. To create a release:
   ```bash
   git checkout main
   git pull
   gt release alpha  # Creates tag and triggers deployment
   ```

See [`docs/release-process.md`](../docs/release-process.md) for full release workflow.

## Related Documentation

- [Release Process Design](../docs/release-process.md) - Complete release workflow
- [Developer Documentation](../docs/DEVELOPER_DOCS.md) - General development guide
- Gas Town Refinery Documentation (external) - Refinery architecture and configuration

---

**Last Updated:** 2026-01-11
**Status:** Active
