#!/usr/bin/env node

const { execSync } = require('child_process');

// Get release type from command line args
const releaseType = process.argv[2]; // 'alpha', 'beta', or 'production'
if (!['alpha', 'beta', 'production'].includes(releaseType)) {
  console.error('Usage: node cleanup-release.js <alpha|beta|production>');
  process.exit(1);
}

// Get version from package.json
const version = require('../package.json').version;

// Build tag name based on release type
const tagName = releaseType === 'production' ? `v${version}` : `${releaseType}-v${version}`;

console.log(`\n🗑️  Cleaning up ${releaseType} release artifacts for ${tagName}\n`);

let cleaned = false;

// Delete GitHub release
try {
  execSync(`gh release delete ${tagName} --yes`, { stdio: 'inherit' });
  console.log('✅ Deleted GitHub release');
  cleaned = true;
} catch (e) {
  // Release doesn't exist, that's ok
}

// Delete local tag
try {
  execSync(`git tag -d ${tagName}`, { stdio: 'inherit' });
  console.log('✅ Deleted local tag');
  cleaned = true;
} catch (e) {
  // Tag doesn't exist locally, that's ok
}

// Delete remote tag
try {
  execSync(`git push origin :refs/tags/${tagName}`, { stdio: 'ignore' });
  console.log('✅ Deleted remote tag');
  cleaned = true;
} catch (e) {
  // Remote tag doesn't exist, that's ok
}

if (cleaned) {
  console.log(`\n✅ Cleanup complete for ${tagName}\n`);
} else {
  console.log(`\nℹ️  No artifacts found for ${tagName}\n`);
}
