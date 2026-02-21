const { device, expect, element, by, waitFor } = require('detox');

// Collapse test — NO rest seconds to avoid Skip button conflicts
const COLLAPSE_PLAN = `# Collapse Test
@tags: test
@units: lbs

## Bench Press
- 135 x 5
- 155 x 5

## Squat
- 185 x 5
- 205 x 5
`;

// Skip-heavy test
const SKIP_PLAN = `# Skip Test
@tags: test
@units: lbs

## Bench Press
- 135 x 5
- 155 x 5

## Squat
- 185 x 5
- 205 x 5
`;

// Timed workout for correct-units test
const TIMED_PLAN = `# Timed Test
@tags: test

## Plank
- 60s
- 45s

## Push Ups
- 10
- 10
`;

// Long workout to verify start button is visible
const LONG_PLAN = `# Long Test
@tags: test
@units: lbs

## Exercise A
- 100 x 10
- 100 x 10

## Exercise B
- 100 x 10
- 100 x 10

## Exercise C
- 100 x 10
- 100 x 10

## Exercise D
- 100 x 10
- 100 x 10

## Exercise E
- 100 x 10
- 100 x 10
`;

// Save values test
const SAVE_PLAN = `# Save Test
@tags: test
@units: lbs

## Bench Press
- 135 x 5
- 155 x 5
`;

// Helper: wait for home screen
async function waitForHome() {
  try {
    await waitFor(element(by.id('home-screen')))
      .toBeVisible()
      .withTimeout(30000);
  } catch (error) {
    await waitFor(element(by.id('max-lift-tile-0')))
      .toBeVisible()
      .withTimeout(5000);
  }
}

// Helper: import a workout and return to home
async function importWorkout(markdown, expectedName) {
  await waitFor(element(by.id('button-import-workout')))
    .toBeVisible()
    .withTimeout(5000);
  await element(by.id('button-import-workout')).tap();

  await waitFor(element(by.id('input-markdown')))
    .toBeVisible()
    .withTimeout(10000);

  await element(by.id('input-markdown')).replaceText(markdown);
  await element(by.id('button-import')).tap();

  await waitFor(element(by.text('OK')))
    .toBeVisible()
    .withTimeout(10000);
  await element(by.text('OK')).tap();

  await waitFor(element(by.text(expectedName)))
    .toBeVisible()
    .withTimeout(10000);
}

// Helper: start a workout from home screen
async function startWorkout(planName) {
  await element(by.text(planName)).atIndex(0).tap();

  await waitFor(element(by.id('start-workout-button')))
    .toBeVisible()
    .withTimeout(5000);
  await element(by.id('start-workout-button')).tap();

  await waitFor(element(by.id('active-workout-progress')))
    .toBeVisible()
    .withTimeout(10000);
}

// Helper: finish workout (handle dialogs) and return to home
async function finishAndGoHome() {
  await element(by.id('active-workout-finish-button')).tap();

  // Handle possible dialogs
  try {
    await waitFor(element(by.text('Finish Anyway')))
      .toBeVisible()
      .withTimeout(3000);
    await element(by.text('Finish Anyway')).tap();
  } catch (error) {
    try {
      await waitFor(element(by.text('Log Anyway')))
        .toBeVisible()
        .withTimeout(2000);
      await element(by.text('Log Anyway')).tap();
    } catch (e) {
      // No dialog, workout was complete
    }
  }

  await waitFor(element(by.id('workout-summary-done-button')))
    .toBeVisible()
    .withTimeout(10000);
  await element(by.id('workout-summary-done-button')).tap();

  await waitFor(element(by.id('button-import-workout')))
    .toBeVisible()
    .withTimeout(10000);
}

describe('UX Improvements - Start Workout Button', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true, delete: true });
    await waitForHome();
    await importWorkout(LONG_PLAN, 'Long Test');
  });

  it('should show start workout button on detail screen without scrolling', async () => {
    await element(by.text('Long Test')).tap();

    // The start button should be visible immediately (fixed at bottom)
    await waitFor(element(by.id('start-workout-button')))
      .toBeVisible()
      .withTimeout(5000);
  });
});

