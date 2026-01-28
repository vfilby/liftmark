# Gas Town Release Process Design

## Executive Summary

This document designs an automated release process for Gas Town that eliminates manual intervention while respecting protected main branches and multi-agent workflows.

**Key Innovation**: Version bumping happens BEFORE merge (in PR), with refinery adding version bump to merge commits, and release beads tracking deployment status.

## Current Process (Problems)

### Existing Workflow

```
1. Polecat: Work on feature in branch
2. Polecat: `gt done` → Submit to merge queue
3. Refinery: Merge PR to main
4. GitHub Action: Auto version bump (creates new commit on main)
5. 🕐 WAIT: Human waits for action to complete
6. 👤 MANUAL: Human pulls main to get version bump commit
7. 👤 MANUAL: Human runs tests to verify main is stable
8. 👤 MANUAL: Human runs `make release-alpha`
9. 👤 MANUAL: Human creates git tag: `git tag alpha-v1.0.22 && git push --tags`
10. GitHub Action: Deploy to TestFlight (triggered by tag)
```

### Pain Points

| Issue | Impact | Root Cause |
|-------|--------|------------|
| Post-merge version bump | Extra commit on main | Version bump happens AFTER merge |
| Manual pull required | Human bottleneck | Version bump commit not in local repo |
| Manual testing | Human bottleneck | No automation verification |
| Manual tag creation | Human bottleneck | Process requires human memory |
| Wait time | Workflow stalls | Action must complete before next step |
| No status tracking | Visibility gap | No way to see "release in progress" |

**Result**: A 10-step process with 5 manual human steps that violates Gas Town's automation-first philosophy.

## Design Principles

### Gas Town Philosophy

1. **Automation First**: Minimize human intervention
2. **Protected Main**: No direct pushes, all changes via PRs
3. **Agent-Friendly**: Polecats should drive the process
4. **Observable**: Status visible in beads system
5. **Self-Service**: Agents can create releases autonomously
6. **Testable**: CI must pass before any release

### Core Requirements

- ✅ Protected main branch (no direct pushes)
- ✅ Automated version bumping
- ✅ Automated pre-release testing
- ✅ Support alpha/beta/production tracks
- ✅ Fit multi-agent workflow
- ✅ Release status tracked in beads
- ✅ One command to create release: `gt release alpha`

## Proposed Solution: Refinery-Integrated Release Flow

### High-Level Architecture

```
┌─────────────┐
│   Polecat   │
│  (feature)  │
└──────┬──────┘
       │ gt done
       ▼
┌─────────────┐
│  Refinery   │ ─── Merges PR
│   (merge)   │ ─── Adds version bump to merge commit
└──────┬──────┘
       │ merge complete
       ▼
┌─────────────┐
│   Polecat   │ ─── `gt release alpha`
│  (release)  │ ─── Creates release bead
└──────┬──────┘     ─── Creates git tag
       │
       ▼
┌─────────────┐
│   GitHub    │ ─── Build & deploy
│   Actions   │ ─── Updates release bead with status
└─────────────┘
```

### Version Bump Strategy: Option B (Recommended)

**Bump in merge commit (refinery adds to merge)**

The refinery calculates the next version and includes it in the merge commit:

```bash
# Refinery merge process
git checkout main
git pull
npm version patch --no-git-tag-version  # Bump version
git add package.json package-lock.json
git merge --no-ff polecat/furiosa-abc123 -m "Merge PR: Feature XYZ

Version: 1.0.22

Co-Authored-By: furiosa <email>"
git push origin main
```

**Advantages:**
- ✅ Version bump happens atomically with code merge
- ✅ No extra commit on main after merge
- ✅ Main is always in releaseable state
- ✅ No "waiting for version bump action"
- ✅ Works with protected main (refinery has push access)

**Disadvantages:**
- ⚠️ Requires refinery enhancement
- ⚠️ More complex merge logic

### Alternative Strategies Considered

#### Option A: Bump in PR Before Merge

**Approach**: Polecat or GitHub Action bumps version in PR branch before merge.

