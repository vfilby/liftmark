import Foundation
import GRDB

// MARK: - Types

enum LogLevel: String, Codable, CaseIterable {
    case debug
    case info
    case warn
    case error
}

enum LogCategory: String, Codable, CaseIterable {
    case navigation
    case routing
    case app
    case database
    case network
    case userAction = "user_action"
    case errorBoundary = "error_boundary"
    case logger
}

struct LogEntry: Identifiable, Codable, Hashable {
    var id: String?
    var timestamp: String
    var level: LogLevel
    var category: LogCategory
    var message: String
    var metadata: [String: String]?
    var stackTrace: String?
}

struct DeviceInfo: Codable {
    var platform: String
    var osVersion: String
    var appVersion: String
    var buildType: String
    var isSimulator: Bool
    var deviceModel: String?
}

// MARK: - Logger

final class Logger {
    static let shared = Logger()

    private var isInitialized = false
    private var logQueue: [LogEntry] = []
    private let maxQueueSize = 100
    private let logRetentionDays = 7
    private let deviceInfo: DeviceInfo

    private init() {
        self.deviceInfo = Self.getDeviceInfo()
        initializeDatabase()
    }

    // MARK: - Device Info

    private static func getDeviceInfo() -> DeviceInfo {
        let osVersion = ProcessInfo.processInfo.operatingSystemVersion
        let osVersionString = "\(osVersion.majorVersion).\(osVersion.minorVersion).\(osVersion.patchVersion)"

        let appVersion = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "unknown"

        #if DEBUG
        let buildType = "development"
        #else
        let buildType = "production"
        #endif

        #if targetEnvironment(simulator)
        let isSimulator = true
        #else
        let isSimulator = false
        #endif

        return DeviceInfo(
            platform: "ios",
            osVersion: osVersionString,
            appVersion: appVersion,
            buildType: buildType,
            isSimulator: isSimulator,
            deviceModel: nil
        )
    }

    // MARK: - Database

