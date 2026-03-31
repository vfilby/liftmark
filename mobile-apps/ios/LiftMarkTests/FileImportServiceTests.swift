import XCTest
@testable import LiftMark

final class FileImportServiceTests: XCTestCase {

    // MARK: - isFileImportUrl

    func testIsFileImportUrlWithMarkdownExtension() {
        XCTAssertTrue(FileImportService.isFileImportUrl("file:///tmp/workout.md"))
    }

    func testIsFileImportUrlWithTxtExtension() {
        XCTAssertTrue(FileImportService.isFileImportUrl("file:///tmp/workout.txt"))
    }

    func testIsFileImportUrlWithMarkdownLongExtension() {
        XCTAssertTrue(FileImportService.isFileImportUrl("file:///tmp/workout.markdown"))
    }

    func testIsFileImportUrlWithLiftmarkScheme() {
        XCTAssertTrue(FileImportService.isFileImportUrl("liftmark:///tmp/workout.md"))
    }

    func testIsFileImportUrlRejectsUnsupportedExtension() {
        XCTAssertFalse(FileImportService.isFileImportUrl("file:///tmp/workout.json"))
        XCTAssertFalse(FileImportService.isFileImportUrl("file:///tmp/workout.pdf"))
        XCTAssertFalse(FileImportService.isFileImportUrl("file:///tmp/workout.csv"))
    }

    func testIsFileImportUrlRejectsUnsupportedScheme() {
        XCTAssertFalse(FileImportService.isFileImportUrl("https://example.com/workout.md"))
        XCTAssertFalse(FileImportService.isFileImportUrl("http://example.com/workout.md"))
    }

    func testIsFileImportUrlRejectsInvalidUrl() {
        XCTAssertFalse(FileImportService.isFileImportUrl("not a url"))
        XCTAssertFalse(FileImportService.isFileImportUrl(""))
    }

    // MARK: - readSharedFile

    func testReadSharedFileSuccess() throws {
        let tempFile = try createTempFile(content: "# Push Day\n## Bench\n- 225 x 5", extension: "md")
        defer { try? FileManager.default.removeItem(at: tempFile) }

        let result = FileImportService.readSharedFile("file://\(tempFile.path)")
        XCTAssertTrue(result.success)
        XCTAssertNotNil(result.markdown)
        XCTAssertTrue(result.markdown!.contains("Push Day"))
        XCTAssertNotNil(result.fileName)
    }

    func testReadSharedFileRejectsUnsupportedExtension() throws {
        let tempFile = try createTempFile(content: "data", extension: "json")
        defer { try? FileManager.default.removeItem(at: tempFile) }

        let result = FileImportService.readSharedFile("file://\(tempFile.path)")
        XCTAssertFalse(result.success)
        XCTAssertTrue(result.error?.contains("Unsupported file type") ?? false)
    }

    func testReadSharedFileRejectsNonexistentFile() {
        let result = FileImportService.readSharedFile("file:///tmp/nonexistent_\(UUID().uuidString).md")
        XCTAssertFalse(result.success)
        XCTAssertTrue(result.error?.contains("not found") ?? false)
    }

    func testReadSharedFileRejectsEmptyFile() throws {
        let tempFile = try createTempFile(content: "", extension: "md")
        defer { try? FileManager.default.removeItem(at: tempFile) }

        let result = FileImportService.readSharedFile("file://\(tempFile.path)")
        XCTAssertFalse(result.success)
        XCTAssertTrue(result.error?.contains("empty") ?? false)
    }

    func testReadSharedFileRejectsWhitespaceOnlyFile() throws {
        let tempFile = try createTempFile(content: "   \n\n  ", extension: "md")
        defer { try? FileManager.default.removeItem(at: tempFile) }

        let result = FileImportService.readSharedFile("file://\(tempFile.path)")
        XCTAssertFalse(result.success)
        XCTAssertTrue(result.error?.contains("empty") ?? false)
    }