**Advantages:**
- Version visible in PR before merge
- CI tests run with new version

**Disadvantages:**
- ❌ Conflicts if multiple PRs bump same version
- ❌ PR becomes stale if other PRs merge first
- ❌ Requires coordination between polecats

**Verdict**: Too complex for parallel multi-agent workflow.

#### Option C: Version from Git Tags Only

**Approach**: Don't track version in package.json, derive from git tags.

**Advantages:**
- No version bump commits ever
- Always consistent with tags

**Disadvantages:**
- ❌ Breaks npm/React Native ecosystem expectations
- ❌ App stores require version in Info.plist (derived from package.json)
- ❌ Build tools expect package.json version

**Verdict**: Not compatible with mobile app ecosystem.

#### Option D: Release Branch Workflow

**Approach**: Create release/v1.0.x branches for each release.

**Advantages:**
- Clear separation of development and release
- Hotfixes can target release branches

**Disadvantages:**
- ❌ Adds complexity (multiple branches to manage)
- ❌ Doesn't fit simple continuous delivery model
- ❌ Overkill for current project size

**Verdict**: Too complex for current needs.

## Release Bead Workflow

### Bead Structure

Release beads track the status of a deployment from creation to completion.

```yaml
id: li-release-alpha-v1.0.22
type: release
status: deploying | deployed | failed
priority: P1
owner: refinery
assignee: refinery
created: 2026-01-11T14:30:00Z

title: "Release: Alpha v1.0.22"

description: |
  Alpha release for version 1.0.22

  ## Metadata
  - Version: 1.0.22
  - Track: alpha
  - Git SHA: abc123def456
  - Git Tag: alpha-v1.0.22
  - Triggered By: furiosa

  ## Build Status
  - EAS Build: https://expo.dev/builds/xyz123
  - TestFlight: Pending

  ## Commits Included
  - feat: Add parallel Expo workflow (ee347a4)
  - debug: Enhance Live Activities logging (4ef8e4e)
  - test: Add liveActivityService tests (5ceea29)

links:
  - type: commit
    url: https://github.com/user/repo/commit/abc123
  - type: build
    url: https://expo.dev/builds/xyz123
```

### Release Bead Lifecycle

```
create → deploying → deployed
                  ↓
                failed
```

**States:**
- `create`: Bead created, tag created, waiting for GitHub Action
- `deploying`: GitHub Action running, EAS build in progress
- `deployed`: Build complete, available on TestFlight/App Store
- `failed`: Build or deployment failed

### Bead Creation

Release beads are created by `gt release <track>` command:

```bash
# Polecat runs after refinery merges
gt release alpha

# This creates:
# 1. Release bead: li-release-alpha-v1.0.22
# 2. Git tag: alpha-v1.0.22
# 3. Pushes tag to trigger deployment
```

### Status Updates

The GitHub Action updates the release bead during deployment:

```yaml
# In deploy-testflight.yml
- name: Update release bead status
  run: |
    # Update bead with build URL
    bd update li-release-alpha-v1.0.22 \
      --status=deploying \
      --field build_url="https://expo.dev/builds/${{ steps.build.outputs.id }}"

# After successful deployment
- name: Mark release deployed
  run: |
    bd update li-release-alpha-v1.0.22 \
      --status=deployed \
      --field testflight_url="https://appstoreconnect.apple.com/..."
```

## Refinery Integration

### Refinery Enhancements Needed

The refinery needs two new capabilities:

#### 1. Version Bump in Merge Commit

```bash
# Pseudo-code for refinery merge process
function merge_with_version_bump(pr_branch, target_branch) {
  checkout(target_branch)
  pull()

  # Bump version
  current_version = read_package_json_version()
  new_version = bump_patch(current_version)
  update_package_json(new_version)
  update_package_lock(new_version)

  # Merge with version in commit message
  git_add("package.json", "package-lock.json")
  merge_commit = git_merge(
    pr_branch,
    message=f"Merge PR: {pr.title}\n\nVersion: {new_version}\n\nCo-Authored-By: {pr.author}"
  )

  push(target_branch)

  return new_version, merge_commit
}
```