    private func initializeDatabase() {
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

            isInitialized = true
            flushQueue()
            cleanOldLogs()
            info(.logger, "Logger initialized")
        } catch {
            print("[Logger] Failed to initialize database: \(error)")
        }
    }

    private func generateId() -> String {
        "log_\(Int(Date().timeIntervalSince1970 * 1000))_\(UUID().uuidString.prefix(9).lowercased())"
    }

    private func writeLog(_ entry: LogEntry) {
        guard isInitialized else {
            logQueue.append(entry)
            if logQueue.count > maxQueueSize {
                logQueue.removeFirst()
            }
            return
        }

        do {
            let db = try DatabaseManager.shared.database()
            let id = entry.id ?? generateId()
            let metadataJSON: String? = entry.metadata.flatMap { dict in
                guard let data = try? JSONEncoder().encode(dict) else { return nil }
                return String(data: data, encoding: .utf8)
            }
            let deviceInfoJSON: String? = {
                guard let data = try? JSONEncoder().encode(deviceInfo) else { return nil }
                return String(data: data, encoding: .utf8)
            }()

            try db.write { db in
                try db.execute(
                    sql: """
                        INSERT INTO app_logs (id, timestamp, level, category, message, metadata, stack_trace, device_info)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    arguments: [
                        id,
                        entry.timestamp,
                        entry.level.rawValue,
                        entry.category.rawValue,
                        entry.message,
                        metadataJSON,
                        entry.stackTrace,
                        deviceInfoJSON
                    ]
                )
            }
        } catch {
            print("[Logger] Failed to write log: \(error)")
        }
    }

    private func flushQueue() {
        let logsToFlush = logQueue
        logQueue.removeAll()
        for log in logsToFlush {
            writeLog(log)
        }
    }

    private func cleanOldLogs() {
        do {
            let db = try DatabaseManager.shared.database()
            let cutoffDate = Calendar.current.date(byAdding: .day, value: -logRetentionDays, to: Date()) ?? Date()
            let cutoffString = ISO8601DateFormatter().string(from: cutoffDate)

            try db.write { db in
                try db.execute(sql: "DELETE FROM app_logs WHERE timestamp < ?", arguments: [cutoffString])
            }
        } catch {
            print("[Logger] Failed to clean old logs: \(error)")
        }
    }

    // MARK: - Core Logging

    private func log(_ level: LogLevel, _ category: LogCategory, _ message: String, metadata: [String: String]? = nil, error: Error? = nil) {
        let entry = LogEntry(
            timestamp: ISO8601DateFormatter().string(from: Date()),
            level: level,
            category: category,
            message: message,
            metadata: metadata,
            stackTrace: error.map { String(describing: $0) }
        )

        #if DEBUG
        let prefix = "[\(category.rawValue)]"
        switch level {
        case .error:
            print("\(prefix) ERROR: \(message)", metadata ?? "", error ?? "")
        case .warn:
            print("\(prefix) WARN: \(message)", metadata ?? "")
        default:
            print("\(prefix) \(message)", metadata ?? "")
        }
        #endif

        writeLog(entry)
    }

    // MARK: - Public Logging Methods

    func debug(_ category: LogCategory, _ message: String, metadata: [String: String]? = nil) {
        log(.debug, category, message, metadata: metadata)
    }

    func info(_ category: LogCategory, _ message: String, metadata: [String: String]? = nil) {
        log(.info, category, message, metadata: metadata)
    }

    func warn(_ category: LogCategory, _ message: String, metadata: [String: String]? = nil) {
        log(.warn, category, message, metadata: metadata)
    }

    func error(_ category: LogCategory, _ message: String, error: Error? = nil, metadata: [String: String]? = nil) {
        log(.error, category, message, metadata: metadata, error: error)
    }

    // MARK: - Log Retrieval

    func getLogs(limit: Int = 100, level: LogLevel? = nil, category: LogCategory? = nil) -> [LogEntry] {
        do {
            let db = try DatabaseManager.shared.database()
            return try db.read { db in
                var sql = "SELECT * FROM app_logs WHERE 1=1"
                var arguments: [DatabaseValueConvertible] = []

                if let level {
                    sql += " AND level = ?"
                    arguments.append(level.rawValue)
                }
                if let category {
                    sql += " AND category = ?"
                    arguments.append(category.rawValue)
                }

                sql += " ORDER BY timestamp DESC LIMIT ?"
                arguments.append(limit)

                let rows = try Row.fetchAll(db, sql: sql, arguments: StatementArguments(arguments))
                return rows.map { row in
                    let metadataString: String? = row["metadata"]
                    let metadata: [String: String]? = metadataString.flatMap {
                        try? JSONDecoder().decode([String: String].self, from: Data($0.utf8))
                    }
                    return LogEntry(
                        id: row["id"],
                        timestamp: row["timestamp"],
                        level: LogLevel(rawValue: row["level"]) ?? .info,
                        category: LogCategory(rawValue: row["category"]) ?? .app,
                        message: row["message"],
                        metadata: metadata,
                        stackTrace: row["stack_trace"]
                    )
                }
            }
        } catch {
            print("[Logger] Failed to get logs: \(error)")
            return []
        }
    }

    func exportLogs() -> String {
        let logs = getLogs(limit: 1000)
        let exportData: [String: Any] = [
            "exportedAt": ISO8601DateFormatter().string(from: Date()),
            "logs": logs.map { [
                "id": $0.id ?? "",
                "timestamp": $0.timestamp,
                "level": $0.level.rawValue,
                "category": $0.category.rawValue,
                "message": $0.message
            ] }
        ]
        if let data = try? JSONSerialization.data(withJSONObject: exportData, options: .prettyPrinted) {
            return String(data: data, encoding: .utf8) ?? "{}"
        }
        return "{}"
    }

    func clearLogs() {
        do {
            let db = try DatabaseManager.shared.database()
            try db.write { db in
                try db.execute(sql: "DELETE FROM app_logs")
            }
            info(.logger, "All logs cleared")
        } catch {
            print("[Logger] Failed to clear logs: \(error)")
        }
    }

    func getDeviceInformation() -> DeviceInfo {
        deviceInfo
    }
}
