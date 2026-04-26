// Manually promote a specific build to Pre-flight (or any external group).
// Bypasses Beta-group / soak / Sentry gates — the operator owns the decision.
// Refuses to promote a build older than the newest already in the target group
// (downgrade guard). Override with FORCE=true.
//
// Env:
//   APP_BUNDLE_ID, TARGET_GROUP_NAME, BUILD_NUMBER
//   VERSION  (optional; marketing version, e.g. '1.0.109' — disambiguates if multiple
//             builds share the same buildNumber across versions)
//   FORCE    ('true' to skip downgrade guard)
//   DRY_RUN  ('true' evaluates without promoting)
//   ASC_*    (via asc-client)

import {
  required,
  getAppId,
  getBuild,
  getGroupId,
  listBuildsInGroup,
  attachBuildToGroup,
  submitForBetaReview,
} from './asc-client.mjs';

async function main() {
  const bundleId = required('APP_BUNDLE_ID');
  const targetName = required('TARGET_GROUP_NAME');
  const buildNumber = required('BUILD_NUMBER');
  const version = process.env.VERSION || undefined;
  const force = process.env.FORCE === 'true';
  const dryRun = process.env.DRY_RUN === 'true';

  const appId = await getAppId(bundleId);
  const build = await getBuild(appId, { version, buildNumber });
  if (!build) {
    throw new Error(`No build found with buildNumber=${buildNumber}${version ? ` version=${version}` : ''}`);
  }
  console.log(`Found build ${build.buildNumber} (${build.version}) — id=${build.id}, processingState=${build.processingState}, uploadedAt=${build.uploadedAt}`);
  if (build.processingState && build.processingState !== 'VALID') {
    throw new Error(`Build is in processingState=${build.processingState}; refusing to promote.`);
  }

  const targetGroupId = await getGroupId(appId, targetName);
  const targetBuilds = await listBuildsInGroup(appId, targetName);

  if (targetBuilds.some((b) => b.id === build.id)) {
    console.log(`Build ${build.buildNumber} is already in ${targetName}.`);
    return;
  }

  const maxTargetBuildNumber = targetBuilds.reduce(
    (max, b) => Math.max(max, Number(b.buildNumber) || 0),
    0,
  );
  const candidate = Number(build.buildNumber);
  if (!force && candidate <= maxTargetBuildNumber) {
    throw new Error(
      `Downgrade guard: build ${candidate} is not newer than ${targetName}'s latest (${maxTargetBuildNumber}). Set FORCE=true to override.`,
    );
  }

  if (dryRun) {
    console.log(`DRY RUN: would attach build ${build.buildNumber} (id=${build.id}) to ${targetName} and submit for Beta App Review.`);
    return;
  }

  await attachBuildToGroup(build.id, targetGroupId);
  await submitForBetaReview(build.id);
  console.log(`Promoted build ${build.buildNumber} to ${targetName} and submitted for Beta App Review.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
