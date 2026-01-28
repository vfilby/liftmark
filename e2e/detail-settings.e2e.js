/* eslint-env detox/detox, jest */

describe('Detail and settings screens', () => {
  beforeEach(async () => {
    await device.launchApp({ newInstance: true });
  });

  it('shows history detail screen', async () => {
    await element(by.id('tab-history')).tap();
    await expect(element(by.id('history-screen'))).toBeVisible();

    const sessionCard = element(by.id('history-session-card')).atIndex(0);
    await expect(sessionCard).toBeVisible();
    await sessionCard.tap();

    await expect(element(by.id('history-detail-screen'))).toBeVisible();
    await expect(element(by.id('history-detail-view'))).toBeVisible();
  });

  it('shows gym detail screen', async () => {
    await element(by.id('tab-settings')).tap();
    await expect(element(by.id('settings-screen'))).toBeVisible();

    const gymItem = element(by.id('gym-item')).atIndex(0);
    await expect(gymItem).toBeVisible();
    await gymItem.tap();

    await expect(element(by.id('gym-detail-screen'))).toBeVisible();
    await expect(element(by.id('input-gym-name'))).toBeVisible();
  });

  it('shows workout settings screen', async () => {
    await element(by.id('tab-settings')).tap();
    await element(by.id('workout-settings-button')).tap();

    await expect(element(by.id('workout-settings-screen'))).toBeVisible();
    await expect(element(by.id('button-unit-lbs'))).toBeVisible();
  });

  it('shows sync settings screen', async () => {
    await element(by.id('tab-settings')).tap();

    if (device.getPlatform() === 'ios') {
      await element(by.id('sync-settings-button')).tap();
      await expect(element(by.id('sync-settings-screen'))).toBeVisible();
      await expect(element(by.id('sync-status-section'))).toBeVisible();
    }
  });

  it('shows debug logs screen', async () => {
    await element(by.id('tab-settings')).tap();
    await element(by.id('debug-logs-button')).tap();

    await expect(element(by.id('debug-logs-screen'))).toBeVisible();
    await expect(element(by.id('debug-logs-actions'))).toBeVisible();
  });
});
