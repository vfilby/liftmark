#!/usr/bin/env node

const { execSync } = require('child_process');
const readline = require('readline');

// Get release type from command line args
const releaseType = process.argv[2]; // 'alpha', 'beta', or 'production'
if (!['alpha', 'beta', 'production'].includes(releaseType)) {
  console.error('Usage: node release-helper.js <alpha|beta|production>');
  process.exit(1);
}

// Get version from package.json
const version = require('../package.json').version;

// Build tag name based on release type
const tagName = releaseType === 'production' ? `v${version}` : `${releaseType}-v${version}`;
const releaseTitle = releaseType === 'production'
  ? `Release v${version}`
  : `${releaseType.charAt(0).toUpperCase() + releaseType.slice(1)} Release v${version}`;
const releaseNotes = releaseType === 'production'
  ? 'Production release'
  : `${releaseType.charAt(0).toUpperCase() + releaseType.slice(1)} build for ${releaseType === 'alpha' ? 'internal' : 'external'} testing`;

console.log(`\n🏷️  Preparing ${releaseType} release: ${tagName}\n`);

// Check if tag exists locally
let tagExists = false;
try {
  execSync(`git rev-parse ${tagName}`, { stdio: 'ignore' });
  tagExists = true;
} catch (e) {
  // Tag doesn't exist locally
}

// Check if release exists on GitHub
let releaseExists = false;
try {
  execSync(`gh release view ${tagName}`, { stdio: 'ignore' });
  releaseExists = true;
} catch (e) {
  // Release doesn't exist on GitHub
}

// If either exists, offer to clean up
if (tagExists || releaseExists) {
  console.log('⚠️  Found existing release artifacts:');
  if (tagExists) console.log('   - Git tag exists locally');
  if (releaseExists) console.log('   - GitHub release exists');
  console.log('');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.question('Delete existing artifacts and retry? [y/N] ', (answer) => {
    rl.close();

    if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
      console.log('\n🗑️  Cleaning up existing artifacts...\n');

      // Delete GitHub release first
      if (releaseExists) {
        try {
          execSync(`gh release delete ${tagName} --yes`, { stdio: 'inherit' });
          console.log('✅ Deleted GitHub release');
        } catch (e) {
          console.error('❌ Failed to delete GitHub release');
          process.exit(1);
        }
      }

      // Delete local tag
      if (tagExists) {
        try {
          execSync(`git tag -d ${tagName}`, { stdio: 'inherit' });
          console.log('✅ Deleted local tag');
        } catch (e) {
          console.error('❌ Failed to delete local tag');
          process.exit(1);
        }
      }

      // Delete remote tag if it exists
      try {
        execSync(`git push origin :refs/tags/${tagName}`, { stdio: 'ignore' });
        console.log('✅ Deleted remote tag');
      } catch (e) {
        // Remote tag might not exist, that's ok
      }

      console.log('\n✨ Cleanup complete! Creating new release...\n');
      createRelease();
    } else {
      console.log('\n❌ Release cancelled. Use "make release-cleanup-<type>" to manually clean up.');
      process.exit(1);
    }
  });
} else {
  // No conflicts, create release directly
  createRelease();
}

function createRelease() {
  try {
    const prereleaseFlag = releaseType !== 'production' ? '--prerelease' : '';
    const cmd = `gh release create ${tagName} --title "${releaseTitle}" --notes "${releaseNotes}" ${prereleaseFlag}`.trim();

    console.log(`Creating release: ${tagName}`);
    execSync(cmd, { stdio: 'inherit' });
    console.log(`\n✅ Release created successfully: ${tagName}`);

    // Output the tag for Makefile to use in workflow trigger
    console.log(`TAG_NAME=${tagName}`);
  } catch (e) {
    console.error('\n❌ Failed to create release');
    process.exit(1);
  }
}
