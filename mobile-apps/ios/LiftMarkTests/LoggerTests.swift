import XCTest
import GRDB
import Logging
@testable import LiftMark

/// Tests for the Logger service.
///
/// NOTE: Logger is a singleton that writes asynchronously to a serial dispatch queue.
/// Other tests may call `deleteDatabase()` which removes the SQLite file and the
/// `app_logs` table with it. Since Logger.shared only creates that table once during
/// init, we must re-create it in setUp if it's missing.
///
/// Tests use unique message prefixes to avoid cross-test interference without needing
/// to clear the database between tests. A polling helper waits for writes to appear.
final class LoggerTests: XCTestCase {

    override func setUp() {
        super.setUp()
        // Ensure the app_logs table exists. Other test suites call deleteDatabase()
        // which removes the file, and Logger's singleton init won't re-create it.
        ensureAppLogsTableExists()
    }

    /// Re-create the app_logs table if it was lost due to database deletion by other tests.
    private func ensureAppLogsTableExists() {
        do {
            let db = try DatabaseManager.shared.database()
            try db.write { db in
                try db.execute(sql: """
                    CREATE TABLE IF NOT EXISTS app_logs (
                        id TEXT PRIMARY KEY,
                        timestamp TEXT NOT NULL,
                        level TEXT NOT NULL,
                        category TEXT NOT NULL,
                        message TEXT NOT NULL,
                        metadata TEXT,
                        stack_trace TEXT,
                        device_info TEXT,
                        created_at TEXT DEFAULT CURRENT_TIMESTAMP
                    )
                """)
                try db.execute(sql: "CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON app_logs(timestamp DESC)")
                try db.execute(sql: "CREATE INDEX IF NOT EXISTS idx_logs_level ON app_logs(level)")
                try db.execute(sql: "CREATE INDEX IF NOT EXISTS idx_logs_category ON app_logs(category)")
            }
        } catch {
            // If this fails, the tests will fail with clear error messages
        }
    }

    /// Poll until a log entry with the given message appears, or timeout.
    @discardableResult
    private func waitForLog(
        _ message: String,
        level: LogLevel? = nil,
        category: LogCategory? = nil,
        timeout: TimeInterval = 10.0
    ) -> [LogEntry] {
        let deadline = Date().addingTimeInterval(timeout)
        while Date() < deadline {
            let logs = Logger.shared.getLogs(limit: 200, level: level, category: category)
            if logs.contains(where: { $0.message == message }) {
                return logs
            }
            Thread.sleep(forTimeInterval: 0.1)
        }
        return Logger.shared.getLogs(limit: 200, level: level, category: category)
    }

    /// Generate a unique prefix for this test invocation to avoid cross-test pollution.
    private func prefix(_ base: String = #function) -> String {
        "\(base)-\(UUID().uuidString.prefix(6))"
    }

    // MARK: - Log Writing and Retrieval

    func testInfoLogIsWrittenAndRetrieved() {
        let tag = prefix()
        Logger.shared.info(.app, tag)

        let logs = waitForLog(tag)
        let match = logs.first { $0.message == tag }
        XCTAssertNotNil(match, "Should find the logged info message")
        XCTAssertEqual(match?.level, .info)
        XCTAssertEqual(match?.category, .app)
    }

    func testDebugLogLevel() {
        let tag = prefix()
        Logger.shared.debug(.database, tag)

        let logs = waitForLog(tag, level: .debug)
        let match = logs.first { $0.message == tag }
        XCTAssertNotNil(match)
        XCTAssertEqual(match?.level, .debug)
        XCTAssertEqual(match?.category, .database)
    }

    func testWarnLogLevel() {
        let tag = prefix()
        Logger.shared.warn(.network, tag)

        let logs = waitForLog(tag, level: .warn)
        let match = logs.first { $0.message == tag }
        XCTAssertNotNil(match)
        XCTAssertEqual(match?.level, .warn)
    }

    func testErrorLogLevelWithStackTrace() {
        let tag = prefix()
        let testError = NSError(domain: "test", code: 42, userInfo: [NSLocalizedDescriptionKey: "test error"])
        Logger.shared.error(.sync, tag, error: testError)

        let logs = waitForLog(tag, level: .error)
        let match = logs.first { $0.message == tag }
        XCTAssertNotNil(match)
        XCTAssertEqual(match?.level, .error)
        XCTAssertNotNil(match?.stackTrace, "Error logs should capture the error as stackTrace")
    }

    // MARK: - Categories