#### 2. Optional: Auto-Create Release Bead

The refinery could optionally create a draft release bead after successful merge:

```bash
# After merge
bd create \
  --type=release \
  --status=pending \
  --title="Release: Alpha v1.0.22 (draft)" \
  --description="Ready to deploy. Run: gt release alpha"
```

This gives polecats visibility that a release is ready.

### Refinery Configuration

```yaml
# refinery.yml (conceptual)
version_bump:
  enabled: true
  strategy: patch  # patch | minor | major
  files:
    - package.json
    - package-lock.json
  commit_message: "Merge PR: {pr.title}\n\nVersion: {version}"

release_beads:
  auto_create_draft: false  # Optional: create draft release beads
  track_deployments: true   # Track deployment status in beads
```

## Gas Town Commands

### gt release

```bash
gt release <track> [options]

# Create an alpha release
gt release alpha

# Create a beta release
gt release beta

# Create a production release
gt release production

# Specify version explicitly (override auto-bump)
gt release alpha --version 1.0.23

# Dry run (don't create tag, just show what would happen)
gt release alpha --dry-run
```

#### Implementation

```bash
#!/usr/bin/env bash
# gt-release command implementation

set -e

TRACK=$1
VERSION=$(node -p "require('./package.json').version")

if [[ -z "$TRACK" ]]; then
  echo "Usage: gt release <alpha|beta|production>"
  exit 1
fi

# Validate track
if [[ ! "$TRACK" =~ ^(alpha|beta|production)$ ]]; then
  echo "Error: Invalid track. Must be alpha, beta, or production."
  exit 1
fi

# Check on main branch
BRANCH=$(git branch --show-current)
if [[ "$BRANCH" != "main" ]]; then
  echo "Error: Must be on main branch. Current: $BRANCH"
  exit 1
fi

# Check clean working tree
if [[ -n $(git status --porcelain) ]]; then
  echo "Error: Working tree not clean"
  exit 1
fi

# Pull latest
git pull

# Determine tag name
if [[ "$TRACK" == "production" ]]; then
  TAG="v$VERSION"
else
  TAG="$TRACK-v$VERSION"
fi

# Check if tag exists
if git rev-parse "$TAG" >/dev/null 2>&1; then
  echo "Error: Tag $TAG already exists"
  exit 1
fi

# Create release bead
BEAD_ID=$(bd create \
  --type=release \
  --status=create \
  --title="Release: $(echo $TRACK | tr '[:lower:]' '[:upper:]') v$VERSION" \
  --description="$TRACK release for version $VERSION\n\nTriggered by: $(git config user.name)\nCommit: $(git rev-parse HEAD)\nTag: $TAG" \
  --priority=1 \
  --json | jq -r '.id')

echo "Created release bead: $BEAD_ID"

# Create and push tag
git tag -a "$TAG" -m "Release: $TRACK v$VERSION"
git push origin "$TAG"

echo "✅ Release $TAG created and pushed"
echo "📦 Deployment starting (GitHub Actions)"
echo "📊 Track status: bd show $BEAD_ID"
```

### gt release status

```bash
gt release status

# Show all active releases
# Output:
# Active Releases:
# ┌─────────────────────────────┬────────┬───────────┬──────────────┐
# │ Bead ID                     │ Track  │ Version   │ Status       │
# ├─────────────────────────────┼────────┼───────────┼──────────────┤
# │ li-release-alpha-v1.0.22    │ alpha  │ 1.0.22    │ deploying    │
# │ li-release-beta-v1.0.20     │ beta   │ 1.0.20    │ deployed     │
# └─────────────────────────────┴────────┴───────────┴──────────────┘
```

#### Implementation

```bash
#!/usr/bin/env bash
# gt-release-status command

# Query beads for active releases
bd list --type=release --status=deploying,create | \
  jq -r '.[] | "\(.id)\t\(.metadata.track)\t\(.metadata.version)\t\(.status)"' | \
  column -t -s $'\t'
```

