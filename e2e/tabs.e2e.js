const { device, element, by, waitFor } = require('detox');

describe('Tab navigation', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
  });

  it('shows each main tab screen and navigates between them', async () => {
    // Wait for home screen with fallback
    try {
      await waitFor(element(by.id('home-screen')))
        .toBeVisible()
        .withTimeout(30000);
    } catch (error) {
      await waitFor(element(by.id('max-lift-tile-0')))
        .toBeVisible()
        .withTimeout(5000);
    }

    // Verify home screen content
    await waitFor(element(by.id('max-lift-tile-0')))
      .toBeVisible()
      .withTimeout(5000);

    // Navigate to workouts tab
    await element(by.id('tab-workouts')).tap();
    await waitFor(element(by.id('search-input')))
      .toBeVisible()
      .withTimeout(5000);

    // Navigate to history tab
    await element(by.id('tab-history')).tap();
    await waitFor(element(by.id('history-screen')))
      .toBeVisible()
      .withTimeout(5000);

    // Navigate to settings tab
    await element(by.id('tab-settings')).tap();
    await waitFor(element(by.id('settings-screen')))
      .toBeVisible()
      .withTimeout(5000);

    // Navigate back to home
    await element(by.id('tab-home')).tap();
    await waitFor(element(by.id('max-lift-tile-0')))
      .toBeVisible()
      .withTimeout(5000);
  });
});
