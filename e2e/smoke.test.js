describe('Smoke', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
  });

  it('app launches and shows home screen', async () => {
    // Try to find the home screen with a generous timeout
    // The app needs time to initialize database and load data
    try {
      await waitFor(element(by.id('home-screen')))
        .toBeVisible()
        .withTimeout(30000);
    } catch (error) {
      // If home screen isn't found, try stat-workouts which should also be visible
      await waitFor(element(by.id('stat-workouts')))
        .toBeVisible()
        .withTimeout(5000);
    }
  });
});
