const { device, expect, element, by, waitFor } = require('detox');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const SAMPLE_WORKOUT = `# Share Target Test
@tags: test
@units: lbs

## Bench Press
- 135 x 5
- 185 x 5
- 225 x 3

## Overhead Press
- 95 x 8
- 115 x 6
`;

describe('Share Target Import', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });

    try {
      await waitFor(element(by.id('home-screen')))
        .toBeVisible()
        .withTimeout(30000);
    } catch (error) {
      await waitFor(element(by.id('max-lift-squat')))
        .toBeVisible()
        .withTimeout(5000);
    }
  });

  it('should import a workout via liftmark:// deep link', async () => {
    // Get the app container path for the running simulator
    const appDataDir = execSync(
      'xcrun simctl get_app_container booted com.eff3.liftmark data'
    ).toString().trim();

    // Write test file into the app's Documents/Inbox (where iOS places shared files)
    const inboxDir = path.join(appDataDir, 'Documents', 'Inbox');
    fs.mkdirSync(inboxDir, { recursive: true });
    const testFile = path.join(inboxDir, 'share-target-test.md');
    fs.writeFileSync(testFile, SAMPLE_WORKOUT);

    // Simulate iOS "Open In" by sending a liftmark:// URL
    const urlPath = testFile.replace(/^\//, '');
    await device.openURL({ url: `liftmark://${urlPath}` });

    // The +not-found route should catch this and redirect to the import modal
    await waitFor(element(by.id('input-markdown')))
      .toBeVisible()
      .withTimeout(10000);

    // Tap Import
    await element(by.id('button-import')).tap();

    // Wait for success dialog and dismiss
    await waitFor(element(by.text('OK')))
      .toBeVisible()
      .withTimeout(10000);
    await element(by.text('OK')).tap();

    // Verify the plan appears on the home screen
    await waitFor(element(by.text('Share Target Test')))
      .toBeVisible()
      .withTimeout(10000);
  });
});
