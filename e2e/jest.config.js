module.exports = {
  rootDir: '..',
  preset: 'detox',
  testRunner: 'jest-circus/runner',
  setupFilesAfterEnv: ['<rootDir>/e2e/init.js'],
  testMatch: ['<rootDir>/e2e/**/*.test.js'],
  testTimeout: 120000,
  verbose: true,
};
