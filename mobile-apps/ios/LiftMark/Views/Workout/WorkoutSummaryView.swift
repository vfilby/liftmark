import SwiftUI

struct WorkoutSummaryView: View {
    @Environment(SessionStore.self) private var sessionStore
    @Environment(SettingsStore.self) private var settingsStore
    @Environment(NavigationCoordinator.self) private var navCoordinator
    @Environment(\.dismiss) private var dismiss

    /// The completed session to display. When provided directly (from ActiveWorkoutView),
    /// uses the passed session. Otherwise falls back to the most recently completed session.
    private let providedSession: WorkoutSession?

    private var session: WorkoutSession? {
        providedSession ?? sessionStore.sessions.first
    }

    init(session: WorkoutSession? = nil) {
        self.providedSession = session
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

    @State private var exportFileItem: ShareableURL?
    @State private var showExportError = false
    @State private var exportErrorMessage = ""

    var body: some View {
        VStack(spacing: 0) {
            ScrollView {
                VStack(spacing: LiftMarkTheme.spacingLG) {
                    // Success Header
                    VStack(spacing: LiftMarkTheme.spacingSM) {
                        // Green circle with white checkmark
                        ZStack {
                            Circle()
                                .fill(LiftMarkTheme.success)
                                .frame(width: 70, height: 70)
                            Image(systemName: "checkmark")
                                .font(.system(size: 32, weight: .bold))
                                .foregroundStyle(.white)
                        }
                        .accessibilityHidden(true)

                        Text("Workout Complete!")
                            .font(.system(size: 26, weight: .bold))

                        if let name = session?.name {
                            Text(name)
                                .font(.subheadline)
                                .foregroundStyle(LiftMarkTheme.secondaryLabel)
                                .lineLimit(1)
                                .minimumScaleFactor(0.6)
                                .multilineTextAlignment(.center)
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
                            VStack(spacing: 2) {
                                Text("\(completedSets)")
                                    .font(.system(size: 24, weight: .bold))
                                    .foregroundStyle(LiftMarkTheme.success)
                                Text("Completed")
                                    .font(.caption)
                                    .foregroundStyle(LiftMarkTheme.secondaryLabel)
                            }
                            .frame(maxWidth: .infinity)

                            VStack(spacing: 2) {
                                Text("\(skippedSets)")
                                    .font(.system(size: 24, weight: .bold))
                                Text("Skipped")
                                    .font(.caption)
                                    .foregroundStyle(LiftMarkTheme.secondaryLabel)
                            }
                            .frame(maxWidth: .infinity)

                            VStack(spacing: 2) {
                                Text("\(Int(completionRate * 100))%")
                                    .font(.system(size: 24, weight: .bold))
                                    .foregroundStyle(LiftMarkTheme.primary)
                                Text("Rate")
                                    .font(.caption)
                                    .foregroundStyle(LiftMarkTheme.secondaryLabel)
                            }
                            .frame(maxWidth: .infinity)
                        }

                        // Progress bar with orange fill
                        GeometryReader { geometry in
                            ZStack(alignment: .leading) {
                                RoundedRectangle(cornerRadius: 4)
                                    .fill(LiftMarkTheme.tertiaryLabel.opacity(0.3))
                                    .frame(height: 8)
                                RoundedRectangle(cornerRadius: 4)
                                    .fill(.orange)
                                    .frame(width: geometry.size.width * completionRate, height: 8)
                            }
                        }
                        .frame(height: 8)
                    }
                    .padding()
                    .background(LiftMarkTheme.secondaryBackground)
                    .clipShape(RoundedRectangle(cornerRadius: LiftMarkTheme.cornerRadiusMD))
                    .accessibilityIdentifier("workout-summary-completion")
                    .accessibilityElement(children: .ignore)
                    .accessibilityLabel("Completion: \(completedSets) completed, \(skippedSets) skipped, \(Int(completionRate * 100)) percent rate")

                    // Exercise Summary
                    VStack(alignment: .leading, spacing: 0) {
                        Text("Exercises")
                            .font(.title3.bold())
                            .padding(.bottom, LiftMarkTheme.spacingSM)

                        if let exercises = session?.exercises {
                            let displayExercises = exercises.enumerated().filter { _, exercise in
                                // Exclude section headers and superset parents (they have no sets)
                                !((exercise.groupType == .section || exercise.groupType == .superset) && exercise.sets.isEmpty)
                            }
                            ForEach(Array(displayExercises.enumerated()), id: \.element.1.id) { outerIndex, pair in
                                let (_, exercise) = pair
                                ExerciseSummaryRow(exercise: exercise, number: outerIndex + 1)

                                if outerIndex < displayExercises.count - 1 {
                                    Divider()
                                }
                            }
                        }
                    }
                    .accessibilityIdentifier("workout-summary-exercises")
                }
                .padding()
            }
            .accessibilityIdentifier("workout-summary-scroll")

            Divider()

            // Done Button — pinned to bottom outside ScrollView
            Button {
                sessionStore.clearActiveSession()
                dismiss()
                navCoordinator.popToRoot()
            } label: {
                Text("Done")
                    .font(.body.weight(.semibold))
                    .frame(maxWidth: .infinity)
                    .frame(height: 50)
                    .background(LiftMarkTheme.primary)
                    .foregroundStyle(.white)
                    .clipShape(RoundedRectangle(cornerRadius: LiftMarkTheme.cornerRadiusMD))
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("workout-summary-done-button")
            .padding(.horizontal)
            .padding(.vertical, LiftMarkTheme.spacingSM)
            .background(LiftMarkTheme.background)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("workout-summary-screen")
        .navigationTitle("Summary")
        #if os(iOS)
        .navigationBarTitleDisplayMode(.inline)
        .navigationBarBackButtonHidden(true)
        #endif
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button {
                    exportSession()
                } label: {
                    Image(systemName: "square.and.arrow.up")
                }
                .accessibilityIdentifier("share-session-button")
                .accessibilityLabel("Share workout")
                .accessibilityHint("Exports workout data for sharing")
            }
        }
        .sheet(item: $exportFileItem) { item in
            ShareSheet(items: [item.url])
        }
        .alert("Export Failed", isPresented: $showExportError) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(exportErrorMessage)
        }
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

    private func exportSession() {
        guard let session else { return }
        let exportService = WorkoutExportService()
        do {
            let url = try exportService.exportSingleSessionAsJson(session)
            exportFileItem = ShareableURL(url: url)
        } catch {
            exportErrorMessage = "Could not export workout: \(error.localizedDescription)"
            showExportError = true
        }
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
                .accessibilityHidden(true)
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
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(title): \(value)")
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
        HStack(spacing: LiftMarkTheme.spacingMD) {
            Text("\(number)")
                .font(.caption.bold())
                .foregroundStyle(.white)
                .frame(width: 28, height: 28)
                .background(Color.gray)
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
