import Foundation

/// Service for generating compact workout history summaries for AI prompts.
/// Format is designed to be token-efficient while providing useful context.
struct WorkoutHistoryService {
    private let repository = SessionRepository()

    /// Generate a compact formatted summary of recent workouts plus PRs.
    func generateWorkoutHistoryContext(recentCount: Int = 5) throws -> String {
        let recentSessions = try repository.getRecentSessions(recentCount)
        let bestWeights = try repository.getExerciseBestWeights()

        var parts: [String] = []

        if !recentSessions.isEmpty {
            parts.append("Recent workouts:")
            for session in recentSessions {
                parts.append(formatSessionCompact(session))
            }
        }

        // Best weights for exercises not in recent workouts
        var recentExerciseNames = Set<String>()
        for session in recentSessions {
            for exercise in session.exercises where !exercise.sets.isEmpty {
                recentExerciseNames.insert(exercise.exerciseName.lowercased())
            }
        }

        let additionalWeights = bestWeights.compactMap { (name, data) -> String? in
            guard !recentExerciseNames.contains(name.lowercased()) else { return nil }
            return "\(name): \(Int(data.weight))\(data.unit)x\(data.reps)"
        }

        if !additionalWeights.isEmpty {
            parts.append("")
            parts.append("Other exercise PRs: " + additionalWeights.joined(separator: ", "))
        }

        return parts.joined(separator: "\n")
    }

    /// Format a single workout session in compact format.
    /// Example: "2024-01-15 Push Day: Bench 185x8,205x5; Incline DB 60x10,70x8"
    func formatSessionCompact(_ session: WorkoutSession) -> String {
        let date = session.date.split(separator: "T").first.map(String.init) ?? session.date
        let exercises = session.exercises
            .filter { !$0.sets.isEmpty }
            .map { formatExerciseCompact($0) }
            .filter { !$0.isEmpty }

        return "\(date) \(session.name): \(exercises.joined(separator: "; "))"
    }

    /// Format a single exercise in compact format.
    /// Example: "Bench 185x8,205x5,225x3"
    func formatExerciseCompact(_ exercise: SessionExercise) -> String {
        let completedSets = exercise.sets.filter { $0.status == .completed }
        guard !completedSets.isEmpty else { return "" }

        let name = abbreviateExerciseName(exercise.exerciseName)
        let sets = completedSets.map { formatSetCompact($0) }.filter { !$0.isEmpty }
        guard !sets.isEmpty else { return "" }

        return "\(name) \(sets.joined(separator: ","))"
    }

    /// Format a single set in compact format.
    /// Example: "185x8" or "30s" or "bwx10"
    func formatSetCompact(_ set: SessionSet) -> String {
        let weight = set.actualWeight ?? set.targetWeight
        let reps = set.actualReps ?? set.targetReps
        let time = set.actualTime ?? set.targetTime

        if let time, reps == nil {
            return "\(time)s"
        }

        if let reps {
            if let weight, weight > 0 {
                return "\(Int(weight))x\(reps)"
            }
            return "bwx\(reps)"
        }

        return ""
    }

    /// Abbreviate common exercise names to save tokens.
    func abbreviateExerciseName(_ name: String) -> String {
        let abbreviations: [String: String] = [
            "barbell bench press": "Bench",
            "bench press": "Bench",
            "incline bench press": "Inc Bench",
            "incline dumbbell press": "Inc DB",
            "dumbbell bench press": "DB Bench",
            "overhead press": "OHP",
            "military press": "OHP",
            "barbell squat": "Squat",
            "back squat": "Squat",
            "front squat": "Fr Squat",
            "deadlift": "DL",
            "romanian deadlift": "RDL",
            "barbell row": "Row",
            "bent over row": "Row",
            "dumbbell row": "DB Row",
            "lat pulldown": "Pulldown",
            "pull-ups": "Pullups",
            "pull ups": "Pullups",
            "chin-ups": "Chinups",
            "chin ups": "Chinups",
            "bicep curls": "Curls",
            "dumbbell bicep curls": "DB Curls",
            "tricep pushdowns": "Pushdowns",
            "tricep extensions": "Tri Ext",
            "leg press": "Leg Press",
            "leg curl": "Leg Curl",
            "leg extension": "Leg Ext",
            "calf raises": "Calves",
            "lateral raises": "Lat Raise",
            "face pulls": "Face Pull",
            "cable flyes": "Flyes",
            "dumbbell flyes": "DB Flyes",
            "push-ups": "Pushups",
            "push ups": "Pushups",
        ]

        return abbreviations[name.lowercased()] ?? name
    }

    /// Check if there's any workout history available.
    func hasWorkoutHistory() throws -> Bool {
        let sessions = try repository.getRecentSessions(1)
        return !sessions.isEmpty
    }
}
