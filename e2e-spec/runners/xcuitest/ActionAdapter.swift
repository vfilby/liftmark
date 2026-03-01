@preconcurrency import XCTest
import UIKit
@preconcurrency import Foundation

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

    /// Track if first launch has happened (for data reset isolation).
    private var isFirstLaunch = true

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
        // Tab bar: ALWAYS use tab bar buttons for tab-* identifiers.
        // The .accessibilityIdentifier on tab content (NavigationStack) only
        // works for the active tab and tapping it hits the content area
        // instead of the tab bar button.
        if identifier.hasPrefix("tab-") {
            if let label = tabIdToLabel[identifier] {
                let tabButton = app.tabBars.buttons[label]
                if tabButton.exists { return tabButton }
            }
            let tabButtons = app.tabBars.buttons
            for i in 0..<tabButtons.count {
                let button = tabButtons.element(boundBy: i)
                if button.identifier == identifier {
                    return button
                }
            }
            // Return label-based query (will resolve when tab bar appears)
            if let label = tabIdToLabel[identifier] {
                return app.tabBars.buttons[label]
            }
        }

        // Use firstMatch to handle SwiftUI toolbar items that create
        // duplicate accessibility elements (wrapper + button).
        let el = app.descendants(matching: .any).matching(identifier: identifier).firstMatch

        // If found immediately, return it.
        if el.exists { return el }

        // SwiftUI TextFields and TextEditors sometimes don't expose their
        // .accessibilityIdentifier via the generic descendants query when
        // a parent view also has an identifier. Try specific element types.
        let textField = app.textFields.matching(identifier: identifier).firstMatch
        if textField.exists { return textField }

        let textView = app.textViews.matching(identifier: identifier).firstMatch
        if textView.exists { return textView }

        let button = app.buttons.matching(identifier: identifier).firstMatch
        if button.exists { return button }

        let toggle = app.switches.matching(identifier: identifier).firstMatch
        if toggle.exists { return toggle }

        // Return the original element (may not exist yet — caller handles waiting)
        return el
    }

    /// Waits for an element across multiple XCUITest element types.
    /// SwiftUI sometimes only exposes accessibility identifiers through
    /// type-specific queries (textFields, textViews, etc.) rather than
    /// the generic descendants query.
    private func waitForAnyElement(byId identifier: String, timeout: TimeInterval) -> XCUIElement? {
        let deadline = Date().addingTimeInterval(timeout)

        // Tab bar buttons: always check tab bar first for tab-* identifiers
        if identifier.hasPrefix("tab-") {
            if let label = tabIdToLabel[identifier] {
                let tabButton = app.tabBars.buttons[label]
                if tabButton.waitForExistence(timeout: min(timeout, 3)) { return tabButton }
            }
        }

        // Try the generic descendants query first with native waitForExistence
        let el = app.descendants(matching: .any).matching(identifier: identifier).firstMatch
        if el.waitForExistence(timeout: min(timeout, 2)) { return el }

        // Fall back to type-specific queries in a polling loop (less frequent)
        while Date() < deadline {
            // Re-check generic query
            if el.exists { return el }

            // Type-specific queries for elements that don't expose via descendants
            for query in [app.textFields, app.searchFields, app.textViews,
                          app.buttons, app.switches, app.otherElements] {
                let match = query.matching(identifier: identifier).firstMatch
                if match.exists { return match }
            }

            Thread.sleep(forTimeInterval: 0.5)
        }
        return nil
    }

    /// Maps tab accessibility identifiers to their tab bar label text.
    /// Set by the test setup to enable tab navigation.
    var tabIdToLabel: [String: String] = [:]

    private func element(byText text: String) -> XCUIElement {
        let staticText = app.staticTexts[text]
        if staticText.exists { return staticText }
        // Also check alert buttons — SwiftUI alerts render buttons
        // that may not appear as static texts.
        let alertButton = app.alerts.buttons[text]
        if alertButton.exists { return alertButton }
        // Check regular buttons too
        let button = app.buttons[text]
        if button.exists { return button }
        // Fallback: check if text is contained within a combined accessibility label
        if let match = findElementContainingText(text) { return match }
        return staticText
    }

    /// Finds any element whose label contains the given text.
    /// This handles SwiftUI containers that combine child Text accessibility labels.
    /// Note: avoid descendants(matching: .any) with CONTAINS — it can crash
    /// when traversing elements with null attributes (SIGSEGV in strcmp).
    private func findElementContainingText(_ text: String) -> XCUIElement? {
        let predicate = NSPredicate(format: "label CONTAINS %@", text)
        let match = app.staticTexts.matching(predicate).firstMatch
        if match.exists { return match }
        let btnMatch = app.buttons.matching(predicate).firstMatch
        if btnMatch.exists { return btnMatch }
        let otherMatch = app.otherElements.matching(predicate).firstMatch
        if otherMatch.exists { return otherMatch }
        return nil
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
        if let target = action.target {
            if let el = waitForAnyElement(byId: target, timeout: 5) {
                el.tap()
                return
            }
            XCTFail("Element '\(target)' not found for tap")
        } else if let text = action.text {
            let el = element(byText: text)
            XCTAssertTrue(el.waitForExistence(timeout: 5), "Text '\(text)' not found for tap")
            el.tap()
        } else {
            throw ActionError.missingSelector(action.action)
        }
    }

    private func executeLongPress(_ action: TestAction) throws {
        guard let target = action.target else {
            throw ActionError.missingParam("target", "longPress")
        }
        guard let el = waitForAnyElement(byId: target, timeout: 5) else {
            XCTFail("Element '\(target)' not found for longPress")
            return
        }
        el.press(forDuration: 1.0)
    }

    private func executeTapText(_ action: TestAction) throws {
        guard let text = action.text else {
            throw ActionError.missingParam("text", "tapText")
        }
        // Try exact matches first with native waiter
        let alertButton = app.alerts.buttons[text].firstMatch
        if alertButton.waitForExistence(timeout: 2) {
            alertButton.tap()
            return
        }

        let containsPredicate = NSPredicate(format: "label CONTAINS %@", text)
        let deadline = Date().addingTimeInterval(5)
        while Date() < deadline {
            let staticTextByLabel = app.staticTexts[text].firstMatch
            if staticTextByLabel.exists {
                staticTextByLabel.tap()
                return
            }
            let button = app.buttons[text].firstMatch
            if button.exists {
                button.tap()
                return
            }
            let containsMatch = app.staticTexts.matching(containsPredicate).firstMatch
            if containsMatch.exists {
                containsMatch.tap()
                return
            }
            let btnContains = app.buttons.matching(containsPredicate).firstMatch
            if btnContains.exists {
                btnContains.tap()
                return
            }
            Thread.sleep(forTimeInterval: 0.5)
        }
        XCTFail("Text '\(text)' not found for tapText")
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
        guard let el = waitForAnyElement(byId: target, timeout: 5) else {
            XCTFail("Element '\(target)' not found for replaceText")
            return
        }

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
        // Select all and replace via pasteboard (avoids per-keystroke logging)
        el.press(forDuration: 1.0)
        if app.menuItems["Select All"].waitForExistence(timeout: 2) {
            app.menuItems["Select All"].tap()
        }
        UIPasteboard.general.string = textValue
        // Use Paste menu item if available, else fall back to typeText
        if app.menuItems["Paste"].waitForExistence(timeout: 2) {
            app.menuItems["Paste"].tap()
        } else {
            el.typeText(textValue)
        }
    }

    private func executeTypeText(_ action: TestAction) throws {
        guard let target = action.target, let value = action.value else {
            throw ActionError.missingParam("target and value", "typeText")
        }
        guard let el = waitForAnyElement(byId: target, timeout: 5) else {
            XCTFail("Element '\(target)' not found for typeText")
            return
        }
        el.tap()
        el.typeText(value)
    }

    private func executeWaitFor(_ action: TestAction) throws {
        let timeout = TimeInterval(action.timeout ?? 5000) / 1000.0
        if let target = action.target {
            let el = waitForAnyElement(byId: target, timeout: timeout)
            if el == nil {
                XCTFail("Timed out waiting for '\(target)' to exist")
                return
            }
        } else if let text = action.text {
            let el = element(byText: text)
            XCTAssertTrue(el.waitForExistence(timeout: timeout), "Timed out waiting for text '\(text)' to exist")
        } else {
            throw ActionError.missingSelector(action.action)
        }
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

        // Try exact-match first with native waiter (most efficient)
        if app.staticTexts[text].waitForExistence(timeout: min(timeout, 2)) { return }

        // Poll for text across alert buttons, regular buttons, text fields, and CONTAINS fallback
        let containsPredicate = NSPredicate(format: "label CONTAINS %@", text)
        let valuePredicate = NSPredicate(format: "value CONTAINS %@", text)
        let deadline = Date().addingTimeInterval(timeout)
        while Date() < deadline {
            if app.staticTexts[text].exists { return }
            if app.alerts.buttons[text].exists { return }
            if app.buttons[text].exists { return }
            if app.textFields.matching(valuePredicate).firstMatch.exists { return }
            if app.staticTexts.matching(containsPredicate).firstMatch.exists { return }
            if app.buttons.matching(containsPredicate).firstMatch.exists { return }
            Thread.sleep(forTimeInterval: 0.5)
        }
        XCTFail("Timed out waiting for text '\(text)'")
    }

    private func executeExpect(_ action: TestAction) throws {
        guard let assertion = action.assertion else {
            throw ActionError.missingParam("assertion", "expect")
        }

        let desc = action.target ?? action.text ?? ""

        switch assertion {
        case "toBeVisible":
            if let target = action.target {
                guard let el = waitForAnyElement(byId: target, timeout: 5) else {
                    XCTFail("Expected '\(desc)' to be visible")
                    return
                }
                XCTAssertTrue(el.isHittable, "Expected '\(desc)' to be visible (hittable)")
            } else {
                let el = try resolveElement(action)
                let exists = el.waitForExistence(timeout: 5)
                if !exists {
                    XCTFail("Expected '\(desc)' to be visible but not found")
                    return
                }
                XCTAssertTrue(el.isHittable, "Expected '\(desc)' to be visible (hittable)")
            }

        case "toExist":
            if let target = action.target {
                let el = waitForAnyElement(byId: target, timeout: 5)
                XCTAssertNotNil(el, "Expected '\(desc)' to exist")
            } else {
                let el = try resolveElement(action)
                XCTAssertTrue(el.waitForExistence(timeout: 5), "Expected '\(desc)' to exist")
            }

        case "toHaveText":
            let el = try resolveElement(action)
            XCTAssertTrue(el.waitForExistence(timeout: 5))
            let actual = (el.value as? String) ?? el.label
            XCTAssertEqual(actual, action.value, "Expected text '\(action.value ?? "")' but got '\(actual)'")

        case "notToBeVisible":
            let el = try resolveElement(action)
            if el.exists {
                XCTAssertFalse(el.isHittable, "Expected '\(desc)' not to be visible")
            }

        case "notToExist":
            let el = try resolveElement(action)
            XCTAssertFalse(el.exists, "Expected '\(desc)' not to exist")

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
        guard let el = waitForAnyElement(byId: target, timeout: 5) else {
            XCTFail("Element '\(target)' not found for scroll")
            return
        }

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
        // Reset data on first launch of each scenario for test isolation
        if isFirstLaunch {
            app.launchArguments = app.launchArguments.filter { $0 != "--reset-data" }
            app.launchArguments.append("--reset-data")
            isFirstLaunch = false
        } else {
            app.launchArguments = app.launchArguments.filter { $0 != "--reset-data" }
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

        // Use non-asserting execution for try block steps.
        // This avoids XCTAssert failures (which throw ObjC exceptions
        // with continueAfterFailure=false) that can't be caught by
        // Swift's do/catch.
        var trySucceeded = true
        for step in trySteps {
            if !tryExecuteStep(step) {
                trySucceeded = false
                break
            }
        }

        if !trySucceeded {
            let catchSteps = action.catchSteps ?? []
            for step in catchSteps {
                try execute(step)
            }
        }
    }

    /// Non-asserting execution of a step for use inside tryCatch try blocks.
    /// Returns true if the step succeeded, false otherwise.
    private func tryExecuteStep(_ action: TestAction) -> Bool {
        switch action.action {
        case "waitFor":
            let timeout = TimeInterval(action.timeout ?? 5000) / 1000.0
            if let target = action.target {
                return waitForAnyElement(byId: target, timeout: timeout) != nil
            }
            guard let el = try? resolveElement(action) else { return false }
            return el.waitForExistence(timeout: timeout)

        case "waitForText":
            guard let text = action.text else { return false }
            let timeout = TimeInterval(action.timeout ?? 5000) / 1000.0
            // Try exact match first with native waiter
            if app.staticTexts[text].waitForExistence(timeout: min(timeout, 2)) { return true }
            let containsPredicate = NSPredicate(format: "label CONTAINS %@", text)
            let textDeadline = Date().addingTimeInterval(timeout)
            while Date() < textDeadline {
                if app.staticTexts[text].exists { return true }
                if app.alerts.buttons[text].exists { return true }
                if app.buttons[text].exists { return true }
                if app.staticTexts.matching(containsPredicate).firstMatch.exists { return true }
                if app.buttons.matching(containsPredicate).firstMatch.exists { return true }
                Thread.sleep(forTimeInterval: 0.5)
            }
            return false

        case "waitForNot":
            guard let el = try? resolveElement(action) else { return true }
            let timeout = TimeInterval(action.timeout ?? 5000) / 1000.0
            let predicate = NSPredicate(format: "exists == false")
            let expectation = XCTNSPredicateExpectation(predicate: predicate, object: el)
            return XCTWaiter().wait(for: [expectation], timeout: timeout) == .completed

        case "expect":
            let assertion = action.assertion ?? ""
            if let target = action.target {
                let el = waitForAnyElement(byId: target, timeout: 5)
                switch assertion {
                case "toBeVisible":
                    return el != nil && el!.isHittable
                case "toExist":
                    return el != nil
                case "notToExist":
                    return el == nil || !el!.exists
                case "notToBeVisible":
                    return el == nil || !el!.isHittable
                default:
                    return false
                }
            }
            guard let el = try? resolveElement(action) else { return false }
            switch assertion {
            case "toBeVisible":
                return el.waitForExistence(timeout: 5) && el.isHittable
            case "toExist":
                return el.waitForExistence(timeout: 5)
            case "notToExist":
                return !el.exists
            case "notToBeVisible":
                return !el.exists || !el.isHittable
            default:
                return false
            }

        case "tap":
            if let target = action.target {
                guard let el = waitForAnyElement(byId: target, timeout: 5) else { return false }
                el.tap()
                return true
            }
            guard let el = try? resolveElement(action) else { return false }
            guard el.waitForExistence(timeout: 5) else { return false }
            el.tap()
            return true

        case "tapText":
            guard let text = action.text else { return false }
            // Try alert button first with short native wait
            let alertBtn = app.alerts.buttons[text]
            if alertBtn.waitForExistence(timeout: 1) { alertBtn.tap(); return true }
            let containsPred = NSPredicate(format: "label CONTAINS %@", text)
            let tapDeadline = Date().addingTimeInterval(3)
            while Date() < tapDeadline {
                let staticText = app.staticTexts[text]
                if staticText.exists { staticText.tap(); return true }
                let btn = app.buttons[text]
                if btn.exists { btn.tap(); return true }
                let containsMatch = app.staticTexts.matching(containsPred).firstMatch
                if containsMatch.exists { containsMatch.tap(); return true }
                let btnContains = app.buttons.matching(containsPred).firstMatch
                if btnContains.exists { btnContains.tap(); return true }
                Thread.sleep(forTimeInterval: 0.5)
            }
            return false

        default:
            // For unhandled actions, try executing normally
            do {
                try execute(action)
                return true
            } catch {
                return false
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

        guard let importButton = waitForAnyElement(byId: "button-import-workout", timeout: 5) else {
            XCTFail("button-import-workout not found for runFixture")
            return
        }
        importButton.tap()

        guard let inputMarkdown = waitForAnyElement(byId: "input-markdown", timeout: 10) else {
            XCTFail("input-markdown not found for runFixture")
            return
        }

        // Replace text in input via pasteboard (avoids per-keystroke logging)
        inputMarkdown.tap()
        inputMarkdown.press(forDuration: 1.0)
        if app.menuItems["Select All"].waitForExistence(timeout: 2) {
            app.menuItems["Select All"].tap()
        }
        UIPasteboard.general.string = content
        if app.menuItems["Paste"].waitForExistence(timeout: 2) {
            app.menuItems["Paste"].tap()
        } else {
            inputMarkdown.typeText(content)
        }

        guard let importBtn = waitForAnyElement(byId: "button-import", timeout: 5) else {
            XCTFail("button-import not found for runFixture")
            return
        }
        importBtn.tap()

        let okButton = app.alerts.buttons["OK"]
        XCTAssertTrue(okButton.waitForExistence(timeout: 10), "OK button not found after import")
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
