import SwiftUI

struct WorkoutSummaryView: View {
    @Environment(SessionStore.self) private var sessionStore
    @Environment(SettingsStore.self) private var settingsStore
    @Environment(\.dismiss) private var dismiss

    /// The most recently completed session (last in sessions list)
    private var session: WorkoutSession? {
        sessionStore.sessions.last
    }

    private var completedSets: Int {
        session?.exercises.reduce(0) { sum, ex in
            sum + ex.sets.filter { $0.status == .completed }.count
        } ?? 0
    }

    private var skippedSets: Int {
        session?.exercises.reduce(0) { sum, ex in
            sum + ex.sets.filter { $0.status == .skipped }.count
        } ?? 0
    }

    private var totalSets: Int {
        session?.exercises.reduce(0) { $0 + $1.sets.count } ?? 0
    }

    private var totalReps: Int {
        session?.exercises.reduce(0) { sum, ex in
            sum + ex.sets.filter { $0.status == .completed }.reduce(0) { $0 + ($1.actualReps ?? $1.targetReps ?? 0) }
        } ?? 0
    }

    private var totalVolume: Double {
        session?.exercises.reduce(0.0) { sum, ex in
            sum + ex.sets.filter { $0.status == .completed }.reduce(0.0) { setSum, set in
                let weight = set.actualWeight ?? set.targetWeight ?? 0
                let reps = Double(set.actualReps ?? set.targetReps ?? 0)
                return setSum + (weight * reps)
            }
        } ?? 0
    }

    private var durationText: String {
        guard let duration = session?.duration else { return "--" }
        let hours = duration / 3600
        let minutes = (duration % 3600) / 60
        if hours > 0 {
            return "\(hours)h \(minutes)m"
        }
        return "\(minutes)m"
    }

    private var completionRate: Double {
        guard totalSets > 0 else { return 0 }
        return Double(completedSets) / Double(totalSets)
    }

    private var highlights: [WorkoutHighlight] {
        computeHighlights()
    }

    var body: some View {
        ScrollView {
            VStack(spacing: LiftMarkTheme.spacingLG) {
                // Success Header
                VStack(spacing: LiftMarkTheme.spacingSM) {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 64))
                        .foregroundStyle(LiftMarkTheme.success)

                    Text("Workout Complete!")
                        .font(.title.bold())

                    if let name = session?.name {
                        Text(name)
                            .font(.subheadline)
                            .foregroundStyle(LiftMarkTheme.secondaryLabel)
                    }
                }
                .padding(.top, LiftMarkTheme.spacingLG)
                .accessibilityIdentifier("workout-summary-success-header")

                // Highlights
                Group {
                    if !highlights.isEmpty {
                        VStack(alignment: .leading, spacing: LiftMarkTheme.spacingSM) {
                            Text("Highlights")
                                .font(.headline)

                            ForEach(highlights) { highlight in
                                HStack(spacing: LiftMarkTheme.spacingSM) {
                                    Text(highlight.emoji)
                                        .font(.title2)

                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(highlight.title)
                                            .font(.subheadline.bold())
                                        Text(highlight.message)
                                            .font(.caption)
                                            .foregroundStyle(LiftMarkTheme.secondaryLabel)
                                    }

                                    Spacer()
                                }
                                .padding(.vertical, LiftMarkTheme.spacingXS)
                            }
                        }
                        .padding()
                        .background(LiftMarkTheme.secondaryBackground)
                        .clipShape(RoundedRectangle(cornerRadius: LiftMarkTheme.cornerRadiusMD))
                    } else {
                        VStack(spacing: LiftMarkTheme.spacingSM) {
                            Text("Highlights")
                                .font(.headline)
                            Text("Complete more workouts to see highlights and personal records.")
                                .font(.subheadline)
                                .foregroundStyle(LiftMarkTheme.secondaryLabel)
                                .multilineTextAlignment(.center)
                        }
                        .padding()
                        .background(LiftMarkTheme.secondaryBackground)
                        .clipShape(RoundedRectangle(cornerRadius: LiftMarkTheme.cornerRadiusMD))
                    }
                }
                .accessibilityIdentifier("workout-summary-highlights")