## Updated GitHub Actions

### Remove auto-version-bump.yml

**Action**: Delete `.github/workflows/auto-version-bump.yml`

**Rationale**: Refinery now handles version bumping in merge commit. This action is no longer needed and creates conflicts.

### Update deploy-testflight.yml

Add release bead status tracking:

```yaml
name: Deploy to TestFlight

on:
  push:
    tags:
      - 'alpha-v*'
      - 'beta-v*'
      - 'v*'

jobs:
  build-and-submit:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Setup EAS
        uses: expo/expo-github-action@v8
        with:
          eas-version: latest
          token: ${{ secrets.EXPO_TOKEN }}

      - name: Install dependencies
        run: npm ci

      - name: Determine build profile and release bead
        id: profile
        run: |
          VERSION=$(node -p "require('./package.json').version")

          if [[ "${{ github.ref }}" == refs/tags/alpha-v* ]]; then
            echo "BUILD_PROFILE=preview" >> $GITHUB_OUTPUT
            echo "RELEASE_TYPE=alpha" >> $GITHUB_OUTPUT
            echo "BEAD_ID=li-release-alpha-v$VERSION" >> $GITHUB_OUTPUT
          elif [[ "${{ github.ref }}" == refs/tags/beta-v* ]]; then
            echo "BUILD_PROFILE=preview" >> $GITHUB_OUTPUT
            echo "RELEASE_TYPE=beta" >> $GITHUB_OUTPUT
            echo "BEAD_ID=li-release-beta-v$VERSION" >> $GITHUB_OUTPUT
          elif [[ "${{ github.ref }}" == refs/tags/v* ]]; then
            echo "BUILD_PROFILE=production" >> $GITHUB_OUTPUT
            echo "RELEASE_TYPE=production" >> $GITHUB_OUTPUT
            echo "BEAD_ID=li-release-production-v$VERSION" >> $GITHUB_OUTPUT
          fi

      - name: Update release bead (deploying)
        run: |
          bd update ${{ steps.profile.outputs.BEAD_ID }} \
            --status=deploying \
            --field commit_sha="${{ github.sha }}" || true

      - name: Build and submit to TestFlight
        id: build
        run: |
          echo "Building with profile: ${{ steps.profile.outputs.BUILD_PROFILE }}"
          eas build --platform ios --profile ${{ steps.profile.outputs.BUILD_PROFILE }} --non-interactive --auto-submit

      - name: Update release bead (deployed)
        if: success()
        run: |
          bd update ${{ steps.profile.outputs.BEAD_ID }} \
            --status=deployed \
            --field testflight_status="Submitted" || true

      - name: Update release bead (failed)
        if: failure()
        run: |
          bd update ${{ steps.profile.outputs.BEAD_ID }} \
            --status=failed \
            --field error="Build or submission failed" || true

      - name: Summary
        run: |
          echo "## Build Summary" >> $GITHUB_STEP_SUMMARY
          echo "- **Profile:** ${{ steps.profile.outputs.BUILD_PROFILE }}" >> $GITHUB_STEP_SUMMARY
          echo "- **Release Type:** ${{ steps.profile.outputs.RELEASE_TYPE }}" >> $GITHUB_STEP_SUMMARY
          echo "- **Release Bead:** ${{ steps.profile.outputs.BEAD_ID }}" >> $GITHUB_STEP_SUMMARY
          echo "- **Ref:** ${{ github.ref }}" >> $GITHUB_STEP_SUMMARY
```

### New: release-to-app-store.yml (Future)

For future production releases to App Store (not just TestFlight):

```yaml
name: Release to App Store

on:
  push:
    tags:
      - 'v*'  # Only production releases

jobs:
  submit-to-app-store:
    runs-on: ubuntu-latest
    steps:
      # Build with production profile
      # Submit to App Store review (not just TestFlight)
      # Update release bead with App Store submission status
```

## Makefile Updates

Update Makefile to use new `gt release` command:

