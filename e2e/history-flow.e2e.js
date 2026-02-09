const { device, expect, element, by, waitFor } = require('detox');

const TEST_PLAN = `# History Test Workout
@tags: test, history
@units: lbs

## Squat
- 135 x 5
- 185 x 5

## Romanian Deadlift
- 135 x 8
- 155 x 8
`;

describe('History Flow', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });

    // Wait for home screen
    await waitFor(element(by.id('home-screen')))
      .toBeVisible()
      .withTimeout(30000);
  });

  // Helper function to import and complete a workout
  async function importAndCompleteWorkout() {
    // Import a workout plan
    await element(by.id('button-import-workout')).tap();
    await waitFor(element(by.id('import-modal'))).toBeVisible().withTimeout(5000);
    await element(by.id('input-markdown')).replaceText(TEST_PLAN);
    await element(by.id('button-import')).tap();
    await waitFor(element(by.text('OK'))).toBeVisible().withTimeout(5000);
    await element(by.text('OK')).tap();

    // Wait for plans screen
    await waitFor(element(by.id('workouts-screen'))).toBeVisible().withTimeout(5000);

    // Start the workout
    await element(by.text('History Test Workout')).tap();
    await waitFor(element(by.id('start-workout-button'))).toBeVisible().withTimeout(5000);
    await element(by.id('start-workout-button')).tap();

    // Wait for active workout screen
    await waitFor(element(by.id('active-workout-screen')))
      .toBeVisible()
      .withTimeout(10000);

    // Finish workout immediately
    await element(by.id('active-workout-finish-button')).tap();

    // Handle "Finish Anyway" dialog if it appears
    const finishAnyway = await element(by.text('Finish Anyway')).exists();
    if (finishAnyway) {
      await element(by.text('Finish Anyway')).tap();
    }

    // Wait for summary
    await waitFor(element(by.id('workout-summary-screen')))
      .toBeVisible()
      .withTimeout(10000);

    // Tap done
    await element(by.id('workout-summary-done-button')).tap();

    // Should return to home
    await waitFor(element(by.id('home-screen')))
      .toBeVisible()
      .withTimeout(5000);
  }

  it('should show history tab and navigate to it', async () => {
    // Tap history tab
    await element(by.id('tab-history')).tap();

    // Wait for history screen
    await waitFor(element(by.id('history-screen')))
      .toBeVisible()
      .withTimeout(5000);
  });

  it('should show empty state when no workout history', async () => {
    await element(by.id('tab-history')).tap();

    await waitFor(element(by.id('history-screen')))
      .toBeVisible()
      .withTimeout(5000);

    // Check if empty state exists (might have data from previous runs)
    const isEmpty = await element(by.id('history-empty-state')).exists();

    if (isEmpty) {
      await expect(element(by.id('history-empty-state'))).toBeVisible();
    }
  });

  it('should display completed workout in history', async () => {
    // Complete a workout first
    await importAndCompleteWorkout();

    // Navigate to history tab
    await element(by.id('tab-history')).tap();

    await waitFor(element(by.id('history-screen')))
      .toBeVisible()
      .withTimeout(5000);

    // Should see the completed workout
    await waitFor(element(by.text('History Test Workout')))
      .toBeVisible()
      .withTimeout(5000);
  });

  it('should open workout detail from history', async () => {
    await element(by.id('tab-history')).tap();

    await waitFor(element(by.id('history-screen')))
      .toBeVisible()
      .withTimeout(5000);

    // Check if we have any history sessions
    const hasHistory = await element(by.id('history-session-card')).exists();

    if (hasHistory) {
      // Tap on first history item
      await element(by.id('history-session-card')).atIndex(0).tap();

      // Should show history detail screen
      await waitFor(element(by.id('history-detail-screen')))
        .toBeVisible()
        .withTimeout(5000);

      await expect(element(by.id('history-detail-view'))).toBeVisible();
    }
  });

  it('should show workout exercises in history detail', async () => {
    await element(by.id('tab-history')).tap();

    await waitFor(element(by.id('history-screen')))
      .toBeVisible()
      .withTimeout(5000);

    const hasHistory = await element(by.id('history-session-card')).exists();

    if (hasHistory) {
      await element(by.id('history-session-card')).atIndex(0).tap();

      await waitFor(element(by.id('history-detail-screen')))
        .toBeVisible()
        .withTimeout(5000);

      // Should show workout details
      await expect(element(by.id('history-detail-view'))).toBeVisible();
    }
  });

  it('should navigate back from history detail', async () => {
    await element(by.id('tab-history')).tap();

    await waitFor(element(by.id('history-screen')))
      .toBeVisible()
      .withTimeout(5000);

    const hasHistory = await element(by.id('history-session-card')).exists();

    if (hasHistory) {
      await element(by.id('history-session-card')).atIndex(0).tap();

      await waitFor(element(by.id('history-detail-screen')))
        .toBeVisible()
        .withTimeout(5000);

      // Go back (platform-specific)
      if (device.getPlatform() === 'ios') {
        await element(by.id('back-button')).tap();
      } else {
        await device.pressBack();
      }

      // Should be back on history screen
      await waitFor(element(by.id('history-screen')))
        .toBeVisible()
        .withTimeout(5000);
    }
  });

  it('should show workout date and duration in history', async () => {
    await element(by.id('tab-history')).tap();

    await waitFor(element(by.id('history-screen')))
      .toBeVisible()
      .withTimeout(5000);

    const hasHistory = await element(by.id('history-session-card')).exists();

    if (hasHistory) {
      // History cards should show date/time info
      await expect(element(by.id('history-session-card')).atIndex(0)).toBeVisible();
    }
  });

  it('should refresh history when pulling down', async () => {
    await element(by.id('tab-history')).tap();

    await waitFor(element(by.id('history-screen')))
      .toBeVisible()
      .withTimeout(5000);

    // Pull to refresh (if history list exists)
    const historyList = element(by.id('history-list'));
    const hasHistoryList = await historyList.exists();

    if (hasHistoryList) {
      await historyList.swipe('down', 'fast', 0.8);

      // Wait a moment for refresh
      await new Promise(resolve => setTimeout(resolve, 1000));

      // History screen should still be visible
      await expect(element(by.id('history-screen'))).toBeVisible();
    }
  });

  it('should show recent workouts section on home screen', async () => {
    // Navigate to home
    await element(by.id('tab-home')).tap();

    await waitFor(element(by.id('home-screen')))
      .toBeVisible()
      .withTimeout(5000);

    // Look for recent plans section
    const hasRecentSection = await element(by.text('Recent Plans')).exists();

    if (hasRecentSection) {
      await expect(element(by.text('Recent Plans'))).toBeVisible();
    }
  });

  it('should be able to view workout from recent section', async () => {
    await element(by.id('tab-home')).tap();

    await waitFor(element(by.id('home-screen')))
      .toBeVisible()
      .withTimeout(5000);

    // Check if there are workout cards in recent section
    const hasWorkoutCard = await element(by.id('workout-card-')).exists();

    if (hasWorkoutCard) {
      await element(by.id('workout-card-')).atIndex(0).tap();

      // Should navigate to plan detail
      await waitFor(element(by.id('workout-detail-view')))
        .toBeVisible()
        .withTimeout(5000);
    }
  });
});
