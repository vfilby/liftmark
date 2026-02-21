import SwiftUI

struct WorkoutDetailView: View {
    let planId: String
    @Environment(WorkoutPlanStore.self) private var planStore
    @Environment(SessionStore.self) private var sessionStore
    @State private var showStartConfirm = false

    private var plan: WorkoutPlan? {
        planStore.getPlan(id: planId)
    }

    /// Group exercises by section (warmup, cooldown, default) and supersets
    private var exerciseSections: [ExerciseSection] {
        guard let plan else { return [] }
        var sections: [ExerciseSection] = []
        var currentSectionName: String?
        var currentExercises: [PlannedExercise] = []

        for exercise in plan.exercises {
            let sectionName = exercise.groupType == .section ? exercise.groupName : nil

            if sectionName != currentSectionName {
                if !currentExercises.isEmpty {
                    sections.append(ExerciseSection(
                        name: currentSectionName,
                        exercises: currentExercises
                    ))
                }
                currentSectionName = sectionName
                currentExercises = []
            }
            currentExercises.append(exercise)
        }
        if !currentExercises.isEmpty {
            sections.append(ExerciseSection(
                name: currentSectionName,
                exercises: currentExercises
            ))
        }
        return sections
    }

    var body: some View {
        Group {
            if let plan {
                ScrollView {
                    VStack(alignment: .leading, spacing: LiftMarkTheme.spacingMD) {
                        // Header card
                        VStack(alignment: .leading, spacing: LiftMarkTheme.spacingSM) {
                            // Tags
                            if !plan.tags.isEmpty {
                                ScrollView(.horizontal, showsIndicators: false) {
                                    HStack(spacing: LiftMarkTheme.spacingXS) {
                                        ForEach(plan.tags, id: \.self) { tag in
                                            Text(tag)
                                                .font(.caption)
                                                .padding(.horizontal, 8)
                                                .padding(.vertical, 4)
                                                .background(LiftMarkTheme.primary.opacity(0.1))
                                                .clipShape(Capsule())
                                        }
                                    }
                                }
                            }

                            // Description
                            if let description = plan.description, !description.isEmpty {
                                Text(description)
                                    .font(.subheadline)
                                    .foregroundStyle(LiftMarkTheme.secondaryLabel)
                            }

                            // Metadata
                            HStack(spacing: LiftMarkTheme.spacingMD) {
                                Label("\(plan.exercises.count) exercises", systemImage: "figure.strengthtraining.traditional")
                                    .font(.caption)
                                    .foregroundStyle(LiftMarkTheme.secondaryLabel)

                                let totalSets = plan.exercises.reduce(0) { $0 + $1.sets.count }
                                Label("\(totalSets) sets", systemImage: "repeat")
                                    .font(.caption)
                                    .foregroundStyle(LiftMarkTheme.secondaryLabel)

                                if let unit = plan.defaultWeightUnit {
                                    Label(unit.rawValue, systemImage: "scalemass")
                                        .font(.caption)
                                        .foregroundStyle(LiftMarkTheme.secondaryLabel)
                                }
                            }
                        }
                        .padding()
                        .background(LiftMarkTheme.secondaryBackground)
                        .clipShape(RoundedRectangle(cornerRadius: LiftMarkTheme.cornerRadiusMD))

                        // Exercises by section
                        ForEach(Array(exerciseSections.enumerated()), id: \.offset) { sectionIndex, section in
                            VStack(alignment: .leading, spacing: LiftMarkTheme.spacingSM) {
                                // Section header
                                if let sectionName = section.name {
                                    Text(sectionName.capitalized)
                                        .font(.subheadline.bold())
                                        .textCase(.uppercase)
                                        .foregroundStyle(sectionColor(for: sectionName))
                                        .padding(.top, sectionIndex > 0 ? LiftMarkTheme.spacingSM : 0)
                                }

                                // Exercises
                                ForEach(section.exercises) { exercise in
                                    exerciseCard(exercise)
                                }
                            }
                        }

                        // Start Workout Button
                        Button {
                            if sessionStore.activeSession != nil {
                                showStartConfirm = true
                            } else {
                                startWorkout()
                            }
                        } label: {
                            Text(sessionStore.activeSession != nil ? "Replace Active Workout" : "Start Workout")
                                .font(.headline)
                                .frame(maxWidth: .infinity)
                                .padding()
                                .background(LiftMarkTheme.primary)
                                .foregroundStyle(.white)
                                .clipShape(RoundedRectangle(cornerRadius: LiftMarkTheme.cornerRadiusMD))
                        }
                        .accessibilityIdentifier("start-workout-button")
                    }
                    .padding()
                }
                .accessibilityIdentifier("workout-detail-view")
            } else {
                VStack {
                    ProgressView()
                    Text("Loading...")
                        .foregroundStyle(LiftMarkTheme.secondaryLabel)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .accessibilityIdentifier("workout-detail-loading")
            }
        }
        .navigationTitle(plan?.name ?? "Workout Details")
        #if os(iOS)
        .navigationBarTitleDisplayMode(.large)
        #endif
        .toolbar {
            if plan != nil {
                ToolbarItem(placement: .primaryAction) {
                    Button {
                        planStore.toggleFavorite(id: planId)
                    } label: {
                        Image(systemName: plan?.isFavorite == true ? "heart.fill" : "heart")
                            .foregroundStyle(plan?.isFavorite == true ? .pink : LiftMarkTheme.label)
                    }
                    .accessibilityIdentifier("favorite-button-detail")
                }
            }
        }
        .alert("Replace Active Workout?", isPresented: $showStartConfirm) {
            Button("Cancel", role: .cancel) {}
            Button("Replace", role: .destructive) {
                sessionStore.cancelSession()
                startWorkout()
            }
        } message: {
            Text("You have an active workout in progress. Starting a new one will discard it.")
        }
    }

    // MARK: - Exercise Card

    @ViewBuilder
    private func exerciseCard(_ exercise: PlannedExercise) -> some View {
        VStack(alignment: .leading, spacing: LiftMarkTheme.spacingSM) {
            // Superset badge
            if exercise.groupType == .superset, let groupName = exercise.groupName {
                let supersetIndex = supersetIndexFor(exercise)
                Text("Superset\(groupName.isEmpty ? "" : ": \(groupName)")")
                    .font(.caption2.bold())
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(LiftMarkTheme.primary.opacity(0.15))
                    .foregroundStyle(LiftMarkTheme.primary)
                    .clipShape(Capsule())
                    .accessibilityIdentifier("superset-\(supersetIndex)")
            }

            // Exercise name and equipment
            HStack(alignment: .firstTextBaseline) {
                Text(exercise.exerciseName)
                    .font(.headline)

                if let equipment = exercise.equipmentType {
                    Text(equipment)
                        .font(.caption)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(LiftMarkTheme.secondaryBackground)
                        .clipShape(Capsule())
                        .foregroundStyle(LiftMarkTheme.secondaryLabel)
                }

                Spacer()

                // YouTube search link
                if let url = youtubeSearchURL(for: exercise.exerciseName) {
                    Link(destination: url) {
                        Image(systemName: "play.rectangle")
                            .font(.caption)
                            .foregroundStyle(LiftMarkTheme.secondaryLabel)
                    }
                }
            }

            // Notes
            if let notes = exercise.notes, !notes.isEmpty {
                Text(notes)
                    .font(.caption)
                    .foregroundStyle(LiftMarkTheme.secondaryLabel)
                    .italic()
            }

            // Sets
            ForEach(exercise.sets) { set in
                HStack(spacing: LiftMarkTheme.spacingSM) {
                    Text("Set \(set.orderIndex + 1)")
                        .font(.subheadline)
                        .foregroundStyle(LiftMarkTheme.tertiaryLabel)
                        .frame(width: 50, alignment: .leading)

                    if let weight = set.targetWeight, let unit = set.targetWeightUnit {
                        Text("\(formatWeight(weight)) \(unit.rawValue)")
                            .font(.subheadline.monospacedDigit())
                    }

                    if let reps = set.targetReps {
                        Text("x \(reps)\(set.isAmrap ? "+" : "")")
                            .font(.subheadline.monospacedDigit())
                    }

                    if let time = set.targetTime {
                        Text(formatTime(time))
                            .font(.subheadline.monospacedDigit())
                    }

                    Spacer()

                    // Modifier badges
                    if let rpe = set.targetRpe {
                        Text("RPE \(rpe)")
                            .font(.caption2)
                            .padding(.horizontal, 4)
                            .padding(.vertical, 1)
                            .background(LiftMarkTheme.warning.opacity(0.15))
                            .clipShape(Capsule())
                    }

                    if set.isDropset {
                        Text("Drop")
                            .font(.caption2)
                            .padding(.horizontal, 4)
                            .padding(.vertical, 1)
                            .background(LiftMarkTheme.destructive.opacity(0.15))
                            .clipShape(Capsule())
                    }

                    if set.isPerSide {
                        Text("/side")
                            .font(.caption2)
                            .padding(.horizontal, 4)
                            .padding(.vertical, 1)
                            .background(LiftMarkTheme.primary.opacity(0.15))
                            .clipShape(Capsule())
                    }

                    if let rest = set.restSeconds, rest > 0 {
                        Text("\(rest)s rest")
                            .font(.caption2)
                            .foregroundStyle(LiftMarkTheme.tertiaryLabel)
                    }
                }
                .accessibilityIdentifier("set-\(set.id)")
            }
        }
        .padding()
        .background(LiftMarkTheme.secondaryBackground)
        .clipShape(RoundedRectangle(cornerRadius: LiftMarkTheme.cornerRadiusMD))
        .accessibilityIdentifier("exercise-\(exercise.id)")
    }

    // MARK: - Helpers

    private func startWorkout() {
        guard let plan else { return }
        _ = sessionStore.startSession(from: plan)
    }

    private func supersetIndexFor(_ exercise: PlannedExercise) -> Int {
        guard let plan else { return 0 }
        var seen: [String: Int] = [:]
        var index = 0
        for ex in plan.exercises {
            if ex.groupType == .superset, let name = ex.groupName {
                if seen[name] == nil {
                    seen[name] = index
                    index += 1
                }
                if ex.id == exercise.id {
                    return seen[name] ?? 0
                }
            }
        }
        return 0
    }

    private func sectionColor(for name: String) -> Color {
        switch name.lowercased() {
        case "warmup", "warm-up", "warm up": return LiftMarkTheme.warning
        case "cooldown", "cool-down", "cool down": return LiftMarkTheme.primary
        default: return LiftMarkTheme.secondaryLabel
        }
    }

    private func youtubeSearchURL(for exerciseName: String) -> URL? {
        let query = exerciseName.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? exerciseName
        return URL(string: "https://www.youtube.com/results?search_query=\(query)+form")
    }

    private func formatWeight(_ w: Double) -> String {
        w.truncatingRemainder(dividingBy: 1) == 0 ? "\(Int(w))" : String(format: "%.1f", w)
    }

    private func formatTime(_ seconds: Int) -> String {
        let m = seconds / 60
        let s = seconds % 60
        return m > 0 ? String(format: "%d:%02d", m, s) : "\(s)s"
    }
}

// MARK: - Exercise Section

private struct ExerciseSection {
    let name: String?
    let exercises: [PlannedExercise]
}
