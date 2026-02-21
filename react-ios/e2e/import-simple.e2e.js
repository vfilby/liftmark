const { device, expect, element, by, waitFor } = require('detox');

const SAMPLE_PLAN = `# Test Workout
@tags: test
@units: lbs

## Bench Press
- 135 x 5
- 155 x 5

## Squat
- 185 x 5
- 205 x 5
`;

describe('Simple Import Test', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });

    try {
      await waitFor(element(by.id('home-screen')))
        .toBeVisible()
        .withTimeout(30000);
    } catch (error) {
      await waitFor(element(by.id('max-lift-tile-0')))
        .toBeVisible()
        .withTimeout(5000);
    }
  });

  it('should import a workout plan', async () => {
    // Wait for and tap import button
    await waitFor(element(by.id('button-import-workout')))
      .toBeVisible()
      .withTimeout(5000);

    await element(by.id('button-import-workout')).tap();

    // Wait for the markdown input field (more reliable than waiting for modal container)
    await waitFor(element(by.id('input-markdown')))
      .toBeVisible()
      .withTimeout(10000);

    // Fill in the markdown
    await element(by.id('input-markdown')).replaceText(SAMPLE_PLAN);

    // Tap import
    await element(by.id('button-import')).tap();

    // Wait for success dialog
    await waitFor(element(by.text('OK')))
      .toBeVisible()
      .withTimeout(10000);

    // Tap OK
    await element(by.text('OK')).tap();

    // Verify the plan appears in Recent Plans section (implicitly confirms we're back on home)
    await waitFor(element(by.text('Test Workout')))
      .toBeVisible()
      .withTimeout(10000);
  });
});
