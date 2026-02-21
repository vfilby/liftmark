import Foundation

/// Errors thrown during workout export operations.
enum ExportError: LocalizedError {
    case noCompletedWorkouts
    case fileWriteFailed(String)

    var errorDescription: String? {
        switch self {
        case .noCompletedWorkouts:
            return "No completed workouts to export."
        case .fileWriteFailed(let reason):
            return "Failed to write export file: \(reason)"
        }
    }
}

/// Service for exporting workout sessions as portable JSON files.
/// Strips internal database IDs to produce clean, shareable data.
struct WorkoutExportService {
    private let repository = SessionRepository()

    /// Export all completed sessions to a single JSON file.
    /// Returns the file URL for sharing.
    func exportSessionsAsJson() throws -> URL {
        let sessions = try repository.getCompleted()

        guard !sessions.isEmpty else {
            throw ExportError.noCompletedWorkouts
        }

        let exportData: [String: Any] = [
            "exportedAt": ISO8601DateFormatter().string(from: Date()),
            "appVersion": appVersion(),
            "sessions": sessions.map { stripSession($0) }
        ]

        let timestamp = ISO8601DateFormatter().string(from: Date())
            .replacingOccurrences(of: ":", with: "-")
            .replacingOccurrences(of: "T", with: "_")
            .replacingOccurrences(of: "Z", with: "")
        let fileName = "liftmark_workouts_\(timestamp).json"

        return try writeExportFile(exportData, fileName: fileName)
    }

    /// Export a single workout session as a portable JSON file.
    /// Returns the file URL for sharing.
    func exportSingleSessionAsJson(_ session: WorkoutSession) throws -> URL {
        let exportData: [String: Any] = [
            "exportedAt": ISO8601DateFormatter().string(from: Date()),
            "appVersion": appVersion(),
            "session": stripSession(session)
        ]

        let fileName = buildSessionFileName(name: session.name, date: session.date)
        return try writeExportFile(exportData, fileName: fileName)
    }

    /// Build a sanitized file name: workout-{name}-{date}.json
    func buildSessionFileName(name: String, date: String) -> String {
        var sanitized = name.lowercased()
        sanitized = sanitized.folding(options: .diacriticInsensitive, locale: .current)
        sanitized = sanitized.replacingOccurrences(
            of: "[^\\w\\s-]",
            with: "",
            options: .regularExpression
        )
        sanitized = sanitized.replacingOccurrences(
            of: "\\s+",
            with: "-",
            options: .regularExpression
        )
        sanitized = sanitized.replacingOccurrences(
            of: "-+",
            with: "-",
            options: .regularExpression
        )
        sanitized = sanitized.trimmingCharacters(in: CharacterSet(charactersIn: "-"))
        if sanitized.count > 50 {
            sanitized = String(sanitized.prefix(50))
        }

        let datePart = date.split(separator: "T").first.map(String.init)
            ?? ISO8601DateFormatter().string(from: Date()).split(separator: "T").first.map(String.init)
            ?? "unknown"
        let namePart = sanitized.isEmpty ? "workout" : sanitized

        return "workout-\(namePart)-\(datePart).json"
    }

    // MARK: - Private

    private func appVersion() -> String {
        Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0.0"
    }

    private func writeExportFile(_ data: [String: Any], fileName: String) throws -> URL {
        let jsonData = try JSONSerialization.data(withJSONObject: data, options: [.prettyPrinted, .sortedKeys])
        let cacheDir = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first!
        let fileURL = cacheDir.appendingPathComponent(fileName)
        try jsonData.write(to: fileURL)
        return fileURL
    }

    private func stripSession(_ session: WorkoutSession) -> [String: Any] {
        var dict: [String: Any] = [
            "name": session.name,
            "date": session.date,
            "status": session.status.rawValue,
            "exercises": session.exercises.map { stripExercise($0) }
        ]
        if let startTime = session.startTime { dict["startTime"] = startTime }
        if let endTime = session.endTime { dict["endTime"] = endTime }
        if let duration = session.duration { dict["duration"] = duration }
        if let notes = session.notes { dict["notes"] = notes }
        return dict
    }

    private func stripExercise(_ exercise: SessionExercise) -> [String: Any] {
        var dict: [String: Any] = [
            "exerciseName": exercise.exerciseName,
            "orderIndex": exercise.orderIndex,
            "status": exercise.status.rawValue,
            "sets": exercise.sets.map { stripSet($0) }
        ]
        if let notes = exercise.notes { dict["notes"] = notes }
        if let equipmentType = exercise.equipmentType { dict["equipmentType"] = equipmentType }
        if let groupType = exercise.groupType { dict["groupType"] = groupType.rawValue }
        if let groupName = exercise.groupName { dict["groupName"] = groupName }
        return dict
    }

    private func stripSet(_ set: SessionSet) -> [String: Any] {
        var dict: [String: Any] = [
            "orderIndex": set.orderIndex,
            "status": set.status.rawValue,
            "isDropset": set.isDropset,
            "isPerSide": set.isPerSide
        ]
        if let v = set.targetWeight { dict["targetWeight"] = v }
        if let v = set.targetWeightUnit { dict["targetWeightUnit"] = v.rawValue }
        if let v = set.targetReps { dict["targetReps"] = v }
        if let v = set.targetTime { dict["targetTime"] = v }
        if let v = set.targetRpe { dict["targetRpe"] = v }
        if let v = set.restSeconds { dict["restSeconds"] = v }
        if let v = set.actualWeight { dict["actualWeight"] = v }
        if let v = set.actualWeightUnit { dict["actualWeightUnit"] = v.rawValue }
        if let v = set.actualReps { dict["actualReps"] = v }
        if let v = set.actualTime { dict["actualTime"] = v }
        if let v = set.actualRpe { dict["actualRpe"] = v }
        if let v = set.completedAt { dict["completedAt"] = v }
        if let v = set.notes { dict["notes"] = v }
        if let v = set.tempo { dict["tempo"] = v }
        return dict
    }
}
