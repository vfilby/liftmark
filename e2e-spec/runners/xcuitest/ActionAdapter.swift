import XCTest
import Foundation

/// Maps YAML E2E actions to XCUITest API calls.
///
/// Each action type from the schema (tap, replaceText, waitFor, etc.) is
/// handled by a corresponding method that translates the declarative action
/// into imperative XCUITest commands.
class ActionAdapter {
    let app: XCUIApplication
    let fixturesPath: String

    /// Internal state for cross-action communication (e.g., execScript → openURL).
    var sharedFilePath: String?

    init(app: XCUIApplication, fixturesPath: String) {
        self.app = app
        self.fixturesPath = fixturesPath
    }

    // MARK: - Public

    func execute(_ action: TestAction) throws {
        switch action.action {
        case "tap":
            try executeTap(action)
        case "longPress":
            try executeLongPress(action)
        case "tapText":
            try executeTapText(action)
        case "tapIndex":
            try executeTapIndex(action)
        case "replaceText":
            try executeReplaceText(action)
        case "typeText":
            try executeTypeText(action)
        case "waitFor":
            try executeWaitFor(action)
        case "waitForNot":
            try executeWaitForNot(action)
        case "waitForText":
            try executeWaitForText(action)
        case "expect":
            try executeExpect(action)
        case "scroll":
            try executeScroll(action)
        case "launchApp":
            try executeLaunchApp(action)
        case "openURL":
            try executeOpenURL(action)
        case "dismissAlert":
            try executeDismissAlert(action)
        case "delay":
            try executeDelay(action)
        case "tryCatch":
            try executeTryCatch(action)
        case "runFixture":
            try executeRunFixture(action)
        case "execScript":
            try executeExecScript(action)
        default:
            XCTFail("Unknown action: \(action.action)")
        }
    }

    // MARK: - Element Resolution

    private func element(byId identifier: String) -> XCUIElement {
        app.descendants(matching: .any)[identifier]
    }

    private func element(byText text: String) -> XCUIElement {
        app.staticTexts[text]
    }

    private func resolveElement(_ action: TestAction) throws -> XCUIElement {
        if let target = action.target {
            return element(byId: target)
        }
        if let text = action.text {
            return element(byText: text)
        }
        throw ActionError.missingSelector(action.action)
    }

    // MARK: - Fixture Loading

    func readFixture(_ name: String) throws -> String {
        let path = (fixturesPath as NSString).appendingPathComponent(name)
        guard FileManager.default.fileExists(atPath: path) else {
            throw ActionError.fixtureNotFound(name, path)
        }
        return try String(contentsOfFile: path, encoding: .utf8)
    }

    // MARK: - Action Implementations

    private func executeTap(_ action: TestAction) throws {
        let el = try resolveElement(action)
        XCTAssertTrue(el.waitForExistence(timeout: 5), "Element '\(action.target ?? action.text ?? "")' not found for tap")
        el.tap()
    }

    private func executeLongPress(_ action: TestAction) throws {
        let el = try resolveElement(action)
        XCTAssertTrue(el.waitForExistence(timeout: 5), "Element '\(action.target ?? "")' not found for longPress")
        el.press(forDuration: 1.0)
    }

    private func executeTapText(_ action: TestAction) throws {
        guard let text = action.text else {
            throw ActionError.missingParam("text", "tapText")
        }
        let el = element(byText: text)
        XCTAssertTrue(el.waitForExistence(timeout: 5), "Text '\(text)' not found for tapText")
        el.tap()
    }

    private func executeTapIndex(_ action: TestAction) throws {
        guard let target = action.target else {
            throw ActionError.missingParam("target", "tapIndex")
        }
        let index = action.index ?? 0
        let elements = app.descendants(matching: .any).matching(identifier: target)
        let el = elements.element(boundBy: index)
        XCTAssertTrue(el.waitForExistence(timeout: 5), "Element '\(target)' at index \(index) not found")
        el.tap()
    }

    private func executeReplaceText(_ action: TestAction) throws {
        guard let target = action.target else {
            throw ActionError.missingParam("target", "replaceText")
        }
        let el = element(byId: target)
        XCTAssertTrue(el.waitForExistence(timeout: 5), "Element '\(target)' not found for replaceText")

        // Resolve text value — from fixture or direct value
        let textValue: String
        if let fixture = action.fixture {
            textValue = try readFixture(fixture)
        } else if let value = action.value {
            textValue = value
        } else {
            throw ActionError.missingParam("value or fixture", "replaceText")
        }

        el.tap()
        // Select all and replace
        el.press(forDuration: 1.0)
        if app.menuItems["Select All"].waitForExistence(timeout: 2) {
            app.menuItems["Select All"].tap()
        }
        el.typeText(textValue)
    }

