import Foundation
import ActivityKit

// Shared between main app and LiveWorkouts widget extension.
// Both targets must include this file in their sources.

struct WorkoutActivityAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        /// Whether the activity is in rest timer mode
        var isRestTimer: Bool

        /// Current exercise name (or "Rest" in rest mode)
        var exerciseName: String

        /// "Set X/Y" for current exercise
        var setInfo: String

        /// Formatted weight × reps (e.g., "185 lbs × 5")
        var weightReps: String

        /// Name of the next exercise (nil if last)
        var nextExerciseName: String?

        /// Next set details (e.g., "135 lbs × 8")
        var nextSetDetail: String?

        /// 0.0 to 1.0 progress ratio
        var progress: Double

        /// Timer target date (rest mode only)
        var timerEndDate: Date?
    }

    var workoutName: String
}
