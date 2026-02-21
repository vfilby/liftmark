import Foundation

#if os(iOS)
import ActivityKit

// MARK: - Workout Activity Attributes

struct WorkoutActivityAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        var title: String
        var subtitle: String
        var progress: Double // 0.0 to 1.0
        var timerEndDate: Date?
    }

    var workoutName: String
}
#endif

// MARK: - LiveActivityService

final class LiveActivityService {
    static let shared = LiveActivityService()

    #if os(iOS)
    @available(iOS 16.2, *)
    private var currentActivity: Activity<WorkoutActivityAttributes>?
    #endif

    private init() {}

    // MARK: - Availability

    /// Check if Live Activities are available (iOS 16.2+).
    func isAvailable() -> Bool {
        #if os(iOS)
        if #available(iOS 16.2, *) {
            return ActivityAuthorizationInfo().areActivitiesEnabled
        }
        #endif
        return false
    }

    // MARK: - Start

    /// Start a Live Activity for a workout session.
    func startWorkoutActivity(
        session: WorkoutSession,
        exercise: SessionExercise?,
        setIndex: Int,
        progress: (completed: Int, total: Int)
    ) {
        #if os(iOS)
        guard isAvailable() else { return }

        if #available(iOS 16.2, *) {
            // End any existing activity first
            endWorkoutActivity()

            do {
                let state: WorkoutActivityAttributes.ContentState
                if let exercise {
                    state = buildActiveSetState(exercise: exercise, setIndex: setIndex, progress: progress)
                } else {
                    state = WorkoutActivityAttributes.ContentState(
                        title: session.name,
                        subtitle: "Starting workout...",
                        progress: 0
                    )
                }

                let attributes = WorkoutActivityAttributes(workoutName: session.name)
                let content = ActivityContent(state: state, staleDate: nil)

                let activity = try Activity.request(
                    attributes: attributes,
                    content: content,
                    pushType: nil
                )
                currentActivity = activity
            } catch {
                // Silently fail — Live Activities are optional
            }
        }
        #endif
    }

    // MARK: - Update

    /// Update the Live Activity with current workout state.
    func updateWorkoutActivity(
        session: WorkoutSession,
        exercise: SessionExercise?,
        setIndex: Int,
        progress: (completed: Int, total: Int),
        restTimer: (remainingSeconds: Int, nextExercise: SessionExercise?)? = nil
    ) {
        #if os(iOS)
        guard isAvailable() else { return }

        if #available(iOS 16.2, *) {
            guard let activity = currentActivity else { return }

            let state: WorkoutActivityAttributes.ContentState

            if let restTimer, restTimer.remainingSeconds > 0 {
                state = buildRestState(
                    remainingSeconds: restTimer.remainingSeconds,
                    nextExercise: restTimer.nextExercise,
                    progress: progress
                )
            } else if let exercise {
                state = buildActiveSetState(exercise: exercise, setIndex: setIndex, progress: progress)
            } else {
                return
            }

            let content = ActivityContent(state: state, staleDate: nil)
            Task {
                await activity.update(content)
            }
        }
        #endif
    }

    // MARK: - End

    /// End the Live Activity with an optional completion message.
    func endWorkoutActivity(message: String? = nil) {
        #if os(iOS)
        guard isAvailable() else { return }

        if #available(iOS 16.2, *) {
            guard let activity = currentActivity else { return }

            let finalState = WorkoutActivityAttributes.ContentState(
                title: message ?? "Workout Complete",
                subtitle: "Great job!",
                progress: 1.0
            )

            let content = ActivityContent(state: finalState, staleDate: nil)
            Task {
                await activity.end(content, dismissalPolicy: .default)
            }
            currentActivity = nil
        }
        #endif
    }

    // MARK: - Display State Builders

    #if os(iOS)
    @available(iOS 16.2, *)
    private func buildActiveSetState(
        exercise: SessionExercise,
        setIndex: Int,
        progress: (completed: Int, total: Int)
    ) -> WorkoutActivityAttributes.ContentState {
        let set = exercise.sets.indices.contains(setIndex) ? exercise.sets[setIndex] : nil
        let setNumber = setIndex + 1
        let totalSets = exercise.sets.count

        let weight = formatWeight(set?.targetWeight, unit: set?.targetWeightUnit)
        let reps = set?.targetReps.map { String($0) } ?? "?"

        let progressValue = progress.total > 0 ? Double(progress.completed) / Double(progress.total) : 0

        return WorkoutActivityAttributes.ContentState(
            title: exercise.exerciseName,
            subtitle: "Set \(setNumber)/\(totalSets) \u{2022} \(weight) \u{00D7} \(reps)",
            progress: progressValue
        )
    }

    @available(iOS 16.2, *)
    private func buildRestState(
        remainingSeconds: Int,
        nextExercise: SessionExercise?,
        progress: (completed: Int, total: Int)
    ) -> WorkoutActivityAttributes.ContentState {
        let nextPreview = nextExercise.map { "Next: \($0.exerciseName)" } ?? "Finishing up"
        let progressValue = progress.total > 0 ? Double(progress.completed) / Double(progress.total) : 0
        let timerEnd = Date().addingTimeInterval(TimeInterval(remainingSeconds))

        return WorkoutActivityAttributes.ContentState(
            title: "Rest",
            subtitle: nextPreview,
            progress: progressValue,
            timerEndDate: timerEnd
        )
    }
    #endif

    private func formatWeight(_ weight: Double?, unit: WeightUnit?) -> String {
        guard let weight, weight > 0 else { return "BW" }
        return "\(Int(weight)) \(unit?.rawValue ?? "lbs")"
    }
}