    func testReadSharedFileRejectsUnsupportedScheme() {
        let result = FileImportService.readSharedFile("https://example.com/workout.md")
        XCTAssertFalse(result.success)
        XCTAssertTrue(result.error?.contains("Unsupported URL scheme") ?? false)
    }

    func testReadSharedFileWithLiftmarkScheme() throws {
        let tempFile = try createTempFile(content: "# Test\n## Ex\n- 100 x 5", extension: "md")
        defer { try? FileManager.default.removeItem(at: tempFile) }

        // liftmark:// scheme strips leading slash and re-adds it
        let path = tempFile.path
        let result = FileImportService.readSharedFile("liftmark://\(path)")
        XCTAssertTrue(result.success)
    }

    func testReadSharedFileTxtExtension() throws {
        let tempFile = try createTempFile(content: "# Workout\n## Push-ups\n- 20", extension: "txt")
        defer { try? FileManager.default.removeItem(at: tempFile) }

        let result = FileImportService.readSharedFile("file://\(tempFile.path)")
        XCTAssertTrue(result.success)
        XCTAssertTrue(result.markdown?.contains("Workout") ?? false)
    }

    // MARK: - validateDeepLinkPath

    func testValidateDeepLinkPathAllowsTempDirectory() {
        let tempDir = NSTemporaryDirectory()
        let path = (tempDir as NSString).appendingPathComponent("workout.md")
        XCTAssertNotNil(FileImportService.validateDeepLinkPath(path))
    }

    func testValidateDeepLinkPathAllowsDocumentsDirectory() {
        let docs = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first!
        let path = docs.appendingPathComponent("workout.md").path
        XCTAssertNotNil(FileImportService.validateDeepLinkPath(path))
    }

    func testValidateDeepLinkPathAllowsInboxDirectory() {
        let docs = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first!
        let path = docs.appendingPathComponent("Inbox/workout.txt").path
        XCTAssertNotNil(FileImportService.validateDeepLinkPath(path))
    }

    func testValidateDeepLinkPathAllowsMarkdownExtension() {
        let tempDir = NSTemporaryDirectory()
        XCTAssertNotNil(FileImportService.validateDeepLinkPath(
            (tempDir as NSString).appendingPathComponent("file.markdown")))
    }

    func testValidateDeepLinkPathRejectsTraversalAttack() {
        let tempDir = NSTemporaryDirectory()
        let malicious = (tempDir as NSString).appendingPathComponent("../../etc/passwd")
        XCTAssertNil(FileImportService.validateDeepLinkPath(malicious))
    }

    func testValidateDeepLinkPathRejectsArbitraryPath() {
        XCTAssertNil(FileImportService.validateDeepLinkPath("/etc/passwd"))
    }

    func testValidateDeepLinkPathRejectsDisallowedExtension() {
        let tempDir = NSTemporaryDirectory()
        let path = (tempDir as NSString).appendingPathComponent("secrets.json")
        XCTAssertNil(FileImportService.validateDeepLinkPath(path))
    }

    func testValidateDeepLinkPathRejectsNoExtension() {
        let tempDir = NSTemporaryDirectory()
        let path = (tempDir as NSString).appendingPathComponent("workout")
        XCTAssertNil(FileImportService.validateDeepLinkPath(path))
    }

    func testValidateDeepLinkPathRejectsTraversalOutOfTmpViaDotDot() {
        // Construct a path that starts in tmp but traverses out
        let tempDir = (NSTemporaryDirectory() as NSString).standardizingPath
        let malicious = tempDir + "/subdir/../../etc/passwd"
        XCTAssertNil(FileImportService.validateDeepLinkPath(malicious))
    }

    // MARK: - Helpers

    private func createTempFile(content: String, extension ext: String) throws -> URL {
        let tempDir = FileManager.default.temporaryDirectory
        let fileName = "test_\(UUID().uuidString).\(ext)"
        let fileURL = tempDir.appendingPathComponent(fileName)
        try content.write(to: fileURL, atomically: true, encoding: .utf8)
        return fileURL
    }
}
