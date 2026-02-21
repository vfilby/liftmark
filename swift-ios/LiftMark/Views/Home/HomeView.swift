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

    private var createPlanPlacement: ToolbarItemPlacement {
        #if os(iOS)
        .bottomBar
        #else
        .automatic
        #endif
    }

    var body: some View {
        ScrollView {
            VStack(spacing: LiftMarkTheme.spacingMD) {
                // Resume Workout Banner
                if let activeSession = sessionStore.activeSession {
                    NavigationLink(value: AppDestination.activeWorkout) {
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text("Resume Workout")
                                    .font(.headline)
                                Text(activeSession.name)
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
                            Text("No workout plans yet")
                                .font(.subheadline)
                                .foregroundStyle(LiftMarkTheme.secondaryLabel)
                            Text("Create a plan to get started!")
                                .font(.caption)
                                .foregroundStyle(LiftMarkTheme.tertiaryLabel)
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
            }
            .padding()
        }
        .accessibilityIdentifier("home-screen")
        .navigationTitle("LiftMark")
        .toolbar {
            ToolbarItem(placement: createPlanPlacement) {
                Button {
                    showImport = true
                } label: {
                    Label("Create Plan", systemImage: "plus")
                }
                .accessibilityIdentifier("button-import-workout")
            }
        }
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
        // Search completed sessions for max weight on this exercise
        for session in sessionStore.sessions {
            for exercise in session.exercises where exercise.exerciseName.lowercased() == exerciseName.lowercased() {
                let maxW = exercise.sets
                    .filter { $0.status == .completed }
                    .compactMap { $0.actualWeight }
                    .max()
                if let maxW { return maxW }
            }
        }
        return nil
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
                Text(formatWeight(weight))
                    .font(.title2.bold())
                Text(unit.rawValue)
                    .font(.caption2)
                    .foregroundStyle(LiftMarkTheme.tertiaryLabel)
            } else {
                Text("--")
                    .font(.title2.bold())
                    .foregroundStyle(LiftMarkTheme.tertiaryLabel)
                Text("No data")
                    .font(.caption2)
                    .foregroundStyle(LiftMarkTheme.tertiaryLabel)
            }
        }
        .frame(maxWidth: .infinity, minHeight: 80)
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
