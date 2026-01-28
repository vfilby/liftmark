describe('Smoke', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
  });

  it('shows the home screen', async () => {
    await expect(element(by.id('home-screen'))).toBeVisible();
  });
});