    private func executeTypeText(_ action: TestAction) throws {
        guard let target = action.target, let value = action.value else {
            throw ActionError.missingParam("target and value", "typeText")
        }
        let el = element(byId: target)
        XCTAssertTrue(el.waitForExistence(timeout: 5), "Element '\(target)' not found for typeText")
        el.tap()
        el.typeText(value)
    }

    private func executeWaitFor(_ action: TestAction) throws {
        let el = try resolveElement(action)
        let timeout = TimeInterval(action.timeout ?? 5000) / 1000.0
        XCTAssertTrue(
            el.waitForExistence(timeout: timeout),
            "Timed out waiting for '\(action.target ?? action.text ?? "")' to exist"
        )
    }

    private func executeWaitForNot(_ action: TestAction) throws {
        let el = try resolveElement(action)
        let timeout = TimeInterval(action.timeout ?? 5000) / 1000.0

        let predicate = NSPredicate(format: "exists == false")
        let expectation = XCTNSPredicateExpectation(predicate: predicate, object: el)
        let result = XCTWaiter().wait(for: [expectation], timeout: timeout)
        XCTAssertEqual(
            result, .completed,
            "Timed out waiting for '\(action.target ?? action.text ?? "")' to disappear"
        )
    }

    private func executeWaitForText(_ action: TestAction) throws {
        guard let text = action.text else {
            throw ActionError.missingParam("text", "waitForText")
        }
        let timeout = TimeInterval(action.timeout ?? 5000) / 1000.0
        let el = element(byText: text)
        XCTAssertTrue(
            el.waitForExistence(timeout: timeout),
            "Timed out waiting for text '\(text)'"
        )
    }

    private func executeExpect(_ action: TestAction) throws {
        let el = try resolveElement(action)
        guard let assertion = action.assertion else {
            throw ActionError.missingParam("assertion", "expect")
        }

        switch assertion {
        case "toBeVisible":
            XCTAssertTrue(el.waitForExistence(timeout: 5), "Expected '\(action.target ?? action.text ?? "")' to be visible")
            XCTAssertTrue(el.isHittable, "Expected '\(action.target ?? action.text ?? "")' to be visible (hittable)")

        case "toExist":
            XCTAssertTrue(el.waitForExistence(timeout: 5), "Expected '\(action.target ?? action.text ?? "")' to exist")

        case "toHaveText":
            XCTAssertTrue(el.waitForExistence(timeout: 5))
            let actual = (el.value as? String) ?? el.label
            XCTAssertEqual(actual, action.value, "Expected text '\(action.value ?? "")' but got '\(actual)'")

        case "notToBeVisible":
            // Either doesn't exist or exists but not hittable
            if el.exists {
                XCTAssertFalse(el.isHittable, "Expected '\(action.target ?? action.text ?? "")' not to be visible")
            }

        case "notToExist":
            XCTAssertFalse(el.exists, "Expected '\(action.target ?? action.text ?? "")' not to exist")

        default:
            XCTFail("Unknown assertion: \(assertion)")
        }
    }

    private func executeScroll(_ action: TestAction) throws {
        guard let target = action.target else {
            throw ActionError.missingParam("target", "scroll")
        }
        guard let direction = action.direction else {
            throw ActionError.missingParam("direction", "scroll")
        }
        let el = element(byId: target)
        XCTAssertTrue(el.waitForExistence(timeout: 5), "Element '\(target)' not found for scroll")

        switch direction {
        case "up":    el.swipeUp()
        case "down":  el.swipeDown()
        case "left":  el.swipeLeft()
        case "right": el.swipeRight()
        default:      XCTFail("Unknown scroll direction: \(direction)")
        }
    }

    private func executeLaunchApp(_ action: TestAction) throws {
        if action.newInstance == true {
            app.terminate()
        }
        app.launch()
    }

    private func executeOpenURL(_ action: TestAction) throws {
        guard var url = action.url else {
            throw ActionError.missingParam("url", "openURL")
        }

        // Replace {sharedFilePath} placeholder if present
        if let sharedPath = sharedFilePath {
            url = url.replacingOccurrences(of: "{sharedFilePath}", with: sharedPath)
        }

        // Open URL via Safari or by launching with URL argument
        // XCUITest doesn't have a direct openURL like Detox, so we pass it as a launch argument
        app.terminate()
        app.launchArguments = ["-url", url]
        app.launch()
    }