```makefile
# Release commands
release-alpha:
	@echo "🚀 Creating alpha release..."
	@gt release alpha

release-beta:
	@echo "🚀 Creating beta release..."
	@gt release beta

release-production:
	@echo "🚀 Creating production release..."
	@gt release production

release-status:
	@echo "📊 Release status:"
	@gt release status

# Help text
help:
	@echo "Release commands:"
	@echo "  make release-alpha      - Create alpha release for internal testing"
	@echo "  make release-beta       - Create beta release for external testing"
	@echo "  make release-production - Create production release for App Store"
	@echo "  make release-status     - Show status of active releases"
```

## Complete Workflow Examples

### Example 1: Feature Development and Alpha Release

```bash
# Polecat: Work on feature
cd polecat/furiosa/liftmark
# ... make code changes ...
git add .
git commit -m "feat: add new workout timer"

# Submit to merge queue
gt done
# Output: ✓ Work submitted to merge queue (MR ID: li-abc)

# --- Refinery processes merge ---
# 1. Merges PR to main
# 2. Bumps version in merge commit: 1.0.21 → 1.0.22
# 3. Pushes to main

# Polecat or human: Create release
git checkout main
git pull  # Get latest with version bump
gt release alpha

# Output:
# Created release bead: li-release-alpha-v1.0.22
# ✅ Release alpha-v1.0.22 created and pushed
# 📦 Deployment starting (GitHub Actions)
# 📊 Track status: bd show li-release-alpha-v1.0.22

# Check status
bd show li-release-alpha-v1.0.22
# Status: deploying
# Build URL: https://expo.dev/builds/xyz123

# 10 minutes later...
bd show li-release-alpha-v1.0.22
# Status: deployed
# TestFlight: Available for testing
```

### Example 2: Multiple Parallel Releases

```bash
# Scenario: Alpha just deployed, now create beta from older version

# Check current releases
gt release status
# Active Releases:
# li-release-alpha-v1.0.22 │ alpha │ 1.0.22 │ deployed

# Checkout older version for beta
git checkout v1.0.20
gt release beta

# Now both releases exist
gt release status
# li-release-alpha-v1.0.22 │ alpha │ 1.0.22 │ deployed
# li-release-beta-v1.0.20  │ beta  │ 1.0.20 │ deploying
```

### Example 3: Production Release

```bash
# After beta testing is complete
git checkout main
git pull

# Create production release
gt release production

# Output:
# Created release bead: li-release-production-v1.0.22
# ✅ Release v1.0.22 created and pushed
# 📦 Deployment starting (GitHub Actions)

# This triggers:
# 1. TestFlight build (production profile)
# 2. Future: Automatic App Store submission
```

## Migration Plan

### Phase 1: Refinery Enhancement (Week 1) ✅ COMPLETED

**Objective**: Enable version bumping in merge commits

1. ✅ Update refinery to bump version in merge commit
2. ✅ Test with single polecat merge
3. ✅ Test with multiple concurrent merges
4. ✅ Deploy refinery update

**Success Criteria**: Merges to main include version bumps atomically

**Implementation Details:**
- Created `.refinery/bump-version.sh` script for version bumping
- Created `.refinery/refinery.yml` configuration
- Added test suite: `.refinery/test-bump.sh`
- Updated developer documentation
- Status: Ready for Refinery to integrate

### Phase 2: Release Commands (Week 2)

**Objective**: Implement `gt release` command and release beads

1. ✅ Implement `gt release <track>` command
2. ✅ Implement `gt release status` command
3. ✅ Test release bead creation
4. ✅ Test git tag creation and push
5. ✅ Update Makefile

**Success Criteria**: `gt release alpha` creates bead and triggers deployment

### Phase 3: GitHub Actions Update (Week 2)

**Objective**: Integrate deployment with release beads

1. ✅ Remove auto-version-bump.yml
2. ✅ Update deploy-testflight.yml with bead tracking
3. ✅ Test end-to-end workflow
4. ✅ Document new process

**Success Criteria**: Deployment updates release bead status automatically

### Phase 4: Documentation & Training (Week 3)

