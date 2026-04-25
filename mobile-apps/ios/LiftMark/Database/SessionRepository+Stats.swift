import Foundation
import GRDB

// Aggregate read queries (best-weight lookups) split out from SessionRepository
// to keep the main file under SwiftLint's type_body_length limits.
extension SessionRepository {

    /// Get best weight + reps for each exercise across all completed sessions.
    func getExerciseBestWeights() throws -> [String: (weight: Double, reps: Int, unit: String)] {
        let dbQueue = try dbManager.database()
        return try dbQueue.read { db in
            let rows = try Row.fetchAll(db, sql: """
                SELECT
                    se.exercise_name,
                    MAX(COALESCE(mw_actual.value, mw_target.value, 0)) as max_weight,
                    COALESCE(mr_actual.value, mr_target.value, 0) as reps,
                    COALESCE(mw_actual.unit, mw_target.unit, 'lbs') as unit
                FROM session_exercises se
                JOIN workout_sessions ws ON ws.id = se.workout_session_id
                JOIN session_sets ss ON ss.session_exercise_id = se.id
                LEFT JOIN set_measurements mw_actual ON mw_actual.set_id = ss.id
                    AND mw_actual.parent_type = 'session' AND mw_actual.kind = 'weight' AND mw_actual.role = 'actual'
                LEFT JOIN set_measurements mw_target ON mw_target.set_id = ss.id
                    AND mw_target.parent_type = 'session' AND mw_target.kind = 'weight' AND mw_target.role = 'target'
                LEFT JOIN set_measurements mr_actual ON mr_actual.set_id = ss.id
                    AND mr_actual.parent_type = 'session' AND mr_actual.kind = 'reps' AND mr_actual.role = 'actual'
                LEFT JOIN set_measurements mr_target ON mr_target.set_id = ss.id
                    AND mr_target.parent_type = 'session' AND mr_target.kind = 'reps' AND mr_target.role = 'target'
                WHERE ws.status = 'completed' AND ss.status = 'completed'
                GROUP BY se.exercise_name
                HAVING max_weight > 0
                ORDER BY se.exercise_name
            """)

            var result: [String: (weight: Double, reps: Int, unit: String)] = [:]
            for row in rows {
                guard let name: String = row["exercise_name"],
                      let weight: Double = row["max_weight"] else { continue }
                let reps: Int = row["reps"] ?? 0
                let unit: String = row["unit"] ?? "lbs"
                result[name] = (weight, reps, unit)
            }
            return result
        }
    }

    /// Best weights normalized by canonical exercise name. Merges aliases so
    /// "Bench Press" and "Barbell Bench Press" share one entry.
    func getExerciseBestWeightsNormalized() throws -> [String: (weight: Double, reps: Int, unit: String)] {
        let raw = try getExerciseBestWeights()
        var merged: [String: (weight: Double, reps: Int, unit: String)] = [:]
        for (name, data) in raw {
            let canonical = ExerciseDictionary.getCanonicalName(name)
            if let existing = merged[canonical] {
                if data.weight > existing.weight {
                    merged[canonical] = data
                }
            } else {
                merged[canonical] = data
            }
        }
        return merged
    }
}
