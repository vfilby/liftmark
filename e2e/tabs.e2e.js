/* eslint-env detox/detox, jest */

describe('Tab navigation', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
  });

  it('shows each main tab screen and navigates between them', async () => {
    await waitFor(element(by.id('home-screen')))
      .toBeVisible()
      .withTimeout(10000);
    await expect(element(by.id('stat-workouts'))).toBeVisible();

    await element(by.id('tab-workouts')).tap();
    await waitFor(element(by.id('workouts-screen')))
      .toBeVisible()
      .withTimeout(10000);

    await element(by.id('tab-history')).tap();
    await waitFor(element(by.id('history-screen')))
      .toBeVisible()
      .withTimeout(10000);

    await element(by.id('tab-settings')).tap();
    await waitFor(element(by.id('settings-screen')))
      .toBeVisible()
      .withTimeout(10000);
  });
});
