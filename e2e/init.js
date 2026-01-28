const detox = require('detox');
const config = require('../.detoxrc');
const adapter = require('detox/runners/jest-circus');
const { beforeAll, beforeEach, afterAll } = require('@jest/globals');

beforeAll(async () => {
  await detox.init(config, { launchApp: false });
}, 120000);

beforeEach(async () => {
  await adapter.beforeEach();
});

afterAll(async () => {
  await detox.cleanup();
});
