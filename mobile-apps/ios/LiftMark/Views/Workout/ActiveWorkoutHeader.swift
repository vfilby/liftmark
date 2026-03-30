import SwiftUI

/// Top bar for the active workout screen with pause, add, and finish controls.
struct ActiveWorkoutHeader: View {
    let sessionName: String
    let onPause: () -> Void
    let onAddExercise: () -> Void
    let onFinish: () -> Void

    var body: some View {
        HStack(spacing: LiftMarkTheme.spacingSM) {
            Button {
                onPause()
            } label: {
                HStack(spacing: 4) {
                    Image(systemName: "pause.fill")
                        .font(.caption)
                    Text("Pause")
                        .font(.subheadline)
                }
            }
            .accessibilityIdentifier("active-workout-pause-button")
            .accessibilityLabel("Pause workout")
            .accessibilityHint("Returns to home screen without ending the workout")

            Spacer()

            Text(sessionName)
                .font(.headline)
                .lineLimit(1)

            Spacer()

            Button {
                onAddExercise()
            } label: {
                Image(systemName: "plus")
            }
            .accessibilityIdentifier("active-workout-add-exercise-button")
            .accessibilityLabel("Add exercise")
            .accessibilityHint("Opens a sheet to add a new exercise to this workout")

            Button {
                onFinish()
            } label: {
                Text("Finish")
                    .font(.subheadline.bold())
            }
            .accessibilityIdentifier("active-workout-finish-button")
            .accessibilityLabel("Finish workout")
            .accessibilityHint("Completes and saves the workout session")
        }
        .padding()
        .background(LiftMarkTheme.background)
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("active-workout-header")
    }
}

/// Progress bar showing completed sets count.
struct ActiveWorkoutProgressBar: View {
    let progress: Double
    let completedSets: Int
    let totalSets: Int

    var body: some View {
        VStack(spacing: 4) {
            ProgressView(value: progress)
                .tint(progress >= 1.0 ? LiftMarkTheme.success : LiftMarkTheme.primary)
            Text("\(completedSets) / \(totalSets) sets completed")
                .font(.caption)
                .foregroundStyle(LiftMarkTheme.secondaryLabel)
        }
        .padding(.horizontal)
        .padding(.bottom, LiftMarkTheme.spacingSM)
        .accessibilityIdentifier("active-workout-progress")
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Workout progress")
        .accessibilityValue("\(completedSets) of \(totalSets) sets completed")
    }
}
