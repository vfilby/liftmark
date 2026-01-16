# Release Scripts

## Release Helper

The `release-helper.js` script automates the release process with smart conflict detection and cleanup.

### Features

- **Automatic conflict detection**: Checks if a release tag already exists before attempting to create
- **Interactive cleanup**: Prompts to delete existing artifacts if a conflict is found
- **Safe operation**: Requires confirmation before deleting anything

### Usage

The release helper is automatically used by the npm release scripts:

```bash
# Via npm (recommended)
npm run release:alpha
npm run release:beta
npm run release:production

# Via make (includes TestFlight trigger)
make release-alpha
make release-beta
make release-production
```

### Manual Cleanup

If a release fails partway through, you can manually clean up artifacts:

```bash
# Via npm
npm run release:cleanup:alpha
npm run release:cleanup:beta
npm run release:cleanup:production

# Via make
make release-cleanup-alpha
make release-cleanup-beta
make release-cleanup-production
```

This will delete:
- GitHub release (if exists)
- Local git tag (if exists)
- Remote git tag (if exists)

### Workflow

1. **Pre-release check**: Verifies you're on main branch with clean working tree
2. **Conflict detection**: Checks if tag/release already exists
3. **Cleanup prompt** (if conflict): Asks permission to delete existing artifacts
4. **Release creation**: Creates new GitHub release with appropriate tag
5. **TestFlight trigger** (make only): Triggers GitHub Actions workflow

### Example Output

```
🏷️  Preparing alpha release: alpha-v1.0.24

⚠️  Found existing release artifacts:
   - Git tag exists locally
   - GitHub release exists

Delete existing artifacts and retry? [y/N] y

🗑️  Cleaning up existing artifacts...

✅ Deleted GitHub release
✅ Deleted local tag
✅ Deleted remote tag

✨ Cleanup complete! Creating new release...

Creating release: alpha-v1.0.24
✅ Release created successfully: alpha-v1.0.24
```
