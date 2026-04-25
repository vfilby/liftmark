// Attaches the just-uploaded build to a named TestFlight group.
// Used by release-pipeline.yml immediately after xcodebuild -exportArchive upload.
//
// TestFlight processing is async — the build appears in the API in "PROCESSING" state
// for a few minutes before becoming "VALID" and attachable to a group. We poll.
//
// Env:
//   APP_BUNDLE_ID, MARKETING_VERSION, BUILD_NUMBER, TESTFLIGHT_GROUP_NAME
//   ASC_* (via asc-client)

import { required, getAppId, getBuild, getGroupId, attachBuildToGroup } from './asc-client.mjs';

const TIMEOUT_MIN = 30;
const POLL_INTERVAL_SEC = 30;

async function main() {
  const bundleId = required('APP_BUNDLE_ID');
  const version = required('MARKETING_VERSION');
  const buildNumber = required('BUILD_NUMBER');
  const groupName = required('TESTFLIGHT_GROUP_NAME');

  const appId = await getAppId(bundleId);
  const groupId = await getGroupId(appId, groupName);

  const deadline = Date.now() + TIMEOUT_MIN * 60_000;
  let build;
  while (Date.now() < deadline) {
    build = await getBuild(appId, { version, buildNumber });
    if (build && build.processingState === 'VALID') break;
    console.log(`Build ${version} (${buildNumber}) state: ${build?.processingState ?? 'not yet visible'} — waiting ${POLL_INTERVAL_SEC}s`);
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_SEC * 1000));
  }

  if (!build || build.processingState !== 'VALID') {
    throw new Error(`Build did not reach VALID state within ${TIMEOUT_MIN} min; last state: ${build?.processingState}`);
  }

  await attachBuildToGroup(build.id, groupId);
  console.log(`Attached build ${version} (${buildNumber}) to group "${groupName}"`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
