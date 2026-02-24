import SwiftUI

struct HomeView: View {
    @Environment(WorkoutPlanStore.self) private var planStore
    @Environment(SessionStore.self) private var sessionStore
    @Environment(SettingsStore.self) private var settingsStore

    @State private var showImport = false
    @State private var showExercisePicker = false
    @State private var editingTileIndex: Int?

    private var homeTiles: [String] {
        settingsStore.settings?.homeTiles ?? ["Squat", "Deadlift", "Bench Press", "Overhead Press"]
    }

    var body: some View {
        ScrollView {
            VStack(spacing: LiftMarkTheme.spacingMD) {
                // Resume Workout Banner
                if let activeSession = sessionStore.activeSession {
                    NavigationLink(value: AppDestination.activeWorkout) {
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text("Resume \(activeSession.name)")
                                    .font(.headline)
                                Text(setProgressText(for: activeSession))
                                    .font(.subheadline)
                                    .opacity(0.9)
                            }
                            Spacer()
                            Image(systemName: "chevron.right")
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding()
                        .background(LiftMarkTheme.primary)
                        .foregroundStyle(.white)
                        .clipShape(RoundedRectangle(cornerRadius: LiftMarkTheme.cornerRadiusMD))
                    }
                    .accessibilityIdentifier("resume-workout-banner")
                }

                // Max Lifts Section
                VStack(alignment: .leading, spacing: LiftMarkTheme.spacingSM) {
                    Text("Max Lifts")
                        .font(.headline)

                    LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: LiftMarkTheme.spacingSM) {
                        ForEach(Array(homeTiles.enumerated()), id: \.offset) { index, exerciseName in
                            MaxLiftTile(
                                exerciseName: exerciseName,
                                maxWeight: findMaxWeight(for: exerciseName),
                                unit: settingsStore.settings?.defaultWeightUnit ?? .lbs,
                                onLongPress: {
                                    editingTileIndex = index
                                    showExercisePicker = true
                                }
                            )
                            .accessibilityElement(children: .contain)
                            .accessibilityIdentifier("max-lift-tile-\(index)")
                        }
                    }
                }

                // Recent Plans Section
                VStack(alignment: .leading, spacing: LiftMarkTheme.spacingSM) {
                    Text("Recent Plans")
                        .font(.headline)

                    if planStore.plans.isEmpty {
                        VStack(spacing: LiftMarkTheme.spacingSM) {
                            Image(systemName: "dumbbell")
                                .font(.largeTitle)
                                .foregroundStyle(LiftMarkTheme.tertiaryLabel)
                            Text("No plans yet")
                                .font(.headline)
                                .foregroundStyle(LiftMarkTheme.label)
                            Text("Import your first workout plan to get started")
                                .font(.subheadline)
                                .foregroundStyle(LiftMarkTheme.secondaryLabel)
                        }
                        .frame(maxWidth: .infinity)
                        .padding(LiftMarkTheme.spacingLG)
                        .accessibilityIdentifier("empty-state")
                    } else {
                        ForEach(planStore.plans.prefix(3)) { plan in
                            NavigationLink(value: AppDestination.workoutDetail(id: plan.id)) {
                                WorkoutPlanCard(plan: plan)
                            }
                            .accessibilityIdentifier("workout-card-\(plan.id)")
                        }
                    }
                }
                .accessibilityIdentifier("recent-plans")

                // Create Plan Button (inside ScrollView, above tab bar)
                Button {
                    showImport = true
                } label: {
                    Label("Create Plan", systemImage: "plus")
                        .font(.headline)
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(LiftMarkTheme.primary)
                        .foregroundStyle(.white)
                        .clipShape(RoundedRectangle(cornerRadius: LiftMarkTheme.cornerRadiusMD))
                }
                .accessibilityIdentifier("button-import-workout")
            }
            .padding()
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("home-screen")
        .navigationTitle("LiftMark")
        .sheet(isPresented: $showImport) {
            ImportView()
        }
        .sheet(isPresented: $showExercisePicker) {
            ExercisePickerView { selectedExercise in
                if let index = editingTileIndex {
                    var tiles = homeTiles
                    if index < tiles.count {
                        tiles[index] = selectedExercise
                    }
                    if var settings = settingsStore.settings {
                        settings.homeTiles = tiles
                        settingsStore.updateSettings(settings)
                    }
                }
            }
        }
        .navigationDestination(for: AppDestination.self) { destination in
            switch destination {
            case .workoutDetail(let id):
                WorkoutDetailView(planId: id)
            case .activeWorkout:
                ActiveWorkoutView()
            case .workoutSummary:
                WorkoutSummaryView()
            default:
                EmptyView()
            }
        }
    }

    private func findMaxWeight(for exerciseName: String) -> Double? {
        // Search all completed sessions for global max weight on this exercise
        var globalMax: Double?
        for session in sessionStore.sessions {
            for exercise in session.exercises where exercise.exerciseName.lowercased() == exerciseName.lowercased() {
                let maxW = exercise.sets
                    .filter { $0.status == .completed }
                    .compactMap { $0.actualWeight }
                    .max()
                if let maxW {
                    globalMax = max(globalMax ?? 0, maxW)
                }
            }
        }
        return globalMax
    }

    private func setProgressText(for session: WorkoutSession) -> String {
        let totalSets = session.exercises.flatMap { $0.sets }.count
        let completedSets = session.exercises.flatMap { $0.sets }.filter { $0.status == .completed }.count
        return "\(completedSets)/\(totalSets) sets completed"
    }
}