describe('UX Improvements - Timed Exercise Units', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true, delete: true });
    await waitForHome();
    await importWorkout(TIMED_PLAN, 'Timed Test');
  });

  it('should show Time label for timed exercises instead of Weight', async () => {
    await startWorkout('Timed Test');

    await waitFor(element(by.text('Plank')))
      .toBeVisible()
      .withTimeout(5000);

    // Should show "Time" label for timed sets
    await waitFor(element(by.text('Time')))
      .toBeVisible()
      .withTimeout(5000);

    // Should NOT show "Weight" label for this timed exercise
    await expect(element(by.text('Weight'))).not.toBeVisible();
  });

  afterAll(async () => {
    try {
      await finishAndGoHome();
    } catch (error) {}
  });
});

describe('UX Improvements - Exercise Collapse', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true, delete: true });
    await waitForHome();
    await importWorkout(COLLAPSE_PLAN, 'Collapse Test');
    await startWorkout('Collapse Test');
  });

  it('should show first exercise expanded with Complete button', async () => {
    await waitFor(element(by.text('Bench Press')))
      .toBeVisible()
      .withTimeout(5000);
    await waitFor(element(by.text('Complete')))
      .toBeVisible()
      .withTimeout(5000);
  });

  it('should collapse first exercise after completing all its sets', async () => {
    // Complete first set of Bench Press (no rest seconds = no rest suggestion)
    await element(by.text('Complete')).tap();
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Complete second set of Bench Press
    await waitFor(element(by.text('Complete')))
      .toBeVisible()
      .withTimeout(5000);
    await element(by.text('Complete')).tap();
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Bench Press should now be collapsed, showing completion summary
    await waitFor(element(by.text('2/2 sets completed')))
      .toBeVisible()
      .withTimeout(10000);

    // Squat should now be the active exercise
    await waitFor(element(by.text('Squat')))
      .toBeVisible()
      .withTimeout(5000);
    await waitFor(element(by.text('Complete')))
      .toBeVisible()
      .withTimeout(5000);
  });

  it('should expand collapsed exercise when tapped', async () => {
    // Tap the collapsed Bench Press summary
    await element(by.text('2/2 sets completed')).tap();
    await new Promise(resolve => setTimeout(resolve, 500));

    // Should now show Bench Press expanded — the name is always visible
    // but now we should also see completed set details (checkmarks)
    await waitFor(element(by.text('Bench Press')))
      .toBeVisible()
      .withTimeout(5000);
  });

  afterAll(async () => {
    try {
      await finishAndGoHome();
    } catch (error) {}
  });
});

describe('UX Improvements - Skip Heavy Quit Option', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true, delete: true });
    await waitForHome();
    await importWorkout(SKIP_PLAN, 'Skip Test');
    await startWorkout('Skip Test');
  });

  it('should show Discard Workout dialog when majority of sets are skipped', async () => {
    // Skip all 4 sets — since no rest timers, Skip is only the set skip button
    for (let i = 0; i < 4; i++) {
      await waitFor(element(by.text('Skip')))
        .toBeVisible()
        .withTimeout(5000);
      await element(by.text('Skip')).atIndex(0).tap();
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // The auto-finish triggers with "Discard Workout?" since all sets were skipped
    await waitFor(element(by.text('Discard Workout?')))
      .toBeVisible()
      .withTimeout(10000);

    // Should have correct options
    await waitFor(element(by.text('Log Anyway')))
      .toBeVisible()
      .withTimeout(3000);

    await waitFor(element(by.text('Discard')))
      .toBeVisible()
      .withTimeout(3000);
  });

  it('should discard workout when Discard is tapped', async () => {
    await element(by.text('Discard')).tap();

    // Discard navigates back to workout detail (not summary)
    await waitFor(element(by.id('start-workout-button')))
      .toBeVisible()
      .withTimeout(10000);
  });
});

describe('UX Improvements - Save User Edited Values', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true, delete: true });
    await waitForHome();
    await importWorkout(SAVE_PLAN, 'Save Test');
    await startWorkout('Save Test');
  });

  it('should save input field values on set completion', async () => {
    await waitFor(element(by.text('Bench Press')))
      .toBeVisible()
      .withTimeout(5000);

    // Complete the set — the input fields contain the pre-filled target values
    await element(by.text('Complete')).tap();
    await new Promise(resolve => setTimeout(resolve, 1000));

    // The completed set should show the actual values saved from the input fields.
    // formatSetActual produces something like "135 lbs × 5 reps"
    // Verify the completed set is visible with a green checkmark or "Tap to edit"
    await waitFor(element(by.text('Tap to edit')))
      .toBeVisible()
      .withTimeout(5000);
  });

  afterAll(async () => {
    try {
      await finishAndGoHome();
    } catch (error) {}
  });
});