                // Stats Grid
                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: LiftMarkTheme.spacingMD) {
                    StatCard(title: "Duration", value: durationText, icon: "clock")
                    StatCard(title: "Sets", value: "\(completedSets)", icon: "repeat")
                    StatCard(title: "Reps", value: "\(totalReps)", icon: "number")
                    StatCard(title: "Volume", value: formatVolume(totalVolume), icon: "scalemass")
                }
                .accessibilityIdentifier("workout-summary-stats")

                // Completion Card
                VStack(spacing: LiftMarkTheme.spacingSM) {
                    Text("Completion")
                        .font(.headline)

                    HStack(spacing: LiftMarkTheme.spacingMD) {
                        VStack {
                            Text("\(completedSets)")
                                .font(.title2.bold())
                                .foregroundStyle(LiftMarkTheme.success)
                            Text("Completed")
                                .font(.caption)
                                .foregroundStyle(LiftMarkTheme.secondaryLabel)
                        }
                        VStack {
                            Text("\(skippedSets)")
                                .font(.title2.bold())
                                .foregroundStyle(skippedSets > 0 ? LiftMarkTheme.warning : LiftMarkTheme.tertiaryLabel)
                            Text("Skipped")
                                .font(.caption)
                                .foregroundStyle(LiftMarkTheme.secondaryLabel)
                        }
                        VStack {
                            Text("\(Int(completionRate * 100))%")
                                .font(.title2.bold())
                                .foregroundStyle(completionRate >= 0.8 ? LiftMarkTheme.success : LiftMarkTheme.warning)
                            Text("Rate")
                                .font(.caption)
                                .foregroundStyle(LiftMarkTheme.secondaryLabel)
                        }
                    }

                    ProgressView(value: completionRate)
                        .tint(completionRate >= 0.8 ? LiftMarkTheme.success : LiftMarkTheme.warning)
                }
                .padding()
                .background(LiftMarkTheme.secondaryBackground)
                .clipShape(RoundedRectangle(cornerRadius: LiftMarkTheme.cornerRadiusMD))
                .accessibilityIdentifier("workout-summary-completion")

                // Exercise Summary
                VStack(alignment: .leading, spacing: LiftMarkTheme.spacingSM) {
                    Text("Exercises")
                        .font(.headline)

                    if let exercises = session?.exercises {
                        ForEach(Array(exercises.enumerated()), id: \.element.id) { index, exercise in
                            ExerciseSummaryRow(exercise: exercise, number: index + 1)
                        }
                    }
                }
                .accessibilityIdentifier("workout-summary-exercises")

                // Done Button
                Button {
                    dismiss()
                } label: {
                    Text("Done")
                        .font(.headline)
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(LiftMarkTheme.primary)
                        .foregroundStyle(.white)
                        .clipShape(RoundedRectangle(cornerRadius: LiftMarkTheme.cornerRadiusMD))
                }
                .accessibilityIdentifier("workout-summary-done-button")
            }
            .padding()
        }
        .accessibilityIdentifier("workout-summary-scroll")
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .accessibilityIdentifier("workout-summary-screen")
        #if os(iOS)
        .toolbar(.hidden, for: .navigationBar)
        #endif
    }

    // MARK: - Highlights Computation

    private func computeHighlights() -> [WorkoutHighlight] {
        guard let session else { return [] }
        var result: [WorkoutHighlight] = []

        // Check for PRs by comparing against previous sessions
        for exercise in session.exercises {
            let maxWeight = exercise.sets
                .filter { $0.status == .completed }
                .compactMap { $0.actualWeight }
                .max()

            if let maxWeight {
                // Check if this is a PR across all completed sessions
                let previousMax = sessionStore.sessions.dropLast().reduce(0.0) { best, prevSession in
                    let exerciseMax = prevSession.exercises
                        .filter { $0.exerciseName == exercise.exerciseName }
                        .flatMap { $0.sets.filter { $0.status == .completed } }
                        .compactMap { $0.actualWeight }
                        .max() ?? 0
                    return max(best, exerciseMax)
                }

                if maxWeight > previousMax && previousMax > 0 {
                    let unit = exercise.sets.first?.actualWeightUnit ?? exercise.sets.first?.targetWeightUnit ?? .lbs
                    result.append(WorkoutHighlight(
                        type: .pr,
                        emoji: "🏆",
                        title: "PR: \(exercise.exerciseName)",
                        message: "\(formatWeight(maxWeight)) \(unit.rawValue) (previous: \(formatWeight(previousMax)) \(unit.rawValue))"
                    ))
                }
            }
        }

        // Streak detection
        let completedDates = Set(sessionStore.sessions.compactMap { session -> String? in
            session.status == .completed ? session.date : nil
        })
        if completedDates.count >= 3 {
            result.append(WorkoutHighlight(
                type: .streak,
                emoji: "🔥",
                title: "Streak",
                message: "\(completedDates.count) workouts completed"
            ))
        }

        return result
    }

    private func formatWeight(_ w: Double) -> String {
        w.truncatingRemainder(dividingBy: 1) == 0 ? "\(Int(w))" : String(format: "%.1f", w)
    }

    private func formatVolume(_ volume: Double) -> String {
        if volume >= 1000 {
            return String(format: "%.1fk", volume / 1000)
        }
        return "\(Int(volume))"
    }
}