// MARK: - Max Lift Tile

private struct MaxLiftTile: View {
    let exerciseName: String
    let maxWeight: Double?
    let unit: WeightUnit
    let onLongPress: () -> Void

    var body: some View {
        VStack(spacing: LiftMarkTheme.spacingXS) {
            Text(exerciseName)
                .font(.caption)
                .foregroundStyle(LiftMarkTheme.secondaryLabel)
                .lineLimit(1)

            if let weight = maxWeight {
                HStack(alignment: .firstTextBaseline, spacing: 4) {
                    Text(formatWeight(weight))
                        .font(.title2.bold())
                    Text(unit.rawValue)
                        .font(.caption2)
                        .foregroundStyle(LiftMarkTheme.tertiaryLabel)
                }
            } else {
                Text("\u{2014}")
                    .font(.title2.bold())
                    .foregroundStyle(LiftMarkTheme.tertiaryLabel)
                Text("No data yet")
                    .font(.caption2)
                    .foregroundStyle(LiftMarkTheme.tertiaryLabel)
            }
        }
        .frame(maxWidth: .infinity, minHeight: 80)
        .padding(LiftMarkTheme.spacingLG)
        .background(LiftMarkTheme.secondaryBackground)
        .clipShape(RoundedRectangle(cornerRadius: LiftMarkTheme.cornerRadiusMD))
        .onLongPressGesture(minimumDuration: 0.4) {
            onLongPress()
        }
    }

    private func formatWeight(_ w: Double) -> String {
        w.truncatingRemainder(dividingBy: 1) == 0 ? "\(Int(w))" : String(format: "%.1f", w)
    }
}

// MARK: - Workout Plan Card

private struct WorkoutPlanCard: View {
    let plan: WorkoutPlan

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: LiftMarkTheme.spacingXS) {
                    Text(plan.name)
                        .font(.headline)
                        .foregroundStyle(LiftMarkTheme.label)
                    if plan.isFavorite {
                        Image(systemName: "heart.fill")
                            .font(.caption)
                            .foregroundStyle(.pink)
                    }
                }
                HStack(spacing: LiftMarkTheme.spacingSM) {
                    Text("\(plan.exercises.count) exercises")
                        .font(.subheadline)
                        .foregroundStyle(LiftMarkTheme.secondaryLabel)
                    if !plan.tags.isEmpty {
                        Text(plan.tags.prefix(2).joined(separator: ", "))
                            .font(.caption)
                            .foregroundStyle(LiftMarkTheme.tertiaryLabel)
                    }
                }
            }
            Spacer()
            Image(systemName: "chevron.right")
                .font(.caption)
                .foregroundStyle(LiftMarkTheme.tertiaryLabel)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .background(LiftMarkTheme.secondaryBackground)
        .clipShape(RoundedRectangle(cornerRadius: LiftMarkTheme.cornerRadiusMD))
    }
}
