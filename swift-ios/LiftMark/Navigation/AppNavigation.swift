import SwiftUI

/// Defines the navigation destinations used throughout the app.
enum AppDestination: Hashable {
    case workoutDetail(id: String)
    case activeWorkout
    case workoutSummary
    case historyDetail(id: String)
    case gymDetail(id: String)
    case importWorkout
    case workoutSettings
    case syncSettings
    case debugLogs
}
