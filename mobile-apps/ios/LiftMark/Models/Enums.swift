import Foundation

// MARK: - Weight Unit

enum WeightUnit: String, Codable, Hashable, CaseIterable {
    case lbs
    case kg
}

// MARK: - Set Status (SessionSet lifecycle)

enum SetStatus: String, Codable, Hashable, CaseIterable {
    case pending
    case completed
    case skipped
    case failed
}

// MARK: - Exercise Status (SessionExercise lifecycle)

enum ExerciseStatus: String, Codable, Hashable, CaseIterable {
    case pending
    case inProgress = "in_progress"
    case completed
    case skipped
}

// MARK: - Session Status (WorkoutSession lifecycle)

enum SessionStatus: String, Codable, Hashable, CaseIterable {
    case inProgress = "in_progress"
    case completed
    case canceled
}

// MARK: - Group Type

enum GroupType: String, Codable, Hashable, CaseIterable {
    case superset
    case section
}

// MARK: - Theme

enum AppTheme: String, Codable, Hashable, CaseIterable {
    case light
    case dark
    case auto
}

// MARK: - API Key Status

enum ApiKeyStatus: String, Codable, Hashable, CaseIterable {
    case verified
    case invalid
    case notSet = "not_set"
}

// MARK: - Chart Metric Type

enum ChartMetricType: String, Codable, Hashable, CaseIterable {
    case maxWeight
    case totalVolume
    case reps
    case time
}

// MARK: - Trend

enum Trend: String, Codable, Hashable, CaseIterable {
    case improving
    case stable
    case declining
}
