import SwiftUI

struct WorkoutDetailView: View {
    let planId: String
    var isEmbedded: Bool = false
    @Environment(WorkoutPlanStore.self) private var planStore
    @Environment(SessionStore.self) private var sessionStore
    @Environment(\.dismiss) private var dismiss
    @State private var showStartConfirm = false
    @State private var showReprocessConfirm = false
    @State private var showEditMarkdown = false
    @State private var navigateToActiveWorkout = false
    @State private var editingPlanExercise: PlannedExercise?

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
                                            .foregroundStyle(plan.isFavorite ? .red : LiftMarkTheme.tertiaryLabel)
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

                            // Edit & Reprocess buttons
                            if plan.sourceMarkdown != nil {
                                HStack(spacing: LiftMarkTheme.spacingSM) {
                                    Button {
                                        showEditMarkdown = true
                                    } label: {
                                        Label("Edit", systemImage: "pencil.line")
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
                                    .accessibilityIdentifier("edit-plan-markdown-button")

                                    Button {
                                        showReprocessConfirm = true
                                    } label: {
                                        Label("Reprocess", systemImage: "arrow.clockwise")
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
                                    .accessibilityIdentifier("reprocess-plan-button")
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
        .navigationTitle(isEmbedded ? "" : (plan?.name ?? "Workout Details"))
        #if os(iOS)
        .navigationBarTitleDisplayMode(isEmbedded ? .inline : .large)
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
            if plan == nil && !isEmbedded {
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
        .sheet(isPresented: $showEditMarkdown) {
            if let plan {
                EditPlanMarkdownSheet(planId: plan.id, initialMarkdown: plan.sourceMarkdown ?? "")
            }
        }
        .sheet(item: $editingPlanExercise) { exercise in
            EditPlanExerciseSheet(exercise: exercise) { updatedExercise in
                guard var currentPlan = plan else { return }
                if let idx = currentPlan.exercises.firstIndex(where: { $0.id == exercise.id }) {
                    currentPlan.exercises[idx] = updatedExercise
                }
                if currentPlan.sourceMarkdown != nil {
                    currentPlan.sourceMarkdown = regenerateMarkdown(from: currentPlan)
                }
                planStore.updatePlan(currentPlan)
            }
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
        HStack(spacing: LiftMarkTheme.spacingSM) {
            Rectangle()
                .fill(sectionColor(for: name))
                .frame(height: 1)
            Text(name.uppercased())
                .font(.subheadline)
                .fontWeight(.semibold)
                .foregroundStyle(sectionColor(for: name))
                .tracking(1)
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
                .layoutPriority(1)
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
                    Text(exercise.exerciseName)
                        .font(.callout)
                        .fontWeight(.semibold)

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

                Spacer()

                // Edit button — larger tap target, top-right
                Button {
                    editingPlanExercise = exercise
                } label: {
                    Image(systemName: "pencil")
                        .font(.body)
                        .foregroundStyle(LiftMarkTheme.secondaryLabel)
                        .frame(width: 36, height: 36)
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("edit-plan-exercise-\(exercise.id)")
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

            // YouTube search — bottom of card, descriptive link
            if let url = youtubeSearchURL(for: exercise.exerciseName) {
                Divider()
                Link(destination: url) {
                    HStack(spacing: LiftMarkTheme.spacingSM) {
                        Image(systemName: "play.rectangle")
                            .font(.caption)
                        Text("Search \"\(exercise.exerciseName)\" on YouTube")
                            .font(.caption)
                    }
                    .foregroundStyle(LiftMarkTheme.secondaryLabel)
                    .frame(maxWidth: .infinity, alignment: .center)
                }
                .accessibilityIdentifier("youtube-link-\(exercise.exerciseName)")
            }
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
        case "warmup", "warm-up", "warm up": return LiftMarkTheme.warmupAccent
        case "cooldown", "cool-down", "cool down": return LiftMarkTheme.cooldownAccent
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

    // MARK: - Regenerate Markdown

    private func regenerateMarkdown(from plan: WorkoutPlan) -> String {
        var lines: [String] = []
        lines.append("# \(plan.name)")
        if !plan.tags.isEmpty {
            lines.append("@tags: \(plan.tags.joined(separator: ", "))")
        }
        if let unit = plan.defaultWeightUnit {
            lines.append("@units: \(unit.rawValue)")
        }
        if let desc = plan.description, !desc.isEmpty {
            lines.append(desc)
        }
        lines.append("")
        for exercise in plan.exercises {
            if exercise.groupType == .section && exercise.sets.isEmpty {
                lines.append("## \(exercise.exerciseName)")
                lines.append("")
                continue
            }
            if exercise.groupType == .superset && exercise.sets.isEmpty {
                lines.append("## \(exercise.exerciseName)")
                lines.append("")
                continue
            }
            lines.append("## \(exercise.exerciseName)")
            if let equip = exercise.equipmentType, !equip.isEmpty {
                lines.append("@type: \(equip)")
            }
            if let notes = exercise.notes, !notes.isEmpty {
                lines.append(notes)
            }
            for set in exercise.sets {
                var parts: [String] = []
                if let w = set.targetWeight {
                    let wStr = w.truncatingRemainder(dividingBy: 1) == 0 ? "\(Int(w))" : String(format: "%.1f", w)
                    parts.append(wStr)
                    if let unit = set.targetWeightUnit {
                        parts.append(unit.rawValue)
                    }
                }
                if let r = set.targetReps {
                    parts.append("x \(r)")
                }
                if let t = set.targetTime {
                    parts.append("\(t)s")
                }
                if let rpe = set.targetRpe {
                    parts.append("@rpe: \(rpe)")
                }
                if let rest = set.restSeconds, rest > 0 {
                    parts.append("@rest: \(rest)s")
                }
                if set.isDropset {
                    parts.append("@dropset")
                }
                if set.isPerSide {
                    parts.append("@perside")
                }
                if let tempo = set.tempo {
                    parts.append("@tempo: \(tempo)")
                }
                lines.append("- \(parts.joined(separator: " "))")
            }
            lines.append("")
        }
        return lines.joined(separator: "\n")
    }
}

// MARK: - Edit Plan Exercise Sheet

private struct EditablePlanSetRow: Identifiable {
    let id: String
    var weightText: String
    var repsText: String
    var timeText: String
    var weightUnit: WeightUnit?

    static func from(_ set: PlannedSet) -> EditablePlanSetRow {
        EditablePlanSetRow(
            id: set.id,
            weightText: {
                if let w = set.targetWeight {
                    return w.truncatingRemainder(dividingBy: 1) == 0 ? "\(Int(w))" : String(format: "%.1f", w)
                }
                return ""
            }(),
            repsText: set.targetReps.map { "\($0)" } ?? "",
            timeText: set.targetTime.map { "\($0)" } ?? "",
            weightUnit: set.targetWeightUnit
        )
    }
}

private struct EditPlanExerciseSheet: View {
    let exercise: PlannedExercise
    let onSave: (PlannedExercise) -> Void
    @State private var name: String
    @State private var equipmentType: String
    @State private var notes: String
    @State private var editableSets: [EditablePlanSetRow]
    @State private var editMode: Int = 0
    @State private var markdownText: String = ""
    @State private var markdownError: String?
    @Environment(\.dismiss) private var dismiss

    init(exercise: PlannedExercise, onSave: @escaping (PlannedExercise) -> Void) {
        self.exercise = exercise
        self.onSave = onSave
        self._name = State(initialValue: exercise.exerciseName)
        self._equipmentType = State(initialValue: exercise.equipmentType ?? "")
        self._notes = State(initialValue: exercise.notes ?? "")
        self._editableSets = State(initialValue: exercise.sets.map { EditablePlanSetRow.from($0) })
        self._markdownText = State(initialValue: Self.generateMarkdown(from: exercise))
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                Picker("Mode", selection: $editMode) {
                    Text("Form").tag(0)
                    Text("Markdown").tag(1)
                }
                .pickerStyle(.segmented)
                .padding()
                .accessibilityIdentifier("edit-plan-exercise-mode-picker")

                if editMode == 0 {
                    formView
                } else {
                    markdownView
                }
            }
            .navigationTitle("Edit Exercise")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                        .accessibilityIdentifier("edit-plan-exercise-cancel")
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        saveExercise()
                    }
                    .accessibilityIdentifier("edit-plan-exercise-save")
                }
            }
            .onChange(of: editMode) { _, newValue in
                if newValue == 1 {
                    markdownText = generateMarkdownFromForm()
                    markdownError = nil
                } else {
                    parseMarkdownIntoForm()
                }
            }
        }
    }

    private var formView: some View {
        Form {
            Section("Exercise") {
                TextField("Name", text: $name)
                    .accessibilityIdentifier("edit-plan-exercise-name")
                TextField("Equipment", text: $equipmentType)
                    .accessibilityIdentifier("edit-plan-exercise-equipment")
            }

            Section("Notes") {
                TextEditor(text: $notes)
                    .frame(minHeight: 60)
                    .accessibilityIdentifier("edit-plan-exercise-notes")
            }

            Section {
                ForEach(Array(editableSets.enumerated()), id: \.element.id) { index, setRow in
                    HStack(spacing: LiftMarkTheme.spacingSM) {
                        Text("Set \(index + 1)")
                            .font(.subheadline)
                            .foregroundStyle(LiftMarkTheme.tertiaryLabel)
                            .frame(width: 45, alignment: .leading)

                        TextField("Wt", text: $editableSets[index].weightText)
                            #if os(iOS)
                            .keyboardType(.decimalPad)
                            #endif
                            .textFieldStyle(.roundedBorder)
                            .frame(width: 65)
                            .accessibilityIdentifier("edit-plan-set-weight-\(index)")

                        Text("x")
                            .foregroundStyle(LiftMarkTheme.secondaryLabel)

                        TextField("Reps", text: $editableSets[index].repsText)
                            #if os(iOS)
                            .keyboardType(.numberPad)
                            #endif
                            .textFieldStyle(.roundedBorder)
                            .frame(width: 50)
                            .accessibilityIdentifier("edit-plan-set-reps-\(index)")

                        TextField("Time", text: $editableSets[index].timeText)
                            #if os(iOS)
                            .keyboardType(.numberPad)
                            #endif
                            .textFieldStyle(.roundedBorder)
                            .frame(width: 50)
                            .accessibilityIdentifier("edit-plan-set-time-\(index)")
                        Text("s")
                            .font(.caption)
                            .foregroundStyle(LiftMarkTheme.secondaryLabel)

                        Spacer()
                    }
                }
                .onDelete(perform: deleteSets)
                .onMove(perform: moveSets)

                Button {
                    addSet()
                } label: {
                    Label("Add Set", systemImage: "plus.circle")
                }
                .accessibilityIdentifier("edit-plan-exercise-add-set")
            } header: {
                Text("Sets")
            }
        }
        .accessibilityIdentifier("edit-plan-exercise-form")
    }

    private var markdownView: some View {
        VStack(spacing: LiftMarkTheme.spacingSM) {
            if let error = markdownError {
                Text(error)
                    .font(.caption)
                    .foregroundStyle(LiftMarkTheme.destructive)
                    .padding(.horizontal)
            }

            TextEditor(text: $markdownText)
                .font(.system(.body, design: .monospaced))
                .padding(.horizontal)
                .accessibilityIdentifier("edit-plan-exercise-markdown")

            Text("LMWF format: ## Name [equipment]\n> notes\n- weight x reps")
                .font(.caption)
                .foregroundStyle(LiftMarkTheme.tertiaryLabel)
                .padding(.horizontal)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .accessibilityIdentifier("edit-plan-exercise-markdown-view")
    }

    private func addSet() {
        let lastSet = editableSets.last
        let newSet = EditablePlanSetRow(
            id: UUID().uuidString,
            weightText: lastSet?.weightText ?? "",
            repsText: lastSet?.repsText ?? "",
            timeText: lastSet?.timeText ?? "",
            weightUnit: lastSet?.weightUnit
        )
        editableSets.append(newSet)
    }

    private func deleteSets(at offsets: IndexSet) {
        editableSets.remove(atOffsets: offsets)
    }

    private func moveSets(from source: IndexSet, to destination: Int) {
        editableSets.move(fromOffsets: source, toOffset: destination)
    }

    private func saveExercise() {
        var saveName = name
        var saveNotes = notes
        var saveEquipment = equipmentType
        var saveSets = editableSets

        if editMode == 1 {
            let wrappedMarkdown = "# Workout\n\(markdownText)"
            let result = MarkdownParser.parseWorkout(wrappedMarkdown)
            guard let plan = result.data, let parsedExercise = plan.exercises.first else {
                markdownError = result.errors.first ?? "Failed to parse markdown"
                return
            }
            markdownError = nil

            saveName = parsedExercise.exerciseName
            saveEquipment = parsedExercise.equipmentType ?? ""
            saveNotes = parsedExercise.notes ?? ""

            var newSets: [EditablePlanSetRow] = []
            for (i, parsedSet) in parsedExercise.sets.enumerated() {
                let existingId: String? = i < exercise.sets.count ? exercise.sets[i].id : nil
                newSets.append(EditablePlanSetRow(
                    id: existingId ?? UUID().uuidString,
                    weightText: parsedSet.targetWeight.map {
                        $0.truncatingRemainder(dividingBy: 1) == 0 ? "\(Int($0))" : String(format: "%.1f", $0)
                    } ?? "",
                    repsText: parsedSet.targetReps.map { "\($0)" } ?? "",
                    timeText: parsedSet.targetTime.map { "\($0)" } ?? "",
                    weightUnit: parsedSet.targetWeightUnit
                ))
            }
            saveSets = newSets

            name = saveName
            equipmentType = saveEquipment
            notes = saveNotes
            editableSets = newSets
        }

        // Build the updated PlannedExercise
        var updatedExercise = exercise
        updatedExercise.exerciseName = saveName
        updatedExercise.equipmentType = saveEquipment.isEmpty ? nil : saveEquipment
        updatedExercise.notes = saveNotes.isEmpty ? nil : saveNotes

        var newPlannedSets: [PlannedSet] = []
        for (index, setRow) in saveSets.enumerated() {
            let weight = Double(setRow.weightText)
            let reps = Int(setRow.repsText)
            let time = Int(setRow.timeText)
            // Preserve existing set if possible, otherwise create new
            let existingSet: PlannedSet? = index < exercise.sets.count && setRow.id == exercise.sets[index].id
                ? exercise.sets[index] : nil

            var plannedSet = existingSet ?? PlannedSet(
                id: setRow.id,
                plannedExerciseId: exercise.id,
                orderIndex: index
            )
            plannedSet.orderIndex = index
            plannedSet.targetWeight = weight
            plannedSet.targetWeightUnit = setRow.weightUnit ?? existingSet?.targetWeightUnit
            plannedSet.targetReps = reps
            plannedSet.targetTime = time
            newPlannedSets.append(plannedSet)
        }
        updatedExercise.sets = newPlannedSets

        onSave(updatedExercise)
        dismiss()
    }

    private func generateMarkdownFromForm() -> String {
        var lines: [String] = []
        lines.append("## \(name)")
        if !equipmentType.isEmpty {
            lines.append("@type: \(equipmentType)")
        }
        if !notes.isEmpty {
            lines.append(notes)
        }
        for setRow in editableSets {
            lines.append("- \(formatSetLine(setRow))")
        }
        return lines.joined(separator: "\n")
    }

    private func formatSetLine(_ setRow: EditablePlanSetRow) -> String {
        var parts: [String] = []
        if !setRow.weightText.isEmpty {
            parts.append(setRow.weightText)
            if let unit = setRow.weightUnit {
                parts.append(unit.rawValue)
            }
        }
        if !setRow.repsText.isEmpty {
            parts.append("x \(setRow.repsText)")
        }
        if !setRow.timeText.isEmpty {
            parts.append("\(setRow.timeText)s")
        }
        return parts.isEmpty ? "x 1" : parts.joined(separator: " ")
    }

    private static func generateMarkdown(from exercise: PlannedExercise) -> String {
        var lines: [String] = []
        lines.append("## \(exercise.exerciseName)")
        if let equip = exercise.equipmentType, !equip.isEmpty {
            lines.append("@type: \(equip)")
        }
        if let notes = exercise.notes, !notes.isEmpty {
            lines.append(notes)
        }
        for set in exercise.sets {
            var parts: [String] = []
            if let w = set.targetWeight {
                let wStr = w.truncatingRemainder(dividingBy: 1) == 0 ? "\(Int(w))" : String(format: "%.1f", w)
                parts.append(wStr)
                if let unit = set.targetWeightUnit {
                    parts.append(unit.rawValue)
                }
            }
            if let r = set.targetReps {
                parts.append("x \(r)")
            }
            if let t = set.targetTime {
                parts.append("\(t)s")
            }
            lines.append("- \(parts.joined(separator: " "))")
        }
        return lines.joined(separator: "\n")
    }

    private func parseMarkdownIntoForm() {
        let wrappedMarkdown = "# Workout\n\(markdownText)"
        let result = MarkdownParser.parseWorkout(wrappedMarkdown)
        guard let plan = result.data, let parsedExercise = plan.exercises.first else {
            markdownError = result.errors.first ?? "Failed to parse markdown"
            return
        }
        markdownError = nil
        name = parsedExercise.exerciseName
        equipmentType = parsedExercise.equipmentType ?? ""
        notes = parsedExercise.notes ?? ""

        var newSets: [EditablePlanSetRow] = []
        for (i, parsedSet) in parsedExercise.sets.enumerated() {
            let existingId: String? = i < exercise.sets.count ? exercise.sets[i].id : nil
            newSets.append(EditablePlanSetRow(
                id: existingId ?? UUID().uuidString,
                weightText: parsedSet.targetWeight.map {
                    $0.truncatingRemainder(dividingBy: 1) == 0 ? "\(Int($0))" : String(format: "%.1f", $0)
                } ?? "",
                repsText: parsedSet.targetReps.map { "\($0)" } ?? "",
                timeText: parsedSet.targetTime.map { "\($0)" } ?? "",
                weightUnit: parsedSet.targetWeightUnit
            ))
        }
        editableSets = newSets
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

// MARK: - Edit Plan Markdown Sheet

private struct EditParseResult {
    let name: String
    let exerciseCount: Int
    let setCount: Int
    let warnings: [String]
}

private struct EditPlanMarkdownSheet: View {
    let planId: String
    let initialMarkdown: String

    @State private var markdownText = ""
    @State private var parseResult: EditParseResult?
    @State private var parseError: String?
    @State private var showDiscardConfirm = false
    @Environment(\.dismiss) private var dismiss
    @Environment(WorkoutPlanStore.self) private var planStore

    private var hasChanges: Bool {
        markdownText != initialMarkdown
    }

    private var canSave: Bool {
        !markdownText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && parseError == nil && hasChanges
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Markdown editor
                TextEditor(text: $markdownText)
                    .font(.system(.body, design: .monospaced))
                    .padding(LiftMarkTheme.spacingSM)
                    .accessibilityIdentifier("edit-plan-markdown-editor")

                // Parse error
                if let error = parseError {
                    HStack {
                        Image(systemName: "exclamationmark.triangle.fill")
                            .foregroundStyle(LiftMarkTheme.destructive)
                        Text(error)
                            .font(.caption)
                            .foregroundStyle(LiftMarkTheme.destructive)
                        Spacer()
                    }
                    .padding(.horizontal)
                    .padding(.vertical, LiftMarkTheme.spacingSM)
                    .background(LiftMarkTheme.destructive.opacity(0.1))
                }

                // Parse success
                if let result = parseResult {
                    HStack {
                        Image(systemName: "checkmark.circle.fill")
                            .foregroundStyle(LiftMarkTheme.success)
                        Text("\(result.name) - \(result.exerciseCount) exercises, \(result.setCount) sets")
                            .font(.caption)
                            .foregroundStyle(LiftMarkTheme.success)
                        Spacer()
                    }
                    .padding(.horizontal)
                    .padding(.vertical, LiftMarkTheme.spacingSM)
                    .background(LiftMarkTheme.success.opacity(0.1))

                    if !result.warnings.isEmpty {
                        VStack(alignment: .leading, spacing: 2) {
                            ForEach(result.warnings, id: \.self) { warning in
                                HStack(spacing: 4) {
                                    Image(systemName: "exclamationmark.triangle")
                                        .font(.caption2)
                                        .foregroundStyle(LiftMarkTheme.warning)
                                    Text(warning)
                                        .font(.caption2)
                                        .foregroundStyle(LiftMarkTheme.warning)
                                }
                            }
                        }
                        .padding(.horizontal)
                        .padding(.vertical, LiftMarkTheme.spacingXS)
                    }
                }
            }
            .navigationTitle("Edit Plan")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        if hasChanges {
                            showDiscardConfirm = true
                        } else {
                            dismiss()
                        }
                    }
                    .accessibilityIdentifier("edit-plan-cancel-button")
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        savePlan()
                    }
                    .disabled(!canSave)
                    .accessibilityIdentifier("edit-plan-save-button")
                }
            }
            .onChange(of: markdownText) {
                parseMarkdown()
            }
            .alert("Discard Changes?", isPresented: $showDiscardConfirm) {
                Button("Cancel", role: .cancel) {}
                Button("Discard", role: .destructive) {
                    dismiss()
                }
            } message: {
                Text("You have unsaved changes that will be lost.")
            }
        }
        .accessibilityIdentifier("edit-plan-markdown-sheet")
        .onAppear {
            markdownText = initialMarkdown
        }
    }

    private func parseMarkdown() {
        let trimmed = markdownText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            parseResult = nil
            parseError = nil
            return
        }

        let result = MarkdownParser.parseWorkout(trimmed)

        if !result.errors.isEmpty {
            parseError = result.errors.first ?? "Parse error"
            parseResult = nil
        } else {
            parseError = nil
            parseResult = EditParseResult(
                name: result.data?.name ?? "Untitled",
                exerciseCount: result.data?.exercises.count ?? 0,
                setCount: result.data?.exercises.reduce(0) { $0 + $1.sets.count } ?? 0,
                warnings: result.warnings
            )
        }
    }

    private func savePlan() {
        planStore.updatePlanMarkdown(id: planId, newMarkdown: markdownText)
        dismiss()
    }
}
