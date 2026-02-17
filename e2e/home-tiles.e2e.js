const { device, element, by, waitFor } = require('detox');

describe('Home screen tile customization', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });

    // Wait for home screen to load
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

  it('shows default tiles on first launch', async () => {
    // All 4 default tiles should be visible
    await waitFor(element(by.id('max-lift-tile-0')))
      .toBeVisible()
      .withTimeout(5000);
    await expect(element(by.id('max-lift-tile-1'))).toBeVisible();
    await expect(element(by.id('max-lift-tile-2'))).toBeVisible();
    await expect(element(by.id('max-lift-tile-3'))).toBeVisible();

    // Verify default exercise names are shown
    await expect(element(by.text('Squat'))).toBeVisible();
    await expect(element(by.text('Deadlift'))).toBeVisible();
    await expect(element(by.text('Bench Press'))).toBeVisible();
    await expect(element(by.text('Overhead Press'))).toBeVisible();
  });

  it('opens exercise picker on long press and can cancel', async () => {
    // Long press the first tile
    await element(by.id('max-lift-tile-0')).longPress();

    // Exercise picker modal should appear
    await waitFor(element(by.id('exercise-picker-modal')))
      .toBeVisible()
      .withTimeout(5000);

    // Search input and cancel button should be visible
    await expect(element(by.id('exercise-picker-search'))).toBeVisible();
    await expect(element(by.id('exercise-picker-cancel'))).toBeVisible();

    // Tap cancel
    await element(by.id('exercise-picker-cancel')).tap();

    // Modal should disappear
    await waitFor(element(by.id('exercise-picker-modal')))
      .not.toBeVisible()
      .withTimeout(5000);

    // Original tile name should still be there
    await expect(element(by.text('Squat'))).toBeVisible();
  });

  it('can select a common exercise from the list', async () => {
    // Long press the fourth tile (Overhead Press)
    await element(by.id('max-lift-tile-3')).longPress();

    await waitFor(element(by.id('exercise-picker-modal')))
      .toBeVisible()
      .withTimeout(5000);

    // Select "Pull-Up" from the list
    await waitFor(element(by.id('exercise-option-Pull-Up')))
      .toBeVisible()
      .withTimeout(5000);
    await element(by.id('exercise-option-Pull-Up')).tap();

    // Modal should close
    await waitFor(element(by.id('exercise-picker-modal')))
      .not.toBeVisible()
      .withTimeout(5000);

    // Tile should now show "Pull-Up" instead of "Overhead Press"
    await waitFor(element(by.text('Pull-Up')))
      .toBeVisible()
      .withTimeout(5000);
  });

  it('can search and select a filtered exercise', async () => {
    // Long press second tile (Deadlift)
    await element(by.id('max-lift-tile-1')).longPress();

    await waitFor(element(by.id('exercise-picker-modal')))
      .toBeVisible()
      .withTimeout(5000);

    // Type in search to filter
    await element(by.id('exercise-picker-search')).typeText('lat pull');

    // "Lat Pulldown" should be visible
    await waitFor(element(by.id('exercise-option-Lat Pulldown')))
      .toBeVisible()
      .withTimeout(5000);

    // Select Lat Pulldown
    await element(by.id('exercise-option-Lat Pulldown')).tap();

    // Tile should now show "Lat Pulldown"
    await waitFor(element(by.text('Lat Pulldown')))
      .toBeVisible()
      .withTimeout(5000);
  });

  it('can enter a custom exercise via free text', async () => {
    // Long press third tile (Bench Press)
    await element(by.id('max-lift-tile-2')).longPress();

    await waitFor(element(by.id('exercise-picker-modal')))
      .toBeVisible()
      .withTimeout(5000);

    // Type a custom exercise name that doesn't match any existing
    await element(by.id('exercise-picker-search')).typeText('Zercher Squat');

    // The "Add" free entry option should appear
    await waitFor(element(by.id('exercise-picker-free-entry')))
      .toBeVisible()
      .withTimeout(5000);

    // Tap the free entry
    await element(by.id('exercise-picker-free-entry')).tap();

    // Tile should now show "Zercher Squat"
    await waitFor(element(by.text('Zercher Squat')))
      .toBeVisible()
      .withTimeout(5000);
  });

  it('persists tile changes across app restarts', async () => {
    // At this point tiles should be: Squat, Lat Pulldown, Zercher Squat, Pull-Up
    // (from previous tests)

    // Restart the app (without deleting data)
    await device.launchApp({ newInstance: true });

    // Wait for home screen with fallback (same pattern as other E2E tests)
    try {
      await waitFor(element(by.id('home-screen')))
        .toBeVisible()
        .withTimeout(30000);
    } catch (error) {
      await waitFor(element(by.id('max-lift-tile-0')))
        .toBeVisible()
        .withTimeout(10000);
    }

    // The changed tiles should still be there
    await waitFor(element(by.text('Lat Pulldown')))
      .toBeVisible()
      .withTimeout(5000);
    await expect(element(by.text('Zercher Squat'))).toBeVisible();
    await expect(element(by.text('Pull-Up'))).toBeVisible();
    // Squat was not changed so it should still be there
    await expect(element(by.text('Squat'))).toBeVisible();
  });
});
