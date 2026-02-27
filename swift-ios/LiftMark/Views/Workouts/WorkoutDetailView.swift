import SwiftUI

struct WorkoutDetailView: View {
    let planId: String
    @Environment(WorkoutPlanStore.self) private var planStore
    @Environment(SessionStore.self) private var sessionStore
    @Environment(\.dismiss) private var dismiss
    @State private var showStartConfirm = false
    @State private var showReprocessConfirm = false
    @State private var navigateToActiveWorkout = false

    private var plan: WorkoutPlan? {
        planStore.getPlan(id: planId)
    }

    /// Group exercises by section (warmup, cooldown, default) then build display items
    private var exerciseSections: [ExerciseDisplaySection] {
        guard let plan else { return [] }
        var sections: [ExerciseDisplaySection] = []
        var currentSectionName: String?
        var currentExercises: [PlannedExercise] = []

        for exercise in plan.exercises {
            let sectionName: String?
            if exercise.groupType == .section {
                sectionName = exercise.groupName
            } else if exercise.parentExerciseId != nil {
                // Children of sections/supersets stay in the current section
                sectionName = currentSectionName
            } else {
                sectionName = nil
            }

            if sectionName != currentSectionName {
                if !currentExercises.isEmpty {
                    sections.append(ExerciseDisplaySection(
                        name: currentSectionName,
                        items: buildPlanDisplayItems(from: currentExercises)
                    ))
                }
                currentSectionName = sectionName
                currentExercises = []
            }
            currentExercises.append(exercise)
        }
        if !currentExercises.isEmpty {
            sections.append(ExerciseDisplaySection(
                name: currentSectionName,
                items: buildPlanDisplayItems(from: currentExercises)
            ))
        }
        return sections
    }

    /// Build display items from a flat list of exercises, grouping supersets
    private func buildPlanDisplayItems(from exercises: [PlannedExercise]) -> [PlanDisplayItem] {
        var items: [PlanDisplayItem] = []
        var processedIds = Set<String>()

        for exercise in exercises {
            if processedIds.contains(exercise.id) { continue }

            if exercise.groupType == .superset && exercise.sets.isEmpty {
                // Superset parent — gather children
                var children: [PlannedExercise] = []
                for child in exercises {
                    if child.parentExerciseId == exercise.id {
                        children.append(child)
                        processedIds.insert(child.id)
                    }
                }
                processedIds.insert(exercise.id)
                if !children.isEmpty {
                    items.append(.superset(parent: exercise, children: children))
                }
            } else if exercise.parentExerciseId != nil {
                // Skip orphan children already handled
                continue
            } else if exercise.groupType == .section && exercise.sets.isEmpty {
                // Section header — gather children as individual exercises
                processedIds.insert(exercise.id)
                for child in exercises {
                    if child.parentExerciseId == exercise.id {
                        items.append(.single(exercise: child))
                        processedIds.insert(child.id)
                    }
                }
            } else {
                items.append(.single(exercise: exercise))
                processedIds.insert(exercise.id)
            }
        }
        return items
    }

    /// Count exercises excluding superset parents (which have no sets)
    private var exerciseCount: Int {
        guard let plan else { return 0 }
        return plan.exercises.filter { exercise in
            !(exercise.groupType == .superset && exercise.sets.isEmpty) &&
            !(exercise.groupType == .section && exercise.sets.isEmpty)
        }.count
    }

    /// Global exercise index (1-based) for numbering, excluding superset parents and section headers
    private func globalExerciseIndex(for exercise: PlannedExercise) -> Int {
        guard let plan else { return 1 }
        var index = 0
        for ex in plan.exercises {
            if ex.groupType == .superset && ex.sets.isEmpty { continue }
            if ex.groupType == .section && ex.sets.isEmpty { continue }
            index += 1
            if ex.id == exercise.id { return index }
        }
        return 1
    }

