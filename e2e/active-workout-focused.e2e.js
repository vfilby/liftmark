const { device, expect, element, by, waitFor } = require('detox');

const WORKOUT_PLAN = `# Active Workout Test
@tags: test, e2e
@units: lbs

## Bench Press
- 135 x 5 @rest:90
- 155 x 5 @rest:90
- 175 x 3

## Dumbbell Row
- 50 x 10
- 60 x 10
`;

describe('Active Workout - Focused Flow', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });

    // Wait for app to load
    try {
      await waitFor(element(by.id('home-screen')))
        .toBeVisible()
        .withTimeout(30000);
    } catch (error) {
      await waitFor(element(by.id('stat-workouts')))
        .toBeVisible()
        .withTimeout(5000);
    }

    // Import the test workout plan
    await waitFor(element(by.id('button-import-workout')))
      .toBeVisible()
      .withTimeout(5000);
    await element(by.id('button-import-workout')).tap();

    // Wait for input field
    await waitFor(element(by.id('input-markdown')))
      .toBeVisible()
      .withTimeout(10000);

    await element(by.id('input-markdown')).replaceText(WORKOUT_PLAN);
    await element(by.id('button-import')).tap();

    await waitFor(element(by.text('OK')))
      .toBeVisible()
      .withTimeout(10000);
    await element(by.text('OK')).tap();

    // Wait for plan to appear
    await waitFor(element(by.text('Active Workout Test')))
      .toBeVisible()
      .withTimeout(10000);
  });

  it('should start a workout and show active workout screen', async () => {
    // Tap on the workout plan in Recent Plans
    await element(by.text('Active Workout Test')).tap();

    // Wait for start button
    await waitFor(element(by.id('start-workout-button')))
      .toBeVisible()
      .withTimeout(5000);

    // Start the workout
    await element(by.id('start-workout-button')).tap();

    // Should show active workout screen with workout name
    await waitFor(element(by.text('Active Workout Test')))
      .toBeVisible()
      .withTimeout(10000);

    // Should show first exercise
    await waitFor(element(by.text('Bench Press')))
      .toBeVisible()
      .withTimeout(5000);

    // Should show active workout progress indicator
    await waitFor(element(by.id('active-workout-progress')))
      .toBeVisible()
      .withTimeout(5000);
  });

  it('should show set information', async () => {
    // Should show weight and reps information
    await waitFor(element(by.text('135')))
      .toBeVisible()
      .withTimeout(5000);
  });

  it('should have finish workout button', async () => {
    await waitFor(element(by.id('active-workout-finish-button')))
      .toBeVisible()
      .withTimeout(5000);
  });

  it('should finish workout and show summary', async () => {
    // Tap finish workout button
    await element(by.id('active-workout-finish-button')).tap();

    // Handle incomplete warning if it appears
    try {
      await waitFor(element(by.text('Finish Anyway')))
        .toBeVisible()
        .withTimeout(3000);
      await element(by.text('Finish Anyway')).tap();
    } catch (error) {
      // No warning appeared, continue
    }

    // Should show workout summary with done button
    await waitFor(element(by.id('workout-summary-done-button')))
      .toBeVisible()
      .withTimeout(10000);
  });

  it('should navigate home from summary', async () => {
    // Tap done button
    await element(by.id('workout-summary-done-button')).tap();

    // Should return to home - verify by checking for import button
    await waitFor(element(by.id('button-import-workout')))
      .toBeVisible()
      .withTimeout(10000);
  });

  it('should show completed workout in history', async () => {
    // Navigate to history tab
    await element(by.id('tab-history')).tap();

    await waitFor(element(by.id('history-screen')))
      .toBeVisible()
      .withTimeout(5000);

    // Should see the completed workout
    await waitFor(element(by.text('Active Workout Test')))
      .toBeVisible()
      .withTimeout(5000);
  });
});
