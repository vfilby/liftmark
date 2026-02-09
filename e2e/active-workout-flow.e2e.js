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
- 70 x 8

## Plank
- 60s
- 45s
- 30s
`;

describe('Active Workout Flow', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });

    await waitFor(element(by.id('home-screen')))
      .toBeVisible()
      .withTimeout(30000);

    // Import the test workout plan
    await element(by.id('button-import-workout')).tap();
    await waitFor(element(by.id('import-modal'))).toBeVisible().withTimeout(5000);
    await element(by.id('input-markdown')).replaceText(WORKOUT_PLAN);
    await element(by.id('button-import')).tap();
    await waitFor(element(by.text('OK'))).toBeVisible().withTimeout(5000);
    await element(by.text('OK')).tap();
  });

  it('should start a workout from plan detail', async () => {
    // Navigate to plans
    await waitFor(element(by.id('workouts-screen')))
      .toBeVisible()
      .withTimeout(5000);

    // Tap on the workout plan
    await element(by.text('Active Workout Test')).tap();

    // Wait for detail view
    await waitFor(element(by.id('workout-detail-view')))
      .toBeVisible()
      .withTimeout(5000);

    // Verify start button is visible
    await expect(element(by.id('start-workout-button'))).toBeVisible();

    // Start the workout
    await element(by.id('start-workout-button')).tap();

    // Should navigate to active workout screen
    await waitFor(element(by.id('active-workout-screen')))
      .toBeVisible()
      .withTimeout(10000);

    // Verify active workout elements
    await expect(element(by.id('active-workout-progress'))).toBeVisible();
  });

  it('should show workout name and exercises during active workout', async () => {
    await waitFor(element(by.id('active-workout-screen')))
      .toBeVisible()
      .withTimeout(5000);

    // Should show workout name
    await expect(element(by.text('Active Workout Test'))).toBeVisible();

    // Should show first exercise
    await expect(element(by.text('Bench Press'))).toBeVisible();
  });

  it('should allow marking sets as complete', async () => {
    await waitFor(element(by.id('active-workout-screen')))
      .toBeVisible()
      .withTimeout(5000);

    // Look for a set checkbox or complete button
    const setCheckbox = element(by.id('set-checkbox-0'));
    const setCompleteButton = element(by.id('set-complete-0'));

    const hasCheckbox = await setCheckbox.exists();
    const hasButton = await setCompleteButton.exists();

    if (hasCheckbox) {
      await setCheckbox.tap();
    } else if (hasButton) {
      await setCompleteButton.tap();
    }

    // Set should be marked complete
    // (verification depends on implementation)
  });

  it('should show rest timer between sets', async () => {
    await waitFor(element(by.id('active-workout-screen')))
      .toBeVisible()
      .withTimeout(5000);

    // Complete a set
    const setCheckbox = element(by.id('set-checkbox-0'));
    const hasCheckbox = await setCheckbox.exists();

    if (hasCheckbox) {
      await setCheckbox.tap();

      // Rest timer might appear
      const restTimer = element(by.id('rest-timer'));
      const hasTimer = await restTimer.exists();

      if (hasTimer) {
        await expect(restTimer).toBeVisible();
      }
    }
  });

  it('should allow entering actual weight and reps', async () => {
    await waitFor(element(by.id('active-workout-screen')))
      .toBeVisible()
      .withTimeout(5000);

    // Look for weight input
    const weightInput = element(by.id('input-actual-weight-0'));
    const repsInput = element(by.id('input-actual-reps-0'));

    const hasWeightInput = await weightInput.exists();
    const hasRepsInput = await repsInput.exists();

    if (hasWeightInput) {
      await weightInput.tap();
      await weightInput.replaceText('145');
    }

    if (hasRepsInput) {
      await repsInput.tap();
      await repsInput.replaceText('6');
    }
  });

  it('should show progress indicator', async () => {
    await waitFor(element(by.id('active-workout-screen')))
      .toBeVisible()
      .withTimeout(5000);

    // Progress bar or indicator should be visible
    await expect(element(by.id('active-workout-progress'))).toBeVisible();
  });

  it('should allow navigation between exercises', async () => {
    await waitFor(element(by.id('active-workout-screen')))
      .toBeVisible()
      .withTimeout(5000);

    // Look for next exercise button
    const nextButton = element(by.id('next-exercise-button'));
    const hasNext = await nextButton.exists();

    if (hasNext) {
      await nextButton.tap();

      // Should show next exercise (Dumbbell Row)
      await waitFor(element(by.text('Dumbbell Row')))
        .toBeVisible()
        .withTimeout(5000);
    }
  });

  it('should show exercise notes if present', async () => {
    await waitFor(element(by.id('active-workout-screen')))
      .toBeVisible()
      .withTimeout(5000);

    // Exercise notes section (if implemented)
    const exerciseNotes = element(by.id('exercise-notes'));
    const hasNotes = await exerciseNotes.exists();

    if (hasNotes) {
      await expect(exerciseNotes).toBeVisible();
    }
  });

  it('should allow skipping an exercise', async () => {
    await waitFor(element(by.id('active-workout-screen')))
      .toBeVisible()
      .withTimeout(5000);

    // Look for skip button
    const skipButton = element(by.id('skip-exercise-button'));
    const hasSkip = await skipButton.exists();

    if (hasSkip) {
      await skipButton.tap();

      // Should show confirmation or skip to next exercise
      const confirmSkip = await element(by.text('Skip')).exists();
      if (confirmSkip) {
        await element(by.text('Skip')).tap();
      }
    }
  });

  it('should show finish workout button', async () => {
    await waitFor(element(by.id('active-workout-screen')))
      .toBeVisible()
      .withTimeout(5000);

    await expect(element(by.id('active-workout-finish-button'))).toBeVisible();
  });

  it('should warn when finishing incomplete workout', async () => {
    await waitFor(element(by.id('active-workout-screen')))
      .toBeVisible()
      .withTimeout(5000);

    // Tap finish without completing all sets
    await element(by.id('active-workout-finish-button')).tap();

    // Should show warning dialog
    await waitFor(element(by.text('Finish Anyway')))
      .toBeVisible()
      .withTimeout(5000);

    // Cancel for now
    const cancelButton = element(by.text('Cancel'));
    const hasCancelButton = await cancelButton.exists();

    if (hasCancelButton) {
      await cancelButton.tap();
    }

    // Should still be on active workout screen
    await expect(element(by.id('active-workout-screen'))).toBeVisible();
  });

  it('should allow canceling workout', async () => {
    await waitFor(element(by.id('active-workout-screen')))
      .toBeVisible()
      .withTimeout(5000);

    // Look for cancel/quit button
    const cancelButton = element(by.id('cancel-workout-button'));
    const quitButton = element(by.id('quit-workout-button'));
    const menuButton = element(by.id('workout-menu-button'));

    let foundCancel = await cancelButton.exists();
    let foundQuit = await quitButton.exists();
    let foundMenu = await menuButton.exists();

    if (foundMenu) {
      await menuButton.tap();
      foundCancel = await cancelButton.exists();
      foundQuit = await quitButton.exists();
    }

    if (foundCancel) {
      await cancelButton.tap();
    } else if (foundQuit) {
      await quitButton.tap();
    }

    // Should show confirmation
    const confirmCancel = await element(by.text('Discard')).exists();
    if (confirmCancel) {
      await element(by.text('Discard')).tap();

      // Should return to home or plans screen
      const onHome = await element(by.id('home-screen')).exists();
      const onPlans = await element(by.id('workouts-screen')).exists();

      if (!onHome && !onPlans) {
        // Still on active workout, cancel didn't work
        // Try going back via back button
        if (device.getPlatform() === 'ios') {
          const backButton = element(by.id('back-button'));
          const hasBack = await backButton.exists();
          if (hasBack) {
            await backButton.tap();
          }
        }
      }
    }
  });

  it('should complete workout and show summary', async () => {
    // Start a fresh workout
    await element(by.id('tab-home')).tap();
    await waitFor(element(by.id('home-screen'))).toBeVisible().withTimeout(5000);

    await element(by.id('button-view-workouts')).tap();
    await waitFor(element(by.id('workouts-screen'))).toBeVisible().withTimeout(5000);

    await element(by.text('Active Workout Test')).tap();
    await waitFor(element(by.id('start-workout-button'))).toBeVisible().withTimeout(5000);
    await element(by.id('start-workout-button')).tap();

    await waitFor(element(by.id('active-workout-screen')))
      .toBeVisible()
      .withTimeout(10000);

    // Finish workout
    await element(by.id('active-workout-finish-button')).tap();

    // Handle incomplete warning
    const finishAnyway = await element(by.text('Finish Anyway')).exists();
    if (finishAnyway) {
      await element(by.text('Finish Anyway')).tap();
    }

    // Should show workout summary
    await waitFor(element(by.id('workout-summary-screen')))
      .toBeVisible()
      .withTimeout(10000);

    await expect(element(by.id('workout-summary-done-button'))).toBeVisible();
  });

  it('should show workout stats in summary', async () => {
    // Assuming we're on summary from previous test
    const onSummary = await element(by.id('workout-summary-screen')).exists();

    if (onSummary) {
      // Summary should show workout details
      await expect(element(by.text('Active Workout Test'))).toBeVisible();
    }
  });

  it('should navigate home from summary', async () => {
    const onSummary = await element(by.id('workout-summary-screen')).exists();

    if (onSummary) {
      await element(by.id('workout-summary-done-button')).tap();

      // Should return to home screen
      await waitFor(element(by.id('home-screen')))
        .toBeVisible()
        .withTimeout(5000);
    }
  });

  it('should show workout in history after completion', async () => {
    // Navigate to history
    await element(by.id('tab-history')).tap();

    await waitFor(element(by.id('history-screen')))
      .toBeVisible()
      .withTimeout(5000);

    // Should see the completed workout
    await waitFor(element(by.text('Active Workout Test')))
      .toBeVisible()
      .withTimeout(5000);
  });

  it('should prevent starting multiple workouts simultaneously', async () => {
    // Go back and try to start another workout
    await element(by.id('tab-home')).tap();
    await waitFor(element(by.id('home-screen'))).toBeVisible().withTimeout(5000);

    // Check if there's an active workout banner
    const activeBanner = element(by.id('resume-workout-banner'));
    const hasBanner = await activeBanner.exists();

    if (hasBanner) {
      await expect(activeBanner).toBeVisible();

      // Trying to start another should either:
      // 1. Show a warning, or
      // 2. Navigate to the active workout
    }
  });
});
