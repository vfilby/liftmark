import XCTest

/// Entry point for YAML-driven E2E tests.
///
/// Each test method loads and runs a corresponding YAML scenario from
/// `e2e-spec/scenarios/`. The scenarios are shared across platforms —
/// the same YAML files drive both Detox (React Native) and XCUITest (Swift).
final class LiftMarkUITests: XCTestCase {
    var app: XCUIApplication!
    var runner: TestSpecRunner!

    override func setUpWithError() throws {
        continueAfterFailure = false
        app = XCUIApplication()

        // Paths are relative to the project root.
        // When running from Xcode, the source root is available via the build setting.
        // Adjust these paths based on your scheme's working directory.
        let projectRoot = ProcessInfo.processInfo.environment["PROJECT_DIR"]
            ?? (#filePath as NSString)
                .deletingLastPathComponent  // LiftMarkUITests/
                .appending("/../..")        // -> project root (LiftMark/)

        let scenariosPath = (projectRoot as NSString).appendingPathComponent("e2e-spec/scenarios")
        let fixturesPath = (projectRoot as NSString).appendingPathComponent("e2e-spec/fixtures")

        runner = TestSpecRunner(app: app, scenariosPath: scenariosPath, fixturesPath: fixturesPath)
    }

    // MARK: - Scenario Tests

    func testSmoke() throws {
        runner.runScenario(named: "smoke")
    }

    func testTabs() throws {
        runner.runScenario(named: "tabs")
    }

    func testHomeTiles() throws {
        runner.runScenario(named: "home-tiles")
    }

    func testImportSimple() throws {
        runner.runScenario(named: "import-simple")
    }

    func testImportRobust() throws {
        runner.runScenario(named: "import-flow-robust")
    }

    func testWorkoutFlow() throws {
        runner.runScenario(named: "workout-flow")
    }

    func testActiveWorkout() throws {
        runner.runScenario(named: "active-workout-focused")
    }

    func testHistoryFlow() throws {
        runner.runScenario(named: "history-flow-robust")
    }

    func testHistoryExport() throws {
        runner.runScenario(named: "history-export")
    }

    func testShareTargetImport() throws {
        runner.runScenario(named: "share-target-import")
    }

    func testImportViaWorkouts() throws {
        runner.runScenario(named: "import-via-workouts")
    }

    func testDetailSettings() throws {
        runner.runScenario(named: "detail-settings")
    }
}
