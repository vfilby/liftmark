import XCTest
import Foundation

// MARK: - Data Models

/// A parsed E2E test scenario (one YAML file).
struct TestScenario {
    let name: String
    let setup: [TestAction]?
    let setupOnce: [TestAction]?
    let teardown: [TestAction]?
    let tests: [TestCase]
}

/// A single test case within a scenario.
struct TestCase {
    let name: String
    let tags: [String]
    let skip: Bool
    let steps: [TestAction]
}

/// A single action step parsed from YAML.
struct TestAction {
    let action: String
    let target: String?
    let value: String?
    let timeout: Int?
    let assertion: String?
    let direction: String?
    let amount: Int?
    let button: String?
    let ms: Int?
    let newInstance: Bool?
    let url: String?
    let text: String?
    let index: Int?
    let fixture: String?
    let expectedName: String?
    let segment: String?
    let script: String?
    let args: YAMLValue?
    let trySteps: [TestAction]?
    let catchSteps: [TestAction]?
    let permissions: YAMLValue?
    let launchArgs: YAMLValue?
}

// MARK: - TestSpecRunner

/// Reads YAML scenario files from disk, parses them into TestScenario models,
/// and executes them using XCUITest via ActionAdapter.
class TestSpecRunner {
    let app: XCUIApplication
    let scenariosPath: String
    let fixturesPath: String
    let adapter: ActionAdapter

    init(app: XCUIApplication, scenariosPath: String, fixturesPath: String) {
        self.app = app
        self.scenariosPath = scenariosPath
        self.fixturesPath = fixturesPath
        self.adapter = ActionAdapter(app: app, fixturesPath: fixturesPath)
    }

    // MARK: - Scenario Loading

    /// Load a scenario file by name (without .yaml extension).
    func loadScenario(named name: String) -> TestScenario? {
        let filePath = (scenariosPath as NSString).appendingPathComponent("\(name).yaml")
        guard FileManager.default.fileExists(atPath: filePath) else {
            XCTFail("Scenario file not found: \(filePath)")
            return nil
        }
        guard let content = try? String(contentsOfFile: filePath, encoding: .utf8) else {
            XCTFail("Could not read scenario file: \(filePath)")
            return nil
        }

        let yaml = YAMLParser.parse(content)
        return parseScenario(yaml)
    }

    /// Load all scenario files from the scenarios directory.
    func loadAllScenarios() -> [TestScenario] {
        let fm = FileManager.default
        guard let files = try? fm.contentsOfDirectory(atPath: scenariosPath) else {
            XCTFail("Could not list scenarios directory: \(scenariosPath)")
            return []
        }

        return files
            .filter { $0.hasSuffix(".yaml") || $0.hasSuffix(".yml") }
            .sorted()
            .compactMap { filename -> TestScenario? in
                let name = (filename as NSString).deletingPathExtension
                return loadScenario(named: name)
            }
    }

    // MARK: - Scenario Execution

    /// Run a single scenario by name.
    func runScenario(named name: String) {
        guard let scenario = loadScenario(named: name) else { return }
        runScenario(scenario)
    }

    /// Run a parsed scenario: execute setupOnce, then for each test run setup → steps → teardown.
    func runScenario(_ scenario: TestScenario) {
        // Run setupOnce actions
        if let setupOnce = scenario.setupOnce {
            executeActions(setupOnce, context: "setupOnce for '\(scenario.name)'")
        }

        for testCase in scenario.tests {
            if testCase.skip { continue }

            // Run setup before each test
            if let setup = scenario.setup {
                executeActions(setup, context: "setup for '\(testCase.name)'")
            }

            // Run test steps
            executeActions(testCase.steps, context: "test '\(testCase.name)'")

            // Run teardown after each test
            if let teardown = scenario.teardown {
                executeActions(teardown, context: "teardown for '\(testCase.name)'")
            }
        }
    }

    /// Run all scenarios from the scenarios directory.
    func runAllScenarios() {
        for scenario in loadAllScenarios() {
            runScenario(scenario)
        }
    }

    // MARK: - Action Execution

    private func executeActions(_ actions: [TestAction], context: String) {
        for (i, action) in actions.enumerated() {
            do {
                try adapter.execute(action)
            } catch {
                XCTFail("Action \(i) (\(action.action)) failed in \(context): \(error.localizedDescription)")
                return
            }
        }
    }

    // MARK: - YAML Parsing

    private func parseScenario(_ yaml: YAMLValue) -> TestScenario? {
        guard let name = yaml["name"]?.stringValue else {
            XCTFail("Scenario missing 'name' field")
            return nil
        }

        let setup = yaml["setup"]?.arrayValue?.compactMap(parseAction)
        let setupOnce = yaml["setupOnce"]?.arrayValue?.compactMap(parseAction)
        let teardown = yaml["teardown"]?.arrayValue?.compactMap(parseAction)

        guard let testsYAML = yaml["tests"]?.arrayValue else {
            XCTFail("Scenario '\(name)' missing 'tests' field")
            return nil
        }

        let tests = testsYAML.compactMap(parseTestCase)

        return TestScenario(
            name: name,
            setup: setup,
            setupOnce: setupOnce,
            teardown: teardown,
            tests: tests
        )
    }

    private func parseTestCase(_ yaml: YAMLValue) -> TestCase? {
        guard let name = yaml["name"]?.stringValue else {
            XCTFail("Test case missing 'name'")
            return nil
        }

        let tags = yaml["tags"]?.arrayValue?.compactMap(\.stringValue) ?? []
        let skip = yaml["skip"]?.boolValue ?? false
        let steps = yaml["steps"]?.arrayValue?.compactMap(parseAction) ?? []

        return TestCase(name: name, tags: tags, skip: skip, steps: steps)
    }

    func parseAction(_ yaml: YAMLValue) -> TestAction? {
        guard let action = yaml["action"]?.stringValue else {
            XCTFail("Action missing 'action' field")
            return nil
        }

        return TestAction(
            action: action,
            target: yaml["target"]?.stringValue,
            value: yaml["value"]?.stringValue,
            timeout: yaml["timeout"]?.intValue,
            assertion: yaml["assertion"]?.stringValue,
            direction: yaml["direction"]?.stringValue,
            amount: yaml["amount"]?.intValue,
            button: yaml["button"]?.stringValue,
            ms: yaml["ms"]?.intValue,
            newInstance: yaml["newInstance"]?.boolValue,
            url: yaml["url"]?.stringValue,
            text: yaml["text"]?.stringValue,
            index: yaml["index"]?.intValue,
            fixture: yaml["fixture"]?.stringValue,
            expectedName: yaml["expectedName"]?.stringValue,
            segment: yaml["segment"]?.stringValue,
            script: yaml["script"]?.stringValue,
            args: yaml["args"],
            trySteps: yaml["try"]?.arrayValue?.compactMap(parseAction),
            catchSteps: yaml["catch"]?.arrayValue?.compactMap(parseAction),
            permissions: yaml["permissions"],
            launchArgs: yaml["launchArgs"]
        )
    }
}