    var body: some View {
        Group {
            if let plan {
                VStack(spacing: 0) {
                    ScrollView {
                        VStack(alignment: .leading, spacing: LiftMarkTheme.spacingMD) {
                            // Header card
                            VStack(alignment: .leading, spacing: LiftMarkTheme.spacingSM) {
                                // Plan name + favorite
                                HStack(alignment: .top) {
                                    Text(plan.name)
                                        .font(.title2)
                                        .fontWeight(.bold)

                                    Spacer()

                                    Button {
                                        planStore.toggleFavorite(id: planId)
                                    } label: {
                                        Image(systemName: plan.isFavorite ? "heart.fill" : "heart")
                                            .font(.title3)
                                            .foregroundStyle(plan.isFavorite ? .yellow : LiftMarkTheme.tertiaryLabel)
                                            .frame(width: 36, height: 36)
                                    }
                                    .accessibilityIdentifier("favorite-button-detail")
                                }

                                // Description
                                if let description = plan.description, !description.isEmpty {
                                    Text(description)
                                        .font(.body)
                                        .foregroundStyle(LiftMarkTheme.secondaryLabel)
                                }

                                // Tags
                                if !plan.tags.isEmpty {
                                    HStack(spacing: 4) {
                                        ForEach(plan.tags, id: \.self) { tag in
                                            Text(tag.lowercased())
                                                .font(.caption2)
                                                .fontWeight(.semibold)
                                                .foregroundStyle(LiftMarkTheme.primary)
                                                .padding(.horizontal, 8)
                                                .padding(.vertical, 2)
                                                .background(LiftMarkTheme.primary.opacity(0.1))
                                                .clipShape(Capsule())
                                        }
                                    }
                                }
                            }
                            .padding()
                            .background(LiftMarkTheme.secondaryBackground)
                            .clipShape(RoundedRectangle(cornerRadius: LiftMarkTheme.cornerRadiusMD))

                            // Stats grid
                            HStack(spacing: LiftMarkTheme.spacingSM) {
                                statCard(
                                    value: "\(exerciseCount)",
                                    label: "Exercises"
                                )
                                statCard(
                                    value: "\(plan.exercises.reduce(0) { $0 + $1.sets.count })",
                                    label: "Sets"
                                )
                                statCard(
                                    value: plan.defaultWeightUnit?.rawValue.uppercased() ?? "—",
                                    label: "Units"
                                )
                            }

                            // Reprocess button
                            if plan.sourceMarkdown != nil {
                                Button {
                                    showReprocessConfirm = true
                                } label: {
                                    Text("Reprocess from Markdown")
                                        .font(.subheadline)
                                        .fontWeight(.medium)
                                        .foregroundStyle(LiftMarkTheme.secondaryLabel)
                                        .frame(maxWidth: .infinity)
                                        .padding(.vertical, LiftMarkTheme.spacingMD)
                                        .background(LiftMarkTheme.secondaryBackground)
                                        .clipShape(RoundedRectangle(cornerRadius: LiftMarkTheme.cornerRadiusSM))
                                        .overlay(
                                            RoundedRectangle(cornerRadius: LiftMarkTheme.cornerRadiusSM)
                                                .stroke(LiftMarkTheme.tertiaryLabel.opacity(0.3), lineWidth: 1)
                                        )
                                }
                            }

                            // Exercises heading
                            Text("Exercises")
                                .font(.callout)
                                .fontWeight(.semibold)
                                .foregroundStyle(LiftMarkTheme.secondaryLabel)

                            // Exercises by section
                            ForEach(Array(exerciseSections.enumerated()), id: \.offset) { sectionIndex, section in
                                VStack(alignment: .leading, spacing: LiftMarkTheme.spacingSM) {
                                    // Section header divider
                                    if let sectionName = section.name {
                                        sectionHeader(name: sectionName)
                                    }

                                    // Exercises and superset groups
                                    ForEach(section.items) { item in
                                        switch item {
                                        case .single(let exercise):
                                            exerciseCard(exercise, sectionName: section.name)
                                        case .superset(let parent, let children):
                                            supersetCard(parent: parent, children: children, sectionName: section.name)
                                        }
                                    }
                                }
                            }
                        }
                        .padding()
                    }
                    .accessibilityIdentifier("workout-detail-view")

                    Divider()

                    // Start Workout Button — pinned to bottom
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
                            .frame(height: 50)
                            .background(LiftMarkTheme.primary)
                            .foregroundStyle(.white)
                            .clipShape(RoundedRectangle(cornerRadius: LiftMarkTheme.cornerRadiusMD))
                    }
                    .accessibilityIdentifier("start-workout-button")
                    .padding(.horizontal)
                    .padding(.vertical, LiftMarkTheme.spacingSM)
                    .background(LiftMarkTheme.background)
                }
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
                        sharePlan()
                    } label: {
                        Image(systemName: "square.and.arrow.up")
                    }
                    .accessibilityIdentifier("share-plan-button")
                }
            }
        }
        .navigationDestination(isPresented: $navigateToActiveWorkout) {
            ActiveWorkoutView()
        }
        .onAppear {
            if plan == nil {
                dismiss()
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
        .alert("Reprocess from Markdown?", isPresented: $showReprocessConfirm) {
            Button("Cancel", role: .cancel) {}
            Button("Reprocess", role: .destructive) {
                reprocessPlan()
            }
        } message: {
            Text("This will re-parse the plan from its original markdown. Any manual changes will be lost.")
        }
    }

    // MARK: - Stat Card

    @ViewBuilder
    private func statCard(value: String, label: String) -> some View {
        VStack(spacing: 4) {
            Text(value)
                .font(.title2)
                .fontWeight(.bold)
                .foregroundStyle(LiftMarkTheme.primary)
                .monospacedDigit()
            Text(label)
                .font(.caption)
                .fontWeight(.medium)
                .foregroundStyle(LiftMarkTheme.secondaryLabel)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, LiftMarkTheme.spacingLG)
        .background(LiftMarkTheme.secondaryBackground)
        .clipShape(RoundedRectangle(cornerRadius: LiftMarkTheme.cornerRadiusMD))
    }

    // MARK: - Section Header

    @ViewBuilder
    private func sectionHeader(name: String) -> some View {
        HStack(spacing: LiftMarkTheme.spacingMD) {
            Rectangle()
                .fill(sectionColor(for: name))
                .frame(height: 1)
            Text(name.uppercased())
                .font(.subheadline)
                .fontWeight(.semibold)
                .foregroundStyle(sectionColor(for: name))
                .tracking(1)
            Rectangle()
                .fill(sectionColor(for: name))
                .frame(height: 1)
        }
        .padding(.vertical, LiftMarkTheme.spacingSM)
    }

    // MARK: - Exercise Card

    @ViewBuilder
    private func exerciseCard(_ exercise: PlannedExercise, sectionName: String?) -> some View {
        VStack(alignment: .leading, spacing: LiftMarkTheme.spacingMD) {
            // Exercise header
            HStack(alignment: .top, spacing: LiftMarkTheme.spacingMD) {
                // Numbered index
                Text("\(globalExerciseIndex(for: exercise))")
                    .font(.callout)
                    .fontWeight(.bold)
                    .foregroundStyle(sectionColor(for: sectionName ?? ""))
                    .frame(minWidth: 20)

                VStack(alignment: .leading, spacing: 2) {
                    // Superset badge
                    if exercise.groupType == .superset {
                        let supersetIndex = supersetIndexFor(exercise)
                        Text("SUPERSET")
                            .font(.caption2)
                            .fontWeight(.bold)
                            .foregroundStyle(.purple)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 2)
                            .background(Color.purple.opacity(0.1))
                            .clipShape(RoundedRectangle(cornerRadius: 4))
                            .accessibilityIdentifier("superset-\(supersetIndex)")
                    }

                    // Exercise name
                    HStack {
                        Text(exercise.exerciseName)
                            .font(.callout)
                            .fontWeight(.semibold)
                        Spacer()
                        if let url = youtubeSearchURL(for: exercise.exerciseName) {
                            Link(destination: url) {
                                Image(systemName: "play.rectangle")
                                    .font(.caption)
                                    .foregroundStyle(LiftMarkTheme.secondaryLabel)
                            }
                            .accessibilityIdentifier("youtube-link-\(exercise.exerciseName)")
                        }
                    }

                    // Equipment
                    if let equipment = exercise.equipmentType {
                        Text(equipment)
                            .font(.caption)
                            .foregroundStyle(LiftMarkTheme.secondaryLabel)
                    }

                    // Notes
                    if let notes = exercise.notes, !notes.isEmpty {
                        Text(notes)
                            .font(.caption)
                            .foregroundStyle(LiftMarkTheme.secondaryLabel)
                            .italic()
                    }
                }
            }

            // Sets
            VStack(spacing: 0) {
                ForEach(Array(exercise.sets.enumerated()), id: \.element.id) { setIndex, set in
                    HStack(spacing: LiftMarkTheme.spacingMD) {
                        // Set badge (colored circle)
                        Text("\(set.orderIndex + 1)")
                            .font(.caption)
                            .fontWeight(.bold)
                            .foregroundStyle(sectionColor(for: sectionName ?? ""))
                            .frame(width: 28, height: 28)
                            .background(sectionColor(for: sectionName ?? "").opacity(0.12))
                            .clipShape(Circle())

                        // Set details
                        Text(setDetailString(set))
                            .font(.body)
                            .foregroundStyle(LiftMarkTheme.secondaryLabel)

                        Spacer()
                    }
                    .padding(.vertical, 8)
                    .accessibilityElement(children: .contain)
                    .accessibilityIdentifier("set-\(set.id)")

                    if setIndex < exercise.sets.count - 1 {
                        Divider()
                    }
                }
            }
            .padding(.leading, 32)
        }
        .padding()
        .background(LiftMarkTheme.secondaryBackground)
        .clipShape(RoundedRectangle(cornerRadius: LiftMarkTheme.cornerRadiusMD))
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("exercise-\(exercise.id)")
    }

    // MARK: - Superset Card

    /// Build interleaved sets: round-robin across children
    private func interleavedSupersetSets(_ children: [PlannedExercise]) -> [(exercise: PlannedExercise, set: PlannedSet, round: Int)] {
        let maxSets = children.map { $0.sets.count }.max() ?? 0
        var result: [(exercise: PlannedExercise, set: PlannedSet, round: Int)] = []
        for round in 0..<maxSets {
            for child in children {
                if round < child.sets.count {
                    result.append((exercise: child, set: child.sets[round], round: round))
                }
            }
        }
        return result
    }

    @ViewBuilder
    private func supersetCard(parent: PlannedExercise, children: [PlannedExercise], sectionName: String?) -> some View {
        let interleaved = interleavedSupersetSets(children)

        VStack(alignment: .leading, spacing: LiftMarkTheme.spacingMD) {
            // Superset header
            HStack(spacing: LiftMarkTheme.spacingSM) {
                Image(systemName: "arrow.triangle.2.circlepath")
                    .font(.caption.bold())
                    .foregroundStyle(.white)
                    .frame(width: 24, height: 24)
                    .background(Color.purple)
                    .clipShape(Circle())

                VStack(alignment: .leading, spacing: 2) {
                    Text("SUPERSET")
                        .font(.caption2)
                        .fontWeight(.bold)
                        .foregroundStyle(.purple)

                    Text(parent.exerciseName)
                        .font(.callout)
                        .fontWeight(.semibold)

                    Text(children.map { $0.exerciseName }.joined(separator: " + "))
                        .font(.caption)
                        .foregroundStyle(LiftMarkTheme.secondaryLabel)
                }

                Spacer()
            }

            Divider()

            // Interleaved sets
            VStack(spacing: 0) {
                ForEach(Array(interleaved.enumerated()), id: \.element.set.id) { idx, item in
                    HStack(spacing: LiftMarkTheme.spacingMD) {
                        Text("\(item.round + 1)")
                            .font(.caption)
                            .fontWeight(.bold)
                            .foregroundStyle(sectionColor(for: sectionName ?? ""))
                            .frame(width: 28, height: 28)
                            .background(sectionColor(for: sectionName ?? "").opacity(0.12))
                            .clipShape(Circle())

                        VStack(alignment: .leading, spacing: 2) {
                            Text(item.exercise.exerciseName)
                                .font(.caption2)
                                .fontWeight(.semibold)
                                .foregroundStyle(LiftMarkTheme.secondaryLabel)

                            Text(setDetailString(item.set))
                                .font(.body)
                                .foregroundStyle(LiftMarkTheme.secondaryLabel)
                        }

                        Spacer()
                    }
                    .padding(.vertical, 8)
                    .accessibilityIdentifier("set-\(item.set.id)")

                    if idx < interleaved.count - 1 {
                        Divider()
                    }
                }
            }
            .padding(.leading, 8)
        }
        .padding()
        .background(LiftMarkTheme.secondaryBackground)
        .clipShape(RoundedRectangle(cornerRadius: LiftMarkTheme.cornerRadiusMD))
        .accessibilityIdentifier("superset-card-\(parent.id)")
    }

    // MARK: - Set Detail String

    private func setDetailString(_ set: PlannedSet) -> String {
        var parts: [String] = []

        if let weight = set.targetWeight, let unit = set.targetWeightUnit {
            parts.append("\(formatWeight(weight)) \(unit.rawValue)")
        }

        if let reps = set.targetReps {
            let amrapSuffix = set.isAmrap ? "+" : ""
            parts.append("× \(reps)\(amrapSuffix) reps")
        }

        if let time = set.targetTime {
            parts.append(formatTime(time))
        }

        var detail = parts.joined(separator: " ")

        // Inline modifiers
        if let rpe = set.targetRpe {
            detail += " · RPE \(rpe)"
        }

        if let tempo = set.tempo {
            detail += " · Tempo \(tempo)"
        }

        if let rest = set.restSeconds, rest > 0 {
            detail += " · Rest \(rest)s"
        }

        return detail
    }

    // MARK: - Helpers

    private func startWorkout() {
        guard let plan else { return }
        let session = sessionStore.startSession(from: plan)
        if session != nil {
            navigateToActiveWorkout = true
        }
    }

    private func sharePlan() {
        guard let plan, let markdown = plan.sourceMarkdown else { return }
        // Share the markdown via share sheet
        let activityVC = UIActivityViewController(activityItems: [markdown], applicationActivities: nil)
        if let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
           let rootVC = windowScene.windows.first?.rootViewController {
            rootVC.present(activityVC, animated: true)
        }
    }

    private func reprocessPlan() {
        guard let plan, let markdown = plan.sourceMarkdown else { return }
        planStore.reprocessPlan(id: plan.id, fromMarkdown: markdown)
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
        case "warmup", "warm-up", "warm up": return .orange
        case "cooldown", "cool-down", "cool down": return Color(red: 0.35, green: 0.78, blue: 0.98) // light blue
        default: return LiftMarkTheme.primary
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

// MARK: - Display Models

private enum PlanDisplayItem: Identifiable {
    case single(exercise: PlannedExercise)
    case superset(parent: PlannedExercise, children: [PlannedExercise])

    var id: String {
        switch self {
        case .single(let exercise): return exercise.id
        case .superset(let parent, _): return parent.id
        }
    }
}

private struct ExerciseDisplaySection {
    let name: String?
    let items: [PlanDisplayItem]
}
