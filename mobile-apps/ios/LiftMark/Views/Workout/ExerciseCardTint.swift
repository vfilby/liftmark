import SwiftUI

/// Aggregate tint state for an exercise card on the active workout screen.
///
/// The tint is driven purely by the terminal statuses of the exercise's sets.
/// A set is considered "finalized" only when its status is `.completed` or
/// `.skipped`. An exercise whose sets are all finalized is either:
///   - `.completed` (every finalized set is `.completed`)
///   - `.skipped`   (every finalized set is `.skipped`)
///   - `.mixed`     (finalized sets include both completed and skipped)
///
/// Any pending (or otherwise non-terminal) set makes the card `.neutral` —
/// i.e., the rule applies only to *finalized* exercises.
enum ExerciseCardTint: Equatable {
    case neutral
    case completed
    case skipped
    case mixed

    /// Derive the aggregate tint from a collection of set statuses.
    ///
    /// - An empty collection is treated as `.neutral`.
    /// - If any set is not yet finalized (e.g., `.pending`, `.failed`), the
    ///   result is `.neutral` — the card reflects an in-progress or not-started
    ///   exercise, regardless of how many sets have already been completed or
    ///   skipped.
    /// - Otherwise, collapse based on the blend of completed vs. skipped.
    static func from(statuses: [SetStatus]) -> ExerciseCardTint {
        guard !statuses.isEmpty else { return .neutral }

        var hasCompleted = false
        var hasSkipped = false
        for status in statuses {
            switch status {
            case .completed: hasCompleted = true
            case .skipped:   hasSkipped = true
            case .pending, .failed:
                // Any non-terminal set keeps the card neutral.
                return .neutral
            }
        }

        switch (hasCompleted, hasSkipped) {
        case (true, false): return .completed
        case (false, true): return .skipped
        case (true, true):  return .mixed
        case (false, false): return .neutral // unreachable given non-empty input
        }
    }
}

// MARK: - SwiftUI presentation

#if canImport(UIKit)
extension ExerciseCardTint {
    /// Background fill for the card. For `.mixed`, returns a diagonal gradient
    /// from success (top-leading) to warning (bottom-trailing). All tints are
    /// applied at a low opacity over the card's existing `secondaryBackground`
    /// so text contrast is preserved in light and dark mode.
    @ViewBuilder
    var backgroundOverlay: some View {
        switch self {
        case .neutral:
            Color.clear
        case .completed:
            LiftMarkTheme.success.opacity(0.18)
        case .skipped:
            LiftMarkTheme.warning.opacity(0.18)
        case .mixed:
            LinearGradient(
                colors: [
                    LiftMarkTheme.success.opacity(0.22),
                    LiftMarkTheme.warning.opacity(0.22)
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        }
    }

    /// Accessibility description for the card's aggregate state. `nil` when
    /// neutral so callers can fall back to their default label.
    var accessibilityDescription: String? {
        switch self {
        case .neutral:   return nil
        case .completed: return "All sets completed"
        case .skipped:   return "All sets skipped"
        case .mixed:     return "Mixed completed and skipped sets"
        }
    }
}
#endif
