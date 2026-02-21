/**
 * Detox Runner - Reads YAML scenario files and generates Detox test suites.
 *
 * Usage:
 *   In a Detox test file:
 *     const { runScenario, loadScenario } = require('./runner');
 *     runScenario(loadScenario('scenarios/smoke.yaml'));
 *
 *   Or to run all scenarios from a directory:
 *     const { runAllScenarios } = require('./runner');
 *     runAllScenarios('scenarios/');
 */

const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');
const { executeAction } = require('./adapter');

const SPEC_DIR = path.resolve(__dirname, '../..');

/**
 * Load and parse a YAML scenario file.
 * @param {string} yamlPath - Path relative to e2e-spec/ directory
 * @returns {object} Parsed scenario object
 */
function loadScenario(yamlPath) {
  const fullPath = path.resolve(SPEC_DIR, yamlPath);
  const content = fs.readFileSync(fullPath, 'utf-8');
  return yaml.load(content);
}

/**
 * Execute an array of actions sequentially.
 */
async function executeActions(actions) {
  for (const action of actions) {
    await executeAction(action);
  }
}

/**
 * Generate a Detox test suite from a parsed scenario.
 * @param {object} scenario - Parsed YAML scenario
 */
function runScenario(scenario) {
  describe(scenario.name, () => {
    // setupOnce runs once before all tests (beforeAll)
    if (scenario.setupOnce) {
      beforeAll(async () => {
        await executeActions(scenario.setupOnce);
      });
    }

    // setup runs before each test (beforeEach)
    if (scenario.setup) {
      beforeEach(async () => {
        await executeActions(scenario.setup);
      });
    }

    // teardown runs after each test (afterEach)
    if (scenario.teardown) {
      afterEach(async () => {
        await executeActions(scenario.teardown);
      });
    }

    // Generate a test for each test case
    for (const test of scenario.tests) {
      const testFn = test.skip ? it.skip : (test.only ? it.only : it);

      testFn(test.name, async () => {
        await executeActions(test.steps);
      });
    }
  });
}

/**
 * Load and run all YAML scenarios from a directory.
 * @param {string} scenariosDir - Path relative to e2e-spec/ directory
 * @param {object} options - Options for filtering
 * @param {string[]} options.tags - Only run tests with these tags
 * @param {string[]} options.files - Only run these specific files
 */
function runAllScenarios(scenariosDir, options = {}) {
  const fullDir = path.resolve(SPEC_DIR, scenariosDir);
  const files = fs.readdirSync(fullDir)
    .filter(f => f.endsWith('.yaml') || f.endsWith('.yml'))
    .sort();

  const filteredFiles = options.files
    ? files.filter(f => options.files.includes(f) || options.files.includes(f.replace(/\.ya?ml$/, '')))
    : files;

  for (const file of filteredFiles) {
    const scenario = loadScenario(path.join(scenariosDir, file));

    if (options.tags && options.tags.length > 0) {
      // Filter tests to only those with matching tags
      scenario.tests = scenario.tests.filter(test =>
        test.tags && test.tags.some(tag => options.tags.includes(tag))
      );
      if (scenario.tests.length === 0) continue;
    }

    runScenario(scenario);
  }
}

module.exports = { loadScenario, runScenario, runAllScenarios };
