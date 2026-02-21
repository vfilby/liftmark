const { device, expect, element, by, waitFor } = require('detox');

const TEST_PLAN = `# Export Test Workout
@tags: test, export
@units: lbs

## Bench Press
- 135 x 5

## Squat
- 185 x 5
`;

describe('History Export', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });

    // Wait for app to load
    try {
      await waitFor(element(by.id('home-screen')))
        .toBeVisible()
        .withTimeout(30000);
    } catch (error) {
      await waitFor(element(by.id('max-lift-tile-0')))
        .toBeVisible()
        .withTimeout(5000);
    }

    // Import a test workout plan
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

    // Wait for plan to appear and start workout
    await waitFor(element(by.text('Export Test Workout')))
      .toBeVisible()
      .withTimeout(10000);
    await element(by.text('Export Test Workout')).tap();

    await waitFor(element(by.id('start-workout-button')))
      .toBeVisible()
      .withTimeout(5000);
    await element(by.id('start-workout-button')).tap();

    // Wait for active workout screen
    await waitFor(element(by.text('Export Test Workout')))
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

    // Wait for summary and dismiss
    await waitFor(element(by.id('workout-summary-done-button')))
      .toBeVisible()
      .withTimeout(10000);
    await element(by.id('workout-summary-done-button')).tap();

    // Should return to home
    await waitFor(element(by.id('button-import-workout')))
      .toBeVisible()
      .withTimeout(5000);
  });

  it('should show export button on history tab', async () => {
    await element(by.id('tab-history')).tap();

    await waitFor(element(by.id('history-screen')))
      .toBeVisible()
      .withTimeout(5000);

    await waitFor(element(by.id('history-export-button')))
      .toBeVisible()
      .withTimeout(5000);
  });

  it('should trigger export when tapping export button', async () => {
    // Make sure we're on the history tab
    await element(by.id('tab-history')).tap();
    await new Promise(resolve => setTimeout(resolve, 500));

    // Verify the export button is present
    await waitFor(element(by.id('history-export-button')))
      .toBeVisible()
      .withTimeout(5000);

    // Tap export - this will open the system share sheet
    await element(by.id('history-export-button')).tap();

    // The share sheet is a system UI element outside Detox control.
    // We verify the button exists and is tappable, and that no error alert appears.
    // Wait a moment for any error alert to appear
    await new Promise(resolve => setTimeout(resolve, 2000));

    // If an error occurred, an alert would be visible. Verify no error alert.
    try {
      await waitFor(element(by.text('Export Failed')))
        .toBeVisible()
        .withTimeout(1000);
      // If we get here, export failed
      throw new Error('Export produced an error alert');
    } catch (error) {
      // Expected: no "Export Failed" alert means export succeeded
      if (error.message === 'Export produced an error alert') {
        throw error;
      }
    }

    // Dismiss share sheet if it's showing (iOS)
    try {
      await element(by.label('Close')).tap();
    } catch (error) {
      // Share sheet may auto-dismiss or have different close mechanism
    }
  });
});