    func testFilterByCategory() {
        let navTag = prefix("nav")
        let dbTag = prefix("db")
        Logger.shared.info(.navigation, navTag)
        Logger.shared.info(.database, dbTag)

        let navLogs = waitForLog(navTag, category: .navigation)
        XCTAssertNotNil(navLogs.first { $0.message == navTag })
        XCTAssertNil(navLogs.first { $0.message == dbTag }, "Navigation filter should not include database logs")
    }

    func testFilterByCategoryAndLevel() {
        let infoTag = prefix("info")
        let warnTag = prefix("warn")
        Logger.shared.info(.app, infoTag)
        Logger.shared.warn(.app, warnTag)

        let logs = waitForLog(warnTag, level: .warn, category: .app)
        XCTAssertNotNil(logs.first { $0.message == warnTag })
        XCTAssertNil(logs.first { $0.message == infoTag }, "Warn filter should not include info logs")
    }

    // MARK: - Metadata

    func testLogWithMetadata() {
        let tag = prefix()
        let metadata = ["key1": "value1", "key2": "value2"]
        Logger.shared.info(.userAction, tag, metadata: metadata)

        let logs = waitForLog(tag)
        let match = logs.first { $0.message == tag }
        XCTAssertNotNil(match)
        XCTAssertEqual(match?.metadata?["key1"], "value1")
        XCTAssertEqual(match?.metadata?["key2"], "value2")
    }

    // MARK: - Log Limit

    func testGetLogsRespectsLimit() {
        let tag = prefix()
        for i in 0..<20 {
            Logger.shared.info(.app, "\(tag)-\(i)")
        }
        waitForLog("\(tag)-19")

        let limited = Logger.shared.getLogs(limit: 5)
        XCTAssertEqual(limited.count, 5, "Should return at most 5 logs")
    }

    func testGetLogsOrderedByTimestampDescending() {
        let firstTag = prefix("first")
        let secondTag = prefix("second")

        Logger.shared.info(.app, firstTag)
        waitForLog(firstTag)
        // ISO8601 has second-level precision, so wait >1s for distinct timestamps
        Thread.sleep(forTimeInterval: 1.1)
        Logger.shared.info(.app, secondTag)
        waitForLog(secondTag)

        let logs = Logger.shared.getLogs(limit: 200)
        let messages = logs.map { $0.message }

        guard let secondIdx = messages.firstIndex(of: secondTag),
              let firstIdx = messages.firstIndex(of: firstTag) else {
            XCTFail("Both log messages should be present")
            return
        }
        XCTAssertLessThan(secondIdx, firstIdx, "Newer log should appear first (DESC order)")
    }

    // MARK: - Clear Logs

    func testClearLogsRemovesAll() {
        let tag = prefix()
        Logger.shared.info(.app, tag)
        waitForLog(tag)

        Logger.shared.clearLogs()
        // clearLogs also writes "All logs cleared" asynchronously
        waitForLog("All logs cleared")

        let logs = Logger.shared.getLogs()
        let match = logs.first { $0.message == tag }
        XCTAssertNil(match, "Cleared logs should not be retrievable")
    }

    // MARK: - Export

    func testExportLogsReturnsValidJSON() {
        let tag = prefix()
        Logger.shared.info(.app, tag)
        waitForLog(tag)

        let exported = Logger.shared.exportLogs()
        XCTAssertFalse(exported.isEmpty)
        XCTAssertNotEqual(exported, "{}")

        let data = exported.data(using: .utf8)!
        let parsed = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
        XCTAssertNotNil(parsed)
        XCTAssertNotNil(parsed?["exportedAt"])
        XCTAssertNotNil(parsed?["logs"])
    }

    // MARK: - Device Info

    func testDeviceInfoCapture() {
        let info = Logger.shared.getDeviceInformation()
        XCTAssertEqual(info.platform, "ios")
        XCTAssertFalse(info.osVersion.isEmpty, "OS version should not be empty")
        XCTAssertEqual(info.buildType, "development", "Tests run in DEBUG so buildType should be development")
        XCTAssertTrue(info.isSimulator, "Tests typically run in simulator")
    }

    // MARK: - Log Entry Structure

    func testLogEntryHasTimestamp() {
        let tag = prefix()
        Logger.shared.info(.app, tag)

        let logs = waitForLog(tag)
        let match = logs.first { $0.message == tag }
        XCTAssertNotNil(match)
        XCTAssertFalse(match!.timestamp.isEmpty, "Log entry should have a timestamp")

        let formatter = ISO8601DateFormatter()
        let date = formatter.date(from: match!.timestamp)
        XCTAssertNotNil(date, "Timestamp should be valid ISO8601")
    }