// Uses WorkoutHighlight from WorkoutHighlightsService

// MARK: - Stat Card

private struct StatCard: View {
    let title: String
    let value: String
    let icon: String

    var body: some View {
        VStack(spacing: LiftMarkTheme.spacingXS) {
            Image(systemName: icon)
                .font(.caption)
                .foregroundStyle(LiftMarkTheme.secondaryLabel)
            Text(value)
                .font(.title2.bold())
            Text(title)
                .font(.caption)
                .foregroundStyle(LiftMarkTheme.secondaryLabel)
        }
        .frame(maxWidth: .infinity)
        .padding()
        .background(LiftMarkTheme.secondaryBackground)
        .clipShape(RoundedRectangle(cornerRadius: LiftMarkTheme.cornerRadiusMD))
    }
}

// MARK: - Exercise Summary Row

private struct ExerciseSummaryRow: View {
    let exercise: SessionExercise
    let number: Int

    private var completedCount: Int {
        exercise.sets.filter { $0.status == .completed }.count
    }

    private var totalCount: Int {
        exercise.sets.count
    }

    var body: some View {
        HStack {
            Text("\(number)")
                .font(.caption.bold())
                .foregroundStyle(.white)
                .frame(width: 22, height: 22)
                .background(exercise.status == .completed ? LiftMarkTheme.success : LiftMarkTheme.warning)
                .clipShape(Circle())

            VStack(alignment: .leading, spacing: 2) {
                Text(exercise.exerciseName)
                    .font(.subheadline)

                if let equipment = exercise.equipmentType {
                    Text(equipment)
                        .font(.caption2)
                        .foregroundStyle(LiftMarkTheme.tertiaryLabel)
                }
            }

            Spacer()

            Text("\(completedCount)/\(totalCount) sets")
                .font(.caption)
                .foregroundStyle(completedCount == totalCount ? LiftMarkTheme.success : LiftMarkTheme.secondaryLabel)

            // Best set weight
            if let bestWeight = exercise.sets
                .filter({ $0.status == .completed })
                .compactMap({ $0.actualWeight })
                .max() {
                let unit = exercise.sets.first?.actualWeightUnit ?? exercise.sets.first?.targetWeightUnit ?? .lbs
                Text("\(formatWeight(bestWeight)) \(unit.rawValue)")
                    .font(.caption.monospacedDigit())
                    .foregroundStyle(LiftMarkTheme.secondaryLabel)
            }
        }
        .padding(.vertical, LiftMarkTheme.spacingXS)
    }

    private func formatWeight(_ w: Double) -> String {
        w.truncatingRemainder(dividingBy: 1) == 0 ? "\(Int(w))" : String(format: "%.1f", w)
    }
}