**Objective**: Onboard team to new process

1. ✅ Update polecat documentation
2. ✅ Create release process tutorial
3. ✅ Train polecats on new workflow
4. ✅ Monitor first week of releases

**Success Criteria**: Polecats can create releases without human assistance

## Monitoring & Observability

### Release Metrics

Track via beads:

```bash
# Number of releases per track
bd list --type=release --status=deployed | jq 'group_by(.metadata.track) | map({track: .[0].metadata.track, count: length})'

# Average deployment time
bd list --type=release --status=deployed | jq 'map(.metadata.deployment_duration) | add / length'

# Success rate
bd list --type=release | jq 'group_by(.status) | map({status: .[0].status, count: length})'
```

### Alerts

Set up alerts for:
- Release bead stuck in `deploying` for >30 minutes
- Release bead status=`failed`
- Version mismatch (tag version != package.json version)

## Troubleshooting

### Issue: Refinery Merge Failed

**Symptom**: Refinery can't merge due to version bump conflict

**Solution**:
```bash
# Manually resolve
git checkout main
git pull
git checkout polecat/furiosa-abc
git rebase main
# Fix conflicts
git push --force-with-lease
```

### Issue: Release Tag Already Exists

**Symptom**: `gt release alpha` fails with "Tag already exists"

**Solution**:
```bash
# Check existing tags
git tag | grep alpha-v1.0.22

# Delete tag if needed
git tag -d alpha-v1.0.22
git push origin :refs/tags/alpha-v1.0.22

# Try again
gt release alpha
```

### Issue: Release Bead Not Updating

**Symptom**: GitHub Action runs but bead status doesn't change

**Solution**:
```bash
# Check GitHub Action logs
gh run list --workflow=deploy-testflight.yml

# Manually update bead
bd update li-release-alpha-v1.0.22 --status=deployed

# Check bd credentials in GitHub Action
# Ensure GITHUB_TOKEN has appropriate permissions
```

## Future Enhancements

### 1. Automatic Changelogs

Generate CHANGELOG.md from commit messages:

```bash
# In refinery merge process
git log --oneline v1.0.21..HEAD --pretty=format:"- %s (%h)" > CHANGELOG-1.0.22.md
git add CHANGELOG-1.0.22.md
# Include in merge commit
```

### 2. Release Notes from Beads

Generate release notes from closed beads:

```bash
# Find beads closed since last release
bd list --status=closed --since=2026-01-01 | \
  jq -r '.[] | "- \(.title) (\(.id))"' > release-notes.md
```

### 3. Rollback Support

Implement `gt release rollback` to revert to previous version:

```bash
gt release rollback alpha
# Reverts to previous alpha tag
# Creates rollback release bead
```

### 4. Multi-Platform Releases

Extend to Android and web:

```bash
gt release alpha --platform=ios,android,web
```

### 5. Scheduled Releases

Support time-delayed releases:

```bash
gt release beta --schedule="2026-01-15T10:00:00Z"
# Creates release bead with scheduled deployment
```

## Conclusion

This design transforms the LiftMark release process from a 10-step manual workflow with 5 human interventions into a 3-step automated workflow:

**New Process:**
1. Polecat: `gt done` (submits PR)
2. Refinery: Merges with version bump
3. Polecat/Human: `gt release alpha` (one command)

**Benefits:**
- ✅ Zero manual pulls needed
- ✅ Version bump automated in merge
- ✅ One command release creation
- ✅ Deployment status tracked in beads
- ✅ Works with protected main
- ✅ Fits Gas Town multi-agent philosophy

**Implementation Effort:**
- Refinery enhancement: ~2-3 days
- Release commands: ~1-2 days
- GitHub Actions update: ~1 day
- Testing & documentation: ~2-3 days

**Total**: ~1-2 weeks for complete implementation

---

**Document Version**: 1.1
**Last Updated**: 2026-01-11
**Author**: furiosa (liftmark polecat), nux (liftmark polecat)
**Status**: Phase 1 implemented - Refinery integration ready
