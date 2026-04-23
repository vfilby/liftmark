import SwiftUI

/// Top bar for the active workout screen with pause, notes, and finish controls.
///
/// Add Exercise is intentionally NOT in the top bar — it lives as a primary-styled
/// bottom action button (see `ActiveWorkoutFooter`) so the top cluster stays
/// readable on iPhone and the add action is larger and easier to hit mid-workout.
struct ActiveWorkoutHeader: View {
    let sessionName: String
    /// True when the active session already has non-empty notes. Used to badge the
    /// notes button so the user can see, at a glance, that notes exist.
    var hasNotes: Bool = false
    let onPause: () -> Void
    let onNotes: () -> Void
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
                onNotes()
            } label: {
                Image(systemName: hasNotes ? "note.text" : "square.and.pencil")
            }
            .accessibilityIdentifier("active-workout-notes-button")
            .accessibilityLabel(hasNotes ? "Edit workout notes" : "Add workout notes")
            .accessibilityHint("Opens a free-text editor for notes on this workout")

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

/// Bottom action bar for the active workout screen.
///
/// Houses the primary **Add Exercise** button (moved out of the cramped top bar,
/// per #98) and a secondary bottom **Finish** button (per #99) so the user does not
/// have to reach back up to the top-right corner on large iPhones. The top-bar
/// Finish button is preserved for users who end from the top.
struct ActiveWorkoutFooter: View {
    let onAddExercise: () -> Void
    let onFinish: () -> Void

    var body: some View {
        HStack(spacing: LiftMarkTheme.spacingSM) {
            Button {
                onAddExercise()
            } label: {
                Label("Add Exercise", systemImage: "plus")
                    .font(.subheadline.weight(.semibold))
                    .frame(maxWidth: .infinity, minHeight: 44)
            }
            .buttonStyle(.borderedProminent)
            .accessibilityIdentifier("active-workout-add-exercise-button")
            .accessibilityLabel("Add exercise")
            .accessibilityHint("Opens a sheet to add a new exercise to this workout")

            Button {
                onFinish()
            } label: {
                // Bottom button uses a distinct label from the top-bar "Finish" so
                // text-based UI test matchers (which search for `Finish`, `Finish Anyway`,
                // `Log Anyway` in confirm alerts) can't accidentally match this button
                // when the confirm alert is what should be hit.
                Text("End Workout")
                    .font(.subheadline.weight(.semibold))
                    .frame(maxWidth: .infinity, minHeight: 44)
            }
            .buttonStyle(.bordered)
            .accessibilityIdentifier("active-workout-footer-finish-button")
            .accessibilityLabel("End workout")
            .accessibilityHint("Completes and saves the workout session")
        }
        .padding(.horizontal)
        .padding(.vertical, LiftMarkTheme.spacingSM)
        .background(.bar)
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("active-workout-footer")
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
