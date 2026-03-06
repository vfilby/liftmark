import Foundation
import ActivityKit

// Shared between main app and LiveWorkouts widget extension.
// Both targets must include this file in their sources.

struct WorkoutActivityAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        var title: String
        var subtitle: String
        var progress: Double // 0.0 to 1.0
        var timerEndDate: Date?
    }

    var workoutName: String
}