    private func executeDismissAlert(_ action: TestAction) throws {
        guard let button = action.button else {
            throw ActionError.missingParam("button", "dismissAlert")
        }
        let alertButton = app.alerts.buttons[button]
        XCTAssertTrue(alertButton.waitForExistence(timeout: 5), "Alert button '\(button)' not found")
        alertButton.tap()
    }

    private func executeDelay(_ action: TestAction) throws {
        let ms = action.ms ?? 1000
        Thread.sleep(forTimeInterval: TimeInterval(ms) / 1000.0)
    }

    private func executeTryCatch(_ action: TestAction) throws {
        guard let trySteps = action.trySteps else {
            throw ActionError.missingParam("try", "tryCatch")
        }

        do {
            for step in trySteps {
                try execute(step)
            }
        } catch {
            let catchSteps = action.catchSteps ?? []
            for step in catchSteps {
                try execute(step)
            }
        }
    }

    private func executeRunFixture(_ action: TestAction) throws {
        guard let fixture = action.fixture else {
            throw ActionError.missingParam("fixture", "runFixture")
        }
        guard let expectedName = action.expectedName else {
            throw ActionError.missingParam("expectedName", "runFixture")
        }

        let content = try readFixture(fixture)

        // Navigate to home, open import, paste content, confirm
        let homeTab = element(byId: "tab-home")
        XCTAssertTrue(homeTab.waitForExistence(timeout: 5))
        homeTab.tap()
        Thread.sleep(forTimeInterval: 0.5)

        let importButton = element(byId: "button-import-workout")
        XCTAssertTrue(importButton.waitForExistence(timeout: 5))
        importButton.tap()

        let inputMarkdown = element(byId: "input-markdown")
        XCTAssertTrue(inputMarkdown.waitForExistence(timeout: 10))

        // Replace text in input
        inputMarkdown.tap()
        inputMarkdown.press(forDuration: 1.0)
        if app.menuItems["Select All"].waitForExistence(timeout: 2) {
            app.menuItems["Select All"].tap()
        }
        inputMarkdown.typeText(content)

        let importBtn = element(byId: "button-import")
        importBtn.tap()

        let okButton = element(byText: "OK")
        XCTAssertTrue(okButton.waitForExistence(timeout: 10))
        okButton.tap()

        let workoutName = element(byText: expectedName)
        XCTAssertTrue(workoutName.waitForExistence(timeout: 10), "Expected workout '\(expectedName)' not found after import")
    }

    private func executeExecScript(_ action: TestAction) throws {
        guard let script = action.script else {
            throw ActionError.missingParam("script", "execScript")
        }

        switch script {
        case "writeSharedFile":
            try executeWriteSharedFile(action)
        default:
            XCTFail("Unknown execScript: \(script)")
        }
    }

    private func executeWriteSharedFile(_ action: TestAction) throws {
        guard let args = action.args else {
            throw ActionError.missingParam("args", "execScript/writeSharedFile")
        }

        let content: String
        if let fixtureName = args["fixture"]?.stringValue {
            content = try readFixture(fixtureName)
        } else if let textContent = args["content"]?.stringValue {
            content = textContent
        } else {
            throw ActionError.missingParam("fixture or content", "execScript/writeSharedFile")
        }

        let filename = args["filename"]?.stringValue ?? "test.md"

        // Write to a temporary location that the app can access.
        // In XCUITest, we write to a temp directory and store the path for openURL.
        let tempDir = NSTemporaryDirectory()
        let inboxDir = (tempDir as NSString).appendingPathComponent("TestInbox")
        try FileManager.default.createDirectory(atPath: inboxDir, withIntermediateDirectories: true)

        let filePath = (inboxDir as NSString).appendingPathComponent(filename)
        try content.write(toFile: filePath, atomically: true, encoding: .utf8)

        // Store for openURL placeholder resolution
        sharedFilePath = filePath.replacingOccurrences(of: "^/", with: "", options: .regularExpression)
    }
}

// MARK: - Errors

enum ActionError: Error, LocalizedError {
    case missingSelector(String)
    case missingParam(String, String)
    case fixtureNotFound(String, String)

    var errorDescription: String? {
        switch self {
        case .missingSelector(let action):
            return "No element selector (target or text) in action: \(action)"
        case .missingParam(let param, let action):
            return "Missing required param '\(param)' in action: \(action)"
        case .fixtureNotFound(let name, let path):
            return "Fixture '\(name)' not found at: \(path)"
        }
    }
}
