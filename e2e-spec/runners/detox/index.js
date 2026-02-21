/**
 * Detox YAML Runner - Entry point.
 *
 * Re-exports runner and adapter for convenient importing.
 *
 * Usage in a Detox test file:
 *
 *   const { runAllScenarios } = require('../../e2e-spec/runners/detox');
 *   runAllScenarios('scenarios/');
 *
 * Or for a single scenario:
 *
 *   const { loadScenario, runScenario } = require('../../e2e-spec/runners/detox');
 *   runScenario(loadScenario('scenarios/smoke.yaml'));
 */

const { loadScenario, runScenario, runAllScenarios } = require('./runner');
const { executeAction, readFixture } = require('./adapter');

module.exports = {
  loadScenario,
  runScenario,
  runAllScenarios,
  executeAction,
  readFixture,
};
