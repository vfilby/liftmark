// Submits an existing TestFlight build to App Store review.
// No rebuild — ASC lets us take a build that's already processed and submit it.
//
// Env:
//   APP_BUNDLE_ID, BUILD_NUMBER
//   RELEASE_NOTES (optional, What's New in this version)
//   AUTO_RELEASE ('true' = release on approval, 'false' = hold for manual)
//   PHASED_RELEASE ('true' = 7-day gradual rollout)
//   ASC_* (via asc-client)

import { required, getAppId, getBuild, submitForAppStoreReview } from './asc-client.mjs';

async function main() {
  const bundleId = required('APP_BUNDLE_ID');
  const buildNumber = required('BUILD_NUMBER');
  const autoRelease = process.env.AUTO_RELEASE === 'true';
  const phasedRelease = process.env.PHASED_RELEASE !== 'false';
  const releaseNotes = process.env.RELEASE_NOTES || '';

  const appId = await getAppId(bundleId);
  // Look up by buildNumber alone — version is implicit per build.
  const build = await getBuild(appId, { buildNumber });
  if (!build) throw new Error(`Build ${buildNumber} not found in TestFlight`);
  if (build.processingState !== 'VALID') {
    throw new Error(`Build ${buildNumber} is in state ${build.processingState}; must be VALID before submission`);
  }

  await submitForAppStoreReview(build.id, { autoRelease, phasedRelease, releaseNotes });
  console.log(`Submitted build ${buildNumber} (${build.version}) to App Store review`);
  console.log(`  auto-release: ${autoRelease}`);
  console.log(`  phased release: ${phasedRelease}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
