const { device, expect, element, by, waitFor } = require('detox');

const SAMPLE_WORKOUT = `# Detox Flow Workout
@tags: e2e, detox
@units: lbs

## Bench Press
- 135 x 5
- 135 x 5

## Plank
- 30s
`;

describe('Workout flow screens', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
  });

  it('covers workout detail, active workout, and summary flows', async () => {
    // Wait for home screen with fallback
    try {
      await waitFor(element(by.id('home-screen')))
        .toBeVisible()
        .withTimeout(30000);
    } catch (error) {
      await waitFor(element(by.id('max-lift-tile-0')))
        .toBeVisible()
        .withTimeout(5000);
    }

    // Go back to home and import from there (more reliable)
    await element(by.id('tab-home')).tap();
    await new Promise(resolve => setTimeout(resolve, 500));

    // Import the workout from home screen
    await waitFor(element(by.id('button-import-workout')))
      .toBeVisible()
      .withTimeout(5000);
    await element(by.id('button-import-workout')).tap();

    // Wait for input field, not modal container
    await waitFor(element(by.id('input-markdown')))
      .toBeVisible()
      .withTimeout(10000);

    await element(by.id('input-markdown')).replaceText(SAMPLE_WORKOUT);
    await element(by.id('button-import')).tap();

    await waitFor(element(by.text('OK')))
      .toBeVisible()
      .withTimeout(10000);
    await element(by.text('OK')).tap();

    // Wait for workout to appear in recent plans
    await waitFor(element(by.text('Detox Flow Workout')))
      .toBeVisible()
      .withTimeout(10000);

    // Tap on the workout by name
    await element(by.text('Detox Flow Workout')).tap();

    // Wait for start button instead of detail view container
    await waitFor(element(by.id('start-workout-button')))
      .toBeVisible()
      .withTimeout(10000);

    await element(by.id('start-workout-button')).tap();

    // Wait for active workout screen by progress indicator
    await waitFor(element(by.id('active-workout-progress')))
      .toBeVisible()
      .withTimeout(10000);

    await waitFor(element(by.id('active-workout-finish-button')))
      .toBeVisible()
      .withTimeout(5000);
    await element(by.id('active-workout-finish-button')).tap();

    // Handle finish anyway dialog if present
    try {
      await waitFor(element(by.text('Finish Anyway')))
        .toBeVisible()
        .withTimeout(3000);
      await element(by.text('Finish Anyway')).tap();
    } catch (error) {
      // No dialog appeared
    }

    // Wait for summary done button instead of summary screen container
    await waitFor(element(by.id('workout-summary-done-button')))
      .toBeVisible()
      .withTimeout(10000);

    await element(by.id('workout-summary-done-button')).tap();

    // Wait for home with fallback
    try {
      await waitFor(element(by.id('home-screen')))
        .toBeVisible()
        .withTimeout(10000);
    } catch (error) {
      await waitFor(element(by.id('button-import-workout')))
        .toBeVisible()
        .withTimeout(5000);
    }
  });
});
