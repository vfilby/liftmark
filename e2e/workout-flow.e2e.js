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
    await waitFor(element(by.id('home-screen')))
      .toBeVisible()
      .withTimeout(10000);

    await element(by.id('button-view-workouts')).tap();

    await waitFor(element(by.id('workouts-screen')))
      .toBeVisible()
      .withTimeout(10000);

    const isEmpty = await element(by.id('empty-state')).exists();

    if (isEmpty) {
      await element(by.id('button-import-empty')).tap();

      await waitFor(element(by.id('import-modal')))
        .toBeVisible()
        .withTimeout(10000);

      await element(by.id('input-markdown')).replaceText(SAMPLE_WORKOUT);
      await element(by.id('button-import')).tap();

      await waitFor(element(by.text('OK')))
        .toBeVisible()
        .withTimeout(10000);

      await element(by.text('OK')).tap();
    }

    await waitFor(element(by.id('workout-list')))
      .toBeVisible()
      .withTimeout(10000);

    await element(by.id('workout-card-index-0')).tap();

    await waitFor(element(by.id('workout-detail-view')))
      .toBeVisible()
      .withTimeout(10000);

    await expect(element(by.id('start-workout-button'))).toBeVisible();
    await element(by.id('start-workout-button')).tap();

    await waitFor(element(by.id('active-workout-screen')))
      .toBeVisible()
      .withTimeout(10000);

    await expect(element(by.id('active-workout-progress'))).toBeVisible();
    await element(by.id('active-workout-finish-button')).tap();

    const canFinishAnyway = await element(by.text('Finish Anyway')).exists();
    if (canFinishAnyway) {
      await element(by.text('Finish Anyway')).tap();
    }

    await waitFor(element(by.id('workout-summary-screen')))
      .toBeVisible()
      .withTimeout(10000);

    await expect(element(by.id('workout-summary-done-button'))).toBeVisible();
    await element(by.id('workout-summary-done-button')).tap();

    await waitFor(element(by.id('home-screen')))
      .toBeVisible()
      .withTimeout(10000);
  });
});
