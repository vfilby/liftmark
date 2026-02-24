import XCTest
@testable import LiftMark

final class SecureStorageTests: XCTestCase {

    // MARK: - validateAnthropicApiKey

    func testValidKeyFormat() {
        let validKey = "sk-ant-" + String(repeating: "a", count: 95)
        XCTAssertTrue(SecureStorage.validateAnthropicApiKey(validKey))
    }

    func testValidKeyWithMixedChars() {
        let validKey = "sk-ant-" + String(repeating: "aB1_-", count: 20)
        XCTAssertTrue(SecureStorage.validateAnthropicApiKey(validKey))
    }

    func testRejectsEmptyString() {
        XCTAssertFalse(SecureStorage.validateAnthropicApiKey(""))
    }

    func testRejectsWhitespaceOnly() {
        XCTAssertFalse(SecureStorage.validateAnthropicApiKey("   "))
    }

    func testRejectsWrongPrefix() {
        let key = "sk-wrong-" + String(repeating: "a", count: 95)
        XCTAssertFalse(SecureStorage.validateAnthropicApiKey(key))
    }

    func testRejectsTooShortKey() {
        let key = "sk-ant-" + String(repeating: "a", count: 50)
        XCTAssertFalse(SecureStorage.validateAnthropicApiKey(key))
    }

    func testRejectsKeyWithSpecialChars() {
        let key = "sk-ant-" + String(repeating: "a", count: 90) + "!@#$%"
        XCTAssertFalse(SecureStorage.validateAnthropicApiKey(key))
    }

    func testTrimsWhitespaceBeforeValidation() {
        let validKey = "  sk-ant-" + String(repeating: "a", count: 95) + "  "
        XCTAssertTrue(SecureStorage.validateAnthropicApiKey(validKey))
    }

    func testRejectsRandomString() {
        XCTAssertFalse(SecureStorage.validateAnthropicApiKey("not-an-api-key"))
    }

    func testKeyExactly95CharsAfterPrefix() {
        let key = "sk-ant-" + String(repeating: "x", count: 95)
        XCTAssertTrue(SecureStorage.validateAnthropicApiKey(key))
    }

    func testKeyMoreThan95CharsAfterPrefix() {
        let key = "sk-ant-" + String(repeating: "x", count: 200)
        XCTAssertTrue(SecureStorage.validateAnthropicApiKey(key))
    }

    func testKey94CharsAfterPrefixFails() {
        let key = "sk-ant-" + String(repeating: "x", count: 94)
        XCTAssertFalse(SecureStorage.validateAnthropicApiKey(key))
    }
}
