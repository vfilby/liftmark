const { device, expect, element, by, waitFor } = require('detox');

const SAMPLE_BASIC_PLAN = `# Basic Push Day
@tags: push, strength
@units: lbs

## Bench Press
- 135 x 5
- 155 x 5
- 175 x 5

## Overhead Press
- 95 x 8
- 105 x 8
- 115 x 8
`;

const SAMPLE_SUPERSET_PLAN = `# Arms Superset
@tags: arms, superset
@units: lbs

### Superset: Biceps & Triceps

#### Barbell Curl
- 65 x 10
- 75 x 10

#### Tricep Pushdown
- 50 x 12
- 60 x 12
`;

const SAMPLE_TIME_BASED_PLAN = `# Core Workout
@tags: core, bodyweight

## Plank
- 60s
- 45s
- 30s

## Dead Bug
- 30s
- 30s
`;

const INVALID_PLAN = `# Invalid Workout
This has no exercises
Just some text
`;

describe('Import Workout Plan Flow', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });

    // Wait for home screen to load
    try {
      await waitFor(element(by.id('home-screen')))
        .toBeVisible()
        .withTimeout(30000);
    } catch (error) {
      // Fallback to stat-workouts if home-screen not found
      await waitFor(element(by.id('stat-workouts')))
        .toBeVisible()
        .withTimeout(5000);
    }
  });

  it('should import a basic workout plan from home screen', async () => {
    // Tap import button from home screen
    await waitFor(element(by.id('button-import-workout')))
      .toBeVisible()
      .withTimeout(5000);
    await element(by.id('button-import-workout')).tap();

    // Wait for the input field to appear
    await waitFor(element(by.id('input-markdown')))
      .toBeVisible()
      .withTimeout(10000);

    // Enter workout plan markdown
    await element(by.id('input-markdown')).replaceText(SAMPLE_BASIC_PLAN);

    // Tap import button
    await element(by.id('button-import')).tap();

    // Wait for success dialog and tap OK
    await waitFor(element(by.text('OK')))
      .toBeVisible()
      .withTimeout(10000);
    await element(by.text('OK')).tap();

    // Verify the plan appears in Recent Plans (confirms return to home)
    await waitFor(element(by.text('Basic Push Day')))
      .toBeVisible()
      .withTimeout(10000);
  });

  it('should navigate to workouts tab and see imported plan', async () => {
    // Ensure we're on home screen
    await element(by.id('tab-home')).tap();

    // Navigate to workouts tab
    await element(by.id('button-view-workouts')).tap();

    await waitFor(element(by.id('workouts-screen')))
      .toBeVisible()
      .withTimeout(5000);

    // Should see the previously imported plan
    await waitFor(element(by.text('Basic Push Day')))
      .toBeVisible()
      .withTimeout(5000);
  });

  it('should import superset workout plan', async () => {
    // Ensure we're on home screen
    await element(by.id('tab-home')).tap();

    await waitFor(element(by.id('button-import-workout')))
      .toBeVisible()
      .withTimeout(5000);
    await element(by.id('button-import-workout')).tap();

    // Wait for the input field to appear
    await waitFor(element(by.id('input-markdown')))
      .toBeVisible()
      .withTimeout(10000);

    await element(by.id('input-markdown')).replaceText(SAMPLE_SUPERSET_PLAN);
    await element(by.id('button-import')).tap();

    await waitFor(element(by.text('OK')))
      .toBeVisible()
      .withTimeout(5000);

    await element(by.text('OK')).tap();

    // Verify superset plan is imported
    await waitFor(element(by.text('Arms Superset')))
      .toBeVisible()
      .withTimeout(10000);
  });

  it('should import time-based workout plan', async () => {
    // Ensure we're on home screen
    await element(by.id('tab-home')).tap();

    await waitFor(element(by.id('button-import-workout')))
      .toBeVisible()
      .withTimeout(5000);
    await element(by.id('button-import-workout')).tap();

    // Wait for the input field to appear
    await waitFor(element(by.id('input-markdown')))
      .toBeVisible()
      .withTimeout(10000);

    await element(by.id('input-markdown')).replaceText(SAMPLE_TIME_BASED_PLAN);
    await element(by.id('button-import')).tap();

    await waitFor(element(by.text('OK')))
      .toBeVisible()
      .withTimeout(5000);

    await element(by.text('OK')).tap();

    // Verify time-based plan is imported
    await waitFor(element(by.text('Core Workout')))
      .toBeVisible()
      .withTimeout(10000);
  });

  it('should show error for invalid markdown', async () => {
    // Ensure we're on home screen
    await element(by.id('tab-home')).tap();

    await waitFor(element(by.id('button-import-workout')))
      .toBeVisible()
      .withTimeout(5000);
    await element(by.id('button-import-workout')).tap();

    // Wait for the input field to appear
    await waitFor(element(by.id('input-markdown')))
      .toBeVisible()
      .withTimeout(10000);

    await element(by.id('input-markdown')).replaceText(INVALID_PLAN);
    await element(by.id('button-import')).tap();

    // Should show error message
    await waitFor(element(by.text('Error')))
      .toBeVisible()
      .withTimeout(5000);

    await element(by.text('OK')).tap();

    // Should still be on import modal (verify by checking input field)
    await waitFor(element(by.id('input-markdown')))
      .toBeVisible()
      .withTimeout(5000);
  });

  it('should be able to cancel import', async () => {
    // Ensure we're on home screen
    await element(by.id('tab-home')).tap();

    await waitFor(element(by.id('button-import-workout')))
      .toBeVisible()
      .withTimeout(5000);
    await element(by.id('button-import-workout')).tap();

    // Wait for the input field to appear
    await waitFor(element(by.id('input-markdown')))
      .toBeVisible()
      .withTimeout(10000);

    await element(by.id('input-markdown')).replaceText(SAMPLE_BASIC_PLAN);

    // Tap cancel button (from import modal)
    await element(by.id('button-cancel')).tap();

    // Should show discard confirmation
    await waitFor(element(by.text('Discard')))
      .toBeVisible()
      .withTimeout(5000);

    await element(by.text('Discard')).tap();

    // Should return to home - verify by checking import button is visible again
    await waitFor(element(by.id('button-import-workout')))
      .toBeVisible()
      .withTimeout(5000);
  });

  it('should preserve tags from imported plan', async () => {
    // Ensure we're on home screen
    await element(by.id('tab-home')).tap();

    await waitFor(element(by.id('button-import-workout')))
      .toBeVisible()
      .withTimeout(5000);
    await element(by.id('button-import-workout')).tap();

    // Wait for the input field to appear
    await waitFor(element(by.id('input-markdown')))
      .toBeVisible()
      .withTimeout(10000);

    await element(by.id('input-markdown')).replaceText(SAMPLE_BASIC_PLAN);
    await element(by.id('button-import')).tap();

    await waitFor(element(by.text('OK')))
      .toBeVisible()
      .withTimeout(5000);

    await element(by.text('OK')).tap();

    // Tap on the plan to view details
    await element(by.text('Basic Push Day')).tap();

    // Verify tags are visible
    await waitFor(element(by.text('push')))
      .toBeVisible()
      .withTimeout(5000);

    await waitFor(element(by.text('strength')))
      .toBeVisible()
      .withTimeout(5000);
  });

  it('should import multiple plans sequentially', async () => {
    // Ensure we're on home screen
    await element(by.id('tab-home')).tap();

    // Import first plan
    await waitFor(element(by.id('button-import-workout')))
      .toBeVisible()
      .withTimeout(5000);
    await element(by.id('button-import-workout')).tap();

    await waitFor(element(by.id('input-markdown')))
      .toBeVisible()
      .withTimeout(10000);
    await element(by.id('input-markdown')).replaceText(SAMPLE_BASIC_PLAN);
    await element(by.id('button-import')).tap();
    await waitFor(element(by.text('OK'))).toBeVisible().withTimeout(10000);
    await element(by.text('OK')).tap();

    // Verify first plan imported
    await waitFor(element(by.text('Basic Push Day')))
      .toBeVisible()
      .withTimeout(10000);

    // Import second plan
    await waitFor(element(by.id('button-import-workout')))
      .toBeVisible()
      .withTimeout(5000);
    await element(by.id('button-import-workout')).tap();

    await waitFor(element(by.id('input-markdown')))
      .toBeVisible()
      .withTimeout(10000);
    await element(by.id('input-markdown')).replaceText(SAMPLE_TIME_BASED_PLAN);
    await element(by.id('button-import')).tap();
    await waitFor(element(by.text('OK'))).toBeVisible().withTimeout(10000);
    await element(by.text('OK')).tap();

    // Both plans should be visible in Recent Plans
    await waitFor(element(by.text('Basic Push Day')))
      .toBeVisible()
      .withTimeout(5000);
    await waitFor(element(by.text('Core Workout')))
      .toBeVisible()
      .withTimeout(5000);
  });
});
