module.exports = {
  rootDir: '..',
  testEnvironment: './e2e/environment',
  testRunner: 'jest-circus/runner',
  setupFilesAfterEnv: ['<rootDir>/e2e/init.js'],
  testMatch: ['<rootDir>/e2e/**/*.test.js'],
  testTimeout: 120000,
  verbose: true,
  maxWorkers: 1,
  globalSetup: 'detox/runners/jest/globalSetup',
  globalTeardown: 'detox/runners/jest/globalTeardown',
  reporters: ['detox/runners/jest/reporter'],
};
