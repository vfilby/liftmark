import Foundation
import GRDB

/// Repository for querying exercise history and progress metrics.
struct ExerciseHistoryRepository {
    private let dbManager: DatabaseManager

    init(dbManager: DatabaseManager = .shared) {
        self.dbManager = dbManager
    }

    /// Get all unique exercise names from completed sessions.
    func getAllExerciseNames() throws -> [String] {
        let dbQueue = try dbManager.database()
        return try dbQueue.read { db in
            let rows = try Row.fetchAll(db, sql: """
                SELECT DISTINCT se.exercise_name
                FROM session_exercises se
                JOIN workout_sessions ws ON ws.id = se.workout_session_id
                WHERE ws.status = 'completed'
                ORDER BY se.exercise_name
            """)
            return rows.map { $0["exercise_name"] as String }
        }
    }

    /// Get history data points for a specific exercise.
    func getHistory(forExercise exerciseName: String) throws -> [ExerciseHistoryPoint] {
        let dbQueue = try dbManager.database()
        return try dbQueue.read { db in
            let rows = try Row.fetchAll(db, sql: """
                SELECT
                    ws.date,
                    ws.start_time,
                    ws.name as workout_name,
                    MAX(COALESCE(ss.actual_weight, ss.target_weight, 0)) as max_weight,
                    AVG(COALESCE(ss.actual_reps, ss.target_reps, 0)) as avg_reps,
                    SUM(COALESCE(ss.actual_weight, ss.target_weight, 0) * COALESCE(ss.actual_reps, ss.target_reps, 0)) as total_volume,
                    COUNT(ss.id) as sets_count,
                    AVG(COALESCE(ss.actual_time, 0)) as avg_time,
                    MAX(COALESCE(ss.actual_time, 0)) as max_time,
                    COALESCE(ss.actual_weight_unit, ss.target_weight_unit, 'lbs') as unit
                FROM session_exercises se
                JOIN workout_sessions ws ON ws.id = se.workout_session_id
                JOIN session_sets ss ON ss.session_exercise_id = se.id
                WHERE se.exercise_name = ? AND ws.status = 'completed' AND ss.status = 'completed'
                GROUP BY ws.id
                ORDER BY ws.date DESC
            """, arguments: [exerciseName])

            return rows.compactMap { row -> ExerciseHistoryPoint? in
                guard let date: String = row["date"],
                      let workoutName: String = row["workout_name"] else { return nil }
                return ExerciseHistoryPoint(
                    date: date,
                    startTime: row["start_time"],
                    workoutName: workoutName,
                    maxWeight: row["max_weight"] ?? 0,
                    avgReps: row["avg_reps"] ?? 0,
                    totalVolume: row["total_volume"] ?? 0,
                    setsCount: row["sets_count"] ?? 0,
                    avgTime: row["avg_time"] ?? 0,
                    maxTime: row["max_time"] ?? 0,
                    unit: WeightUnit(rawValue: row["unit"] ?? "lbs") ?? .lbs
                )
            }
        }
    }

    /// Get the max weight recorded for a specific exercise.
    func getMaxWeight(forExercise exerciseName: String) throws -> (weight: Double, unit: WeightUnit)? {
        let dbQueue = try dbManager.database()
        return try dbQueue.read { db in
            let row = try Row.fetchOne(db, sql: """
                SELECT
                    MAX(COALESCE(ss.actual_weight, ss.target_weight, 0)) as max_weight,
                    COALESCE(ss.actual_weight_unit, ss.target_weight_unit, 'lbs') as unit
                FROM session_exercises se
                JOIN workout_sessions ws ON ws.id = se.workout_session_id
                JOIN session_sets ss ON ss.session_exercise_id = se.id
                WHERE se.exercise_name = ? AND ws.status = 'completed' AND ss.status = 'completed'
            """, arguments: [exerciseName])

            guard let row, let weight: Double = row["max_weight"], weight > 0 else { return nil }
            let unit = WeightUnit(rawValue: row["unit"] ?? "lbs") ?? .lbs
            return (weight, unit)
        }
    }
}