    func testLogEntryHasId() {
        let tag = prefix()
        Logger.shared.info(.app, tag)

        let logs = waitForLog(tag)
        let match = logs.first { $0.message == tag }
        XCTAssertNotNil(match?.id)
        XCTAssertTrue(match!.id!.hasPrefix("log_"), "Log IDs should start with 'log_'")
    }

    // MARK: - All Categories Writable

    func testAllCategoriesCanBeUsed() {
        let tag = prefix()
        for category in LogCategory.allCases {
            Logger.shared.info(category, "\(tag)-\(category.rawValue)")
        }
        let lastCategory = LogCategory.allCases.last!
        waitForLog("\(tag)-\(lastCategory.rawValue)")

        let logs = Logger.shared.getLogs(limit: 200)
        for category in LogCategory.allCases {
            let match = logs.first { $0.message == "\(tag)-\(category.rawValue)" }
            XCTAssertNotNil(match, "Should be able to log with category \(category.rawValue)")
        }
    }

    // MARK: - swift-log facade (GH #93)

    /// Verifies an idiomatic swift-log call round-trips through `SQLiteLogHandler`
    /// and lands in the SQLite `app_logs` table with the correct category (mapped
    /// from the label), level, and metadata.
    func testSwiftLogRoundTripsToSQLiteStore() {
        // Ensure bootstrap ran; Logger.shared.init() triggers it, and it's idempotent.
        _ = Logger.shared
        LiftMarkLogging.bootstrap()

        let tag = prefix("swiftlog")
        var logger = Logging.Logger(label: LogCategory.sync.loggerLabel)
        logger.logLevel = .debug
        logger.warning(Logging.Logger.Message(stringLiteral: tag), metadata: ["custom_key": "custom_value"])

        let logs = waitForLog(tag, level: .warn, category: .sync)
        let match = logs.first { $0.message == tag }
        XCTAssertNotNil(match, "Log sent via swift-log should land in the SQLite store")
        XCTAssertEqual(match?.level, .warn)
        XCTAssertEqual(match?.category, .sync, "Label `liftmark.sync` should round-trip to .sync category")
        XCTAssertEqual(match?.metadata?["custom_key"], "custom_value", "Caller metadata must be preserved")
        XCTAssertNotNil(match?.metadata?["file"], "Handler must record call-site file")
        XCTAssertNotNil(match?.metadata?["function"], "Handler must record call-site function")
        XCTAssertNotNil(match?.metadata?["line"], "Handler must record call-site line")
    }

    /// Verifies `LiftMarkLogging.logger(_:)` produces a logger whose output also
    /// round-trips — this is the idiomatic call-site helper for new code.
    func testLiftMarkLoggingHelperRoundTrips() {
        _ = Logger.shared
        LiftMarkLogging.bootstrap()

        let tag = prefix("helper")
        var logger = LiftMarkLogging.logger(.navigation)
        logger.logLevel = .debug
        logger.info(Logging.Logger.Message(stringLiteral: tag))

        let logs = waitForLog(tag, level: .info, category: .navigation)
        XCTAssertNotNil(logs.first { $0.message == tag })
    }

    /// Unknown labels must bucket to `.app` with the original label preserved
    /// in metadata, so third-party packages that bootstrap their own labels
    /// don't corrupt `DebugLogsView` category filters.
    func testUnknownLabelBucketsToAppCategory() {
        _ = Logger.shared
        LiftMarkLogging.bootstrap()

        let tag = prefix("unknown")
        var logger = Logging.Logger(label: "com.third-party.weird-label")
        logger.logLevel = .debug
        logger.info(Logging.Logger.Message(stringLiteral: tag))

        let logs = waitForLog(tag, category: .app)
        let match = logs.first { $0.message == tag }
        XCTAssertNotNil(match, "Unknown labels should still persist")
        XCTAssertEqual(match?.category, .app)
        XCTAssertEqual(match?.metadata?["logger_label"], "com.third-party.weird-label")
    }

    // MARK: - All Levels Writable

    func testAllLevelsCanBeUsed() {
        let tag = prefix()
        Logger.shared.debug(.app, "\(tag)-debug")
        Logger.shared.info(.app, "\(tag)-info")
        Logger.shared.warn(.app, "\(tag)-warn")
        Logger.shared.error(.app, "\(tag)-error")
        waitForLog("\(tag)-error")

        let logs = Logger.shared.getLogs(limit: 200)
        XCTAssertNotNil(logs.first { $0.message == "\(tag)-debug" })
        XCTAssertNotNil(logs.first { $0.message == "\(tag)-info" })
        XCTAssertNotNil(logs.first { $0.message == "\(tag)-warn" })
        XCTAssertNotNil(logs.first { $0.message == "\(tag)-error" })
    }
}
