const { device, expect, element, by, waitFor } = require('detox');

const SAMPLE_PLAN = `# Test Workout Via Workouts
@tags: test
@units: lbs

## Bench Press
- 135 x 5

## Squat
- 185 x 5
`;

describe('Import Via Workouts Tab', () => {
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

  it('should navigate to workouts tab', async () => {
    // Tap the workouts tab
    await element(by.id('tab-workouts')).tap();

    // Should be on workouts screen
    await waitFor(element(by.id('workouts-screen')))
      .toBeVisible()
      .withTimeout(5000);
  });
});
