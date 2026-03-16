import XCTest
@testable import LiftMark

final class DatabaseBackupServiceTests: XCTestCase {

    override func setUp() {
        super.setUp()
        // Ensure a clean database exists for each test
        _ = try? DatabaseManager.shared.database()
    }

    override func tearDown() {
        super.tearDown()
    }

    // MARK: - Export

    func testExportProducesFile() throws {
        let exportURL = try DatabaseBackupService.exportDatabase()
        XCTAssertTrue(FileManager.default.fileExists(atPath: exportURL.path))

        // Verify file name contains "liftmark_backup_"
        XCTAssertTrue(exportURL.lastPathComponent.hasPrefix("liftmark_backup_"))
        XCTAssertTrue(exportURL.lastPathComponent.hasSuffix(".db"))

        // Verify file is non-empty
        let attributes = try FileManager.default.attributesOfItem(atPath: exportURL.path)
        let fileSize = attributes[.size] as? Int ?? 0
        XCTAssertGreaterThan(fileSize, 0)

        // Cleanup
        try? FileManager.default.removeItem(at: exportURL)
    }

    func testExportedFileIsValidDatabase() throws {
        let exportURL = try DatabaseBackupService.exportDatabase()
        XCTAssertTrue(DatabaseBackupService.validateDatabaseFile(at: exportURL))

        // Cleanup
        try? FileManager.default.removeItem(at: exportURL)
    }

    // MARK: - Validate

    func testValidateAcceptsGoodDatabase() throws {
        // Export creates a known-good database file
        let exportURL = try DatabaseBackupService.exportDatabase()
        XCTAssertTrue(DatabaseBackupService.validateDatabaseFile(at: exportURL))

        // Cleanup
        try? FileManager.default.removeItem(at: exportURL)
    }

    func testValidateRejectsNonExistentFile() {
        let fakeURL = FileManager.default.temporaryDirectory.appendingPathComponent("nonexistent.db")
        XCTAssertFalse(DatabaseBackupService.validateDatabaseFile(at: fakeURL))
    }

    func testValidateRejectsEmptyFile() throws {
        let tempURL = FileManager.default.temporaryDirectory.appendingPathComponent("empty.db")
        try? FileManager.default.removeItem(at: tempURL)
        FileManager.default.createFile(atPath: tempURL.path, contents: Data())
        XCTAssertFalse(DatabaseBackupService.validateDatabaseFile(at: tempURL))

        // Cleanup
        try? FileManager.default.removeItem(at: tempURL)
    }

    func testValidateRejectsTextFile() throws {
        let tempURL = FileManager.default.temporaryDirectory.appendingPathComponent("notadb.db")
        try? FileManager.default.removeItem(at: tempURL)
        try "This is not a database".write(to: tempURL, atomically: true, encoding: .utf8)
        XCTAssertFalse(DatabaseBackupService.validateDatabaseFile(at: tempURL))

        // Cleanup
        try? FileManager.default.removeItem(at: tempURL)
    }

    // MARK: - Import

    func testImportReplacesData() throws {
        // Export the current database
        let exportURL = try DatabaseBackupService.exportDatabase()

        // Import it back (should succeed without error)
        try DatabaseBackupService.importDatabase(from: exportURL)

        // Verify database is still accessible after import
        let db = try DatabaseManager.shared.database()
        XCTAssertNotNil(db)

        // Cleanup
        try? FileManager.default.removeItem(at: exportURL)
    }

    // MARK: - Database Path

    func testGetDatabasePathReturnsValidPath() throws {
        let path = try DatabaseBackupService.getDatabasePath()
        XCTAssertTrue(path.path.contains("SQLite"))
        XCTAssertTrue(path.path.hasSuffix("liftmark.db"))
    }

    // MARK: - BackupError

    func testBackupErrorDescriptions() {
        let notFound = BackupError.databaseNotFound
        XCTAssertTrue(notFound.localizedDescription.contains("Database file not found"))

        let importFailed = BackupError.importFailed("test reason")
        XCTAssertTrue(importFailed.localizedDescription.contains("test reason"))
    }
}
