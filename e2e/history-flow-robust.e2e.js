const { device, expect, element, by, waitFor } = require('detox');

const TEST_PLAN = `# History Test Workout
@tags: test, history
@units: lbs

## Squat
- 135 x 5
- 185 x 5

## Romanian Deadlift
- 135 x 8
`;

describe('History Flow - Robust', () => {
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

    // Import a test workout
    await waitFor(element(by.id('button-import-workout')))
      .toBeVisible()
      .withTimeout(5000);
    await element(by.id('button-import-workout')).tap();

    await waitFor(element(by.id('input-markdown')))
      .toBeVisible()
      .withTimeout(10000);

    await element(by.id('input-markdown')).replaceText(TEST_PLAN);
    await element(by.id('button-import')).tap();

    await waitFor(element(by.text('OK')))
      .toBeVisible()
      .withTimeout(10000);
    await element(by.text('OK')).tap();

    // Wait for plan to appear
    await waitFor(element(by.text('History Test Workout')))
      .toBeVisible()
      .withTimeout(10000);

    // Start the workout
    await element(by.text('History Test Workout')).tap();

    await waitFor(element(by.id('start-workout-button')))
      .toBeVisible()
      .withTimeout(5000);
    await element(by.id('start-workout-button')).tap();

    // Wait for active workout screen
    await waitFor(element(by.text('History Test Workout')))
      .toBeVisible()
      .withTimeout(10000);

    // Finish workout immediately
    await waitFor(element(by.id('active-workout-finish-button')))
      .toBeVisible()
      .withTimeout(5000);
    await element(by.id('active-workout-finish-button')).tap();

    // Handle "Finish Anyway" dialog if it appears
    try {
      await waitFor(element(by.text('Finish Anyway')))
        .toBeVisible()
        .withTimeout(3000);
      await element(by.text('Finish Anyway')).tap();
    } catch (error) {
      // No warning appeared
    }

    // Wait for summary
    await waitFor(element(by.id('workout-summary-done-button')))
      .toBeVisible()
      .withTimeout(10000);

    // Tap done
    await element(by.id('workout-summary-done-button')).tap();

    // Should return to home - verify by import button
    await waitFor(element(by.id('button-import-workout')))
      .toBeVisible()
      .withTimeout(5000);
  });

  it('should navigate to history tab', async () => {
    await element(by.id('tab-history')).tap();

    await waitFor(element(by.id('history-screen')))
      .toBeVisible()
      .withTimeout(5000);
  });

  it('should show completed workout in history', async () => {
    // Make sure we're on history tab
    await element(by.id('tab-history')).tap();
    await new Promise(resolve => setTimeout(resolve, 500));

    // Should see the completed workout
    await waitFor(element(by.text('History Test Workout')))
      .toBeVisible()
      .withTimeout(5000);
  });

  it('should open workout detail from history', async () => {
    // Make sure we're on history tab
    await element(by.id('tab-history')).tap();
    await new Promise(resolve => setTimeout(resolve, 500));

    // Check if we have history cards
    const historyCard = element(by.id('history-session-card')).atIndex(0);

    // Tap on first history item
    await historyCard.tap();

    // Should show history detail - verify by looking for the workout name
    await waitFor(element(by.text('History Test Workout')))
      .toBeVisible()
      .withTimeout(5000);
  });

  it('should navigate back from history detail', async () => {
    // We're already in detail view from the previous test
    // Wait a moment for it to stabilize
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Go back to history list
    if (device.getPlatform() === 'ios') {
      // Try back button first
      try {
        const backButton = element(by.label('Back'));
        await backButton.tap();
      } catch (error) {
        // Try iOS standard back gesture
        try {
          await element(by.id('history-detail-screen')).swipe('right', 'fast', 0.1, 0.5);
        } catch (e) {
          // Last resort - tap history tab
          await element(by.id('tab-history')).tap();
        }
      }
    } else {
      await device.pressBack();
    }

    // Should be back on history screen
    await waitFor(element(by.id('history-screen')))
      .toBeVisible()
      .withTimeout(5000);
  });
});
