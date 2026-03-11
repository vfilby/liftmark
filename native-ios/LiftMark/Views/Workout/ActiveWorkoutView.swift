import SwiftUI

struct ActiveWorkoutView: View {
    @Environment(SessionStore.self) private var sessionStore
    @Environment(SettingsStore.self) private var settingsStore
    @Environment(\.dismiss) private var dismiss
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass

    @State private var showAddExercise = false
    @State private var editingExercise: SessionExercise?
    @State private var addExerciseMarkdown = ""
    @State private var activeRestTimer: RestTimerState?
    @State private var showFinishConfirm = false
    @State private var navigateToSummary = false
    @State private var showDiscardConfirm = false
    @State private var expandedExercises: Set<String> = []
    @State private var collapsedExercises: Set<String> = []
    @State private var restTimerGeneration: Int = 0
    @State private var lastInteractedExerciseId: String?

    private var session: WorkoutSession? { sessionStore.activeSession }

    /// True when more than 50% of sets were skipped/not completed
    private var isSkipHeavy: Bool {
        guard totalSets > 0 else { return false }
        let done = session?.exercises.reduce(0) { sum, ex in
            sum + ex.sets.filter { $0.status == .completed }.count
        } ?? 0
        return done < totalSets / 2
    }

    private var completedSets: Int {
        session?.exercises.reduce(0) { sum, ex in
            sum + ex.sets.filter { $0.status == .completed }.count
        } ?? 0
    }

    private var totalSets: Int {
        session?.exercises.reduce(0) { $0 + $1.sets.count } ?? 0
    }

    private var progress: Double {
        guard totalSets > 0 else { return 0 }
        return Double(completedSets) / Double(totalSets)
    }

    private var isRegularWidth: Bool {
        horizontalSizeClass == .regular
    }

    /// The name of the first exercise with a pending set, used for the iPad landscape history panel.
    private var activeExerciseName: String? {
        session?.exercises.first(where: { ex in
            ex.sets.contains { $0.status == .pending }
        })?.exerciseName
    }

    var body: some View {
        Group {
            if navigateToSummary {
                WorkoutSummaryView()
            } else {
                workoutContent
            }
        }
        .alert("Finish Workout?", isPresented: $showFinishConfirm) {
            Button("Cancel", role: .cancel) {}
            let incomplete = totalSets - completedSets
            Button(incomplete > 0 ? "Finish Anyway" : "Finish") {
                endLiveActivity(message: "Workout Complete")
                let completedSession = sessionStore.activeSession
                sessionStore.completeSession()
                navigateToSummary = true
                saveToHealthKitIfEnabled(completedSession)
            }
        } message: {
            let skipped = totalSets - completedSets
            if skipped > 0 {
                Text("You have \(skipped) incomplete sets. They will be marked as skipped.")
            } else {
                Text("Great job completing all your sets!")
            }
        }
        .alert("Discard Workout?", isPresented: $showDiscardConfirm) {
            Button("Cancel", role: .cancel) {}
            Button("Log Anyway") {
                endLiveActivity(message: "Workout Complete")
                let completedSession = sessionStore.activeSession
                sessionStore.completeSession()
                navigateToSummary = true
                saveToHealthKitIfEnabled(completedSession)
            }
            Button("Discard", role: .destructive) {
                endLiveActivity(message: "Workout Discarded", subtitle: "Workout not saved", immediate: true)
                sessionStore.cancelSession()
                dismiss()
            }
        } message: {
            Text("You've skipped most of your sets. Do you want to discard this workout?")
        }
    }

    private var workoutContent: some View {
        VStack(spacing: 0) {
            // Header
            HStack(spacing: LiftMarkTheme.spacingSM) {
                Button {
                    endLiveActivity(immediate: true)
                    dismiss()
                } label: {
                    HStack(spacing: 4) {
                        Image(systemName: "pause.fill")
                            .font(.caption)
                        Text("Pause")
                            .font(.subheadline)
                    }
                }
                .accessibilityIdentifier("active-workout-pause-button")

                Spacer()

                Text(session?.name ?? "Workout")
                    .font(.headline)
                    .lineLimit(1)

                Spacer()

                Button {
                    showAddExercise = true
                } label: {
                    Image(systemName: "plus")
                }
                .accessibilityIdentifier("active-workout-add-exercise-button")

                Button {
                    if isSkipHeavy {
                        showDiscardConfirm = true
                    } else {
                        showFinishConfirm = true
                    }
                } label: {
                    Text("Finish")
                        .font(.subheadline.bold())
                }
                .accessibilityIdentifier("active-workout-finish-button")
            }
            .padding()
            .background(LiftMarkTheme.background)
            .accessibilityElement(children: .contain)
            .accessibilityIdentifier("active-workout-header")

            // Progress bar
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

            Divider()

            // Workout content — adaptive layout for iPad
            GeometryReader { geometry in
                let isLandscape = geometry.size.width > geometry.size.height
                let showSidebar = isRegularWidth && isLandscape

                if showSidebar {
                    // iPad landscape: two-column layout
                    HStack(spacing: 0) {
                        exerciseListView
                            .frame(width: geometry.size.width * 0.6)

                        Divider()

                        exerciseHistoryPanel
                            .frame(width: geometry.size.width * 0.4)
                    }
                } else {
                    // iPhone or iPad portrait: single column, constrained width on iPad
                    exerciseListView
                        .frame(maxWidth: isRegularWidth ? 800 : .infinity)
                        .frame(maxWidth: .infinity)
                }
            }
            .accessibilityElement(children: .contain)
            .accessibilityIdentifier("active-workout-scroll")
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("active-workout-screen")
        #if os(iOS)
        .toolbar(.hidden, for: .navigationBar)
        #endif
        .onAppear {
            // If no active session (e.g., after data reset), dismiss back to home
            if session == nil {
                dismiss()
                return
            }
            if settingsStore.settings?.keepScreenAwake == true {
                #if canImport(UIKit)
                UIApplication.shared.isIdleTimerDisabled = true
                #endif
            }
            startLiveActivity()
        }
        .onDisappear {
            #if canImport(UIKit)
            UIApplication.shared.isIdleTimerDisabled = false
            #endif
        }
        .sheet(isPresented: $showAddExercise) {
            AddExerciseSheet(onAdd: { markdown in
                addExerciseFromMarkdown(markdown)
            })
        }
        .sheet(item: $editingExercise) { exercise in
            EditExerciseSheet(
                exercise: exercise,
                onSave: { name, notes, equipmentType, setChanges in
                    sessionStore.updateExercise(exerciseId: exercise.id, name: name, notes: notes, equipmentType: equipmentType)
                    for change in setChanges {
                        switch change {
                        case .update(let setId, let weight, let reps, let time):
                            sessionStore.updateSetTarget(setId: setId, targetWeight: weight, targetReps: reps, targetTime: time)
                        case .add(let weight, let unit, let reps, let time):
                            sessionStore.addSetToExercise(exerciseId: exercise.id, targetWeight: weight, targetWeightUnit: unit, targetReps: reps, targetTime: time)
                        case .delete(let setId):
                            sessionStore.deleteSet(setId: setId)
                        }
                    }
                    editingExercise = nil
                }
            )
        }
    }

    // MARK: - Exercise List

    private var exerciseListView: some View {
        ScrollViewReader { proxy in
            ScrollView {
                VStack(alignment: .leading, spacing: LiftMarkTheme.spacingMD) {
                    if let exercises = session?.exercises {
                        let displayItems = buildDisplayItems(from: exercises)
                        ForEach(displayItems) { item in
                            switch item {
                            case .single(let exercise, let exerciseIndex, let displayNumber):
                                let collapsed = isExerciseCollapsed(exercise)
                                let isActiveExercise = exercise.sets.contains { $0.status == .pending }
                                ActiveExerciseCard(
                                    exercise: exercise,
                                    exerciseIndex: exerciseIndex,
                                    displayNumber: displayNumber,
                                    settings: settingsStore.settings,
                                    isCollapsed: collapsed,
                                    activeRestTimer: isActiveExercise ? activeRestTimer : nil,
                                    onToggleCollapse: {
                                        toggleCollapse(exerciseId: exercise.id, currentlyCollapsed: collapsed)
                                    },
                                    onCompleteSet: { setIndex, weight, reps, elapsedTime in
                                        completeSet(exerciseIndex: exerciseIndex, setIndex: setIndex, userWeight: weight, userReps: reps, elapsedTime: elapsedTime)
                                    },
                                    onSkipSet: { setIndex in
                                        skipSet(exerciseIndex: exerciseIndex, setIndex: setIndex)
                                    },
                                    onEditExercise: {
                                        editingExercise = exercise
                                    },
                                    onSaveSet: { setIndex, weight, reps in
                                        saveEditedSet(exerciseIndex: exerciseIndex, setIndex: setIndex, weight: weight, reps: reps)
                                    },
                                    onDismissRest: {
                                        activeRestTimer = nil
                                    },
                                    restTimerGeneration: restTimerGeneration
                                )
                                .id(exercise.id)

                            case .section(let name):
                                sectionHeader(name: name)

                            case .superset(let parentExercise, let children):
                                let collapsed = isSupersetCollapsed(parentExercise, children: children)
                                let isActive = children.contains { $0.exercise.sets.contains { $0.status == .pending } }
                                SupersetCard(
                                    parentExercise: parentExercise,
                                    children: children,
                                    settings: settingsStore.settings,
                                    isCollapsed: collapsed,
                                    activeRestTimer: isActive ? activeRestTimer : nil,
                                    onToggleCollapse: {
                                        toggleCollapse(exerciseId: parentExercise.id, currentlyCollapsed: collapsed)
                                    },
                                    onCompleteSet: { exerciseIndex, setIndex, weight, reps, elapsedTime in
                                        completeSet(exerciseIndex: exerciseIndex, setIndex: setIndex, userWeight: weight, userReps: reps, elapsedTime: elapsedTime)
                                    },
                                    onSkipSet: { exerciseIndex, setIndex in
                                        skipSet(exerciseIndex: exerciseIndex, setIndex: setIndex)
                                    },
                                    onSaveSet: { exerciseIndex, setIndex, weight, reps in
                                        saveEditedSet(exerciseIndex: exerciseIndex, setIndex: setIndex, weight: weight, reps: reps)
                                    },
                                    onDismissRest: {
                                        activeRestTimer = nil
                                    },
                                    restTimerGeneration: restTimerGeneration
                                )
                                .id(parentExercise.id)
                            }
                        }
                    }
                }
                .padding()
            }
            .onChange(of: completedSets) { _, _ in
                scrollToNextPendingExercise(proxy: proxy)
            }
        }
    }

    // MARK: - Exercise History Panel (iPad Landscape)

    private var exerciseHistoryPanel: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("Exercise History")
                .font(.headline)
                .padding()

            Divider()

            if let exerciseName = activeExerciseName {
                ScrollView {
                    VStack(alignment: .leading, spacing: LiftMarkTheme.spacingMD) {
                        Text(exerciseName)
                            .font(.title3)
                            .fontWeight(.semibold)

                        ExerciseHistoryChartView(exerciseName: exerciseName)
                            .padding()
                            .background(LiftMarkTheme.secondaryBackground)
                            .clipShape(RoundedRectangle(cornerRadius: LiftMarkTheme.cornerRadiusMD))

                        ExerciseHistoryLastSessionView(exerciseName: exerciseName)
                    }
                    .padding()
                }
                .id(exerciseName) // Reset scroll when exercise changes
            } else {
                VStack(spacing: LiftMarkTheme.spacingMD) {
                    Image(systemName: "chart.line.uptrend.xyaxis")
                        .font(.largeTitle)
                        .foregroundStyle(LiftMarkTheme.tertiaryLabel)
                    Text("Complete sets to see exercise history")
                        .font(.subheadline)
                        .foregroundStyle(LiftMarkTheme.secondaryLabel)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        .background(LiftMarkTheme.secondaryBackground.opacity(0.5))
    }

    // MARK: - Actions

    private func completeSet(exerciseIndex: Int, setIndex: Int, userWeight: Double? = nil, userReps: Int? = nil, elapsedTime: Int? = nil) {
        guard let session, exerciseIndex < session.exercises.count else { return }
        let exercise = session.exercises[exerciseIndex]
        guard setIndex < exercise.sets.count else { return }
        let set = exercise.sets[setIndex]

        lastInteractedExerciseId = exercise.id

        // Dismiss any running rest timer before starting a new one
        activeRestTimer = nil

        // Persist with actual values — prefer user-edited, then existing actual, then target
        sessionStore.completeSet(
            setId: set.id,
            actualWeight: userWeight ?? set.actualWeight ?? set.targetWeight,
            actualWeightUnit: set.actualWeightUnit ?? set.targetWeightUnit,
            actualReps: userReps ?? set.actualReps ?? set.targetReps,
            actualTime: elapsedTime ?? set.actualTime ?? set.targetTime,
            actualRpe: set.actualRpe ?? set.targetRpe
        )

        // Trigger rest timer if applicable
        if let rest = set.restSeconds, rest > 0,
           settingsStore.settings?.autoStartRestTimer == true {
            activeRestTimer = RestTimerState(seconds: rest)
            restTimerGeneration += 1
            // Find the next exercise for the rest timer display
            let nextExercise = session.exercises.first { ex in ex.sets.contains { $0.status == .pending } }
            updateLiveActivity(restTimer: (remainingSeconds: rest, nextExercise: nextExercise))
        } else {
            updateLiveActivity()
        }
    }

    private func skipSet(exerciseIndex: Int, setIndex: Int) {
        guard let session, exerciseIndex < session.exercises.count else { return }
        let exercise = session.exercises[exerciseIndex]
        guard setIndex < exercise.sets.count else { return }

        lastInteractedExerciseId = exercise.id

        // Dismiss any running rest timer on skip
        activeRestTimer = nil

        sessionStore.skipSet(setId: exercise.sets[setIndex].id)
        updateLiveActivity()
    }

    private func saveEditedSet(exerciseIndex: Int, setIndex: Int, weight: Double?, reps: Int?) {
        guard let session, exerciseIndex < session.exercises.count else { return }
        let exercise = session.exercises[exerciseIndex]
        guard setIndex < exercise.sets.count else { return }
        let set = exercise.sets[setIndex]

        sessionStore.completeSet(
            setId: set.id,
            actualWeight: weight,
            actualWeightUnit: set.actualWeightUnit ?? set.targetWeightUnit,
            actualReps: reps,
            actualTime: set.actualTime ?? set.targetTime,
            actualRpe: set.actualRpe ?? set.targetRpe
        )
    }

    // MARK: - Collapse Helpers

    private func isExerciseCollapsed(_ exercise: SessionExercise) -> Bool {
        // User manual overrides take priority
        if expandedExercises.contains(exercise.id) { return false }
        if collapsedExercises.contains(exercise.id) { return true }

        let allDone = exercise.sets.allSatisfy { $0.status == .completed || $0.status == .skipped }
        if allDone { return true }

        // Current exercise: expanded (first pending, or last-interacted if still has pending sets)
        let isCurrentExercise: Bool = {
            if let lastId = lastInteractedExerciseId, lastId == exercise.id {
                return exercise.sets.contains { $0.status == .pending }
            }
            // First exercise with pending sets
            guard let exercises = session?.exercises else { return false }
            return exercises.first(where: { $0.sets.contains { $0.status == .pending } })?.id == exercise.id
        }()

        if isCurrentExercise { return false }

        // Future exercises: collapsed
        return true
    }

    private func scrollToNextPendingExercise(proxy: ScrollViewProxy) {
        guard let exercises = session?.exercises else { return }

        // Only auto-scroll when the last-interacted exercise is fully complete
        if let lastId = lastInteractedExerciseId,
           let lastExercise = exercises.first(where: { $0.id == lastId }) {
            let allDone = lastExercise.sets.allSatisfy { $0.status == .completed || $0.status == .skipped }
            guard allDone else { return }
        }

        if let nextExercise = exercises.first(where: { ex in
            ex.sets.contains { $0.status == .pending }
        }) {
            withAnimation {
                proxy.scrollTo(nextExercise.id, anchor: .top)
            }
        }
    }

    private func toggleCollapse(exerciseId: String, currentlyCollapsed: Bool) {
        if currentlyCollapsed {
            expandedExercises.insert(exerciseId)
            collapsedExercises.remove(exerciseId)
        } else {
            collapsedExercises.insert(exerciseId)
            expandedExercises.remove(exerciseId)
        }
    }

    private func isSupersetCollapsed(_ parent: SessionExercise, children: [(exercise: SessionExercise, exerciseIndex: Int, displayNumber: Int)]) -> Bool {
        // User manual overrides on the parent ID
        if expandedExercises.contains(parent.id) { return false }
        if collapsedExercises.contains(parent.id) { return true }

        let allDone = children.allSatisfy { child in
            child.exercise.sets.allSatisfy { $0.status == .completed || $0.status == .skipped }
        }
        if allDone { return true }

        // Current superset: expanded if any child is the current exercise
        let isCurrentSuperset = children.contains { child in
            if let lastId = lastInteractedExerciseId, lastId == child.exercise.id {
                return child.exercise.sets.contains { $0.status == .pending }
            }
            return false
        }
        if isCurrentSuperset { return false }

        // First pending superset
        guard let exercises = session?.exercises else { return true }
        let firstPendingId = exercises.first(where: { $0.sets.contains { $0.status == .pending } })?.id
        if children.contains(where: { $0.exercise.id == firstPendingId }) { return false }

        return true
    }

    private func buildDisplayItems(from exercises: [SessionExercise]) -> [ExerciseDisplayItem] {
        var items: [ExerciseDisplayItem] = []
        var processedIds = Set<String>()
        var displayNumber = 1

        for (index, exercise) in exercises.enumerated() {
            if processedIds.contains(exercise.id) { continue }

            // Check if this is a superset parent (groupType == .superset with no sets)
            if exercise.groupType == .superset && exercise.sets.isEmpty {
                // Gather children
                var children: [(exercise: SessionExercise, exerciseIndex: Int, displayNumber: Int)] = []
                for (childIndex, child) in exercises.enumerated() {
                    if child.parentExerciseId == exercise.id {
                        children.append((exercise: child, exerciseIndex: childIndex, displayNumber: displayNumber))
                        displayNumber += 1
                        processedIds.insert(child.id)
                    }
                }
                processedIds.insert(exercise.id)
                if !children.isEmpty {
                    items.append(.superset(parent: exercise, children: children))
                }
            } else if exercise.parentExerciseId != nil {
                // Skip orphan children (already handled by superset parent)
                continue
            } else if exercise.groupType == .section && exercise.sets.isEmpty {
                // Section header — emit section divider then gather children as individual exercises
                processedIds.insert(exercise.id)
                let sectionName = exercise.groupName ?? exercise.exerciseName
                if !sectionName.isEmpty {
                    items.append(.section(name: sectionName))
                }
                for (childIndex, child) in exercises.enumerated() {
                    if child.parentExerciseId == exercise.id {
                        items.append(.single(exercise: child, exerciseIndex: childIndex, displayNumber: displayNumber))
                        displayNumber += 1
                        processedIds.insert(child.id)
                    }
                }
            } else {
                items.append(.single(exercise: exercise, exerciseIndex: index, displayNumber: displayNumber))
                displayNumber += 1
                processedIds.insert(exercise.id)
            }
        }
        return items
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

    private func sectionColor(for name: String) -> Color {
        switch name.lowercased() {
        case "warmup", "warm-up", "warm up": return LiftMarkTheme.warmupAccent
        case "cooldown", "cool-down", "cool down": return LiftMarkTheme.cooldownAccent
        default: return LiftMarkTheme.primary
        }
    }

    private func addExerciseFromMarkdown(_ markdown: String) {
        let result = MarkdownParser.parseWorkout(markdown)
        guard let plan = result.data, let firstExercise = plan.exercises.first else { return }
        let sets = firstExercise.sets.map { set in
            (weight: set.targetWeight, unit: set.targetWeightUnit, reps: set.targetReps, time: set.targetTime)
        }
        sessionStore.addExercise(exerciseName: firstExercise.exerciseName, sets: sets)
    }

    // MARK: - Live Activity

    private func updateLiveActivity(restTimer: (remainingSeconds: Int, nextExercise: SessionExercise?)? = nil) {
        guard settingsStore.settings?.liveActivitiesEnabled == true,
              LiveActivityService.shared.isAvailable(),
              let session else { return }

        let currentExercise = session.exercises.first { ex in ex.sets.contains { $0.status == .pending } }
        let currentSetIdx = currentExercise?.sets.firstIndex { $0.status == .pending } ?? 0

        LiveActivityService.shared.updateWorkoutActivity(
            session: session,
            exercise: currentExercise,
            setIndex: currentSetIdx,
            progress: (completed: completedSets, total: totalSets),
            restTimer: restTimer
        )
    }

    private func startLiveActivity() {
        guard settingsStore.settings?.liveActivitiesEnabled == true,
              LiveActivityService.shared.isAvailable(),
              let session else { return }

        let currentExercise = session.exercises.first { ex in ex.sets.contains { $0.status == .pending } }
        let currentSetIdx = currentExercise?.sets.firstIndex { $0.status == .pending } ?? 0

        LiveActivityService.shared.startWorkoutActivity(
            session: session,
            exercise: currentExercise,
            setIndex: currentSetIdx,
            progress: (completed: completedSets, total: totalSets)
        )
    }

    private func endLiveActivity(message: String? = nil, subtitle: String? = nil, immediate: Bool = false) {
        guard settingsStore.settings?.liveActivitiesEnabled == true,
              LiveActivityService.shared.isAvailable() else { return }
        LiveActivityService.shared.endWorkoutActivity(message: message, subtitle: subtitle, immediate: immediate)
    }

    private func saveToHealthKitIfEnabled(_ session: WorkoutSession?) {
        guard let session,
              settingsStore.settings?.healthKitEnabled == true else { return }
        Task {
            let result = await HealthKitService.saveWorkout(session)
            if !result.success, let error = result.error {
                Logger.shared.error(.app, "Failed to save workout to HealthKit: \(error)")
            }
        }
    }
}

// MARK: - Rest Timer State

private struct RestTimerState {
    let seconds: Int
}

// MARK: - Active Exercise Card

private struct ActiveExerciseCard: View {
    let exercise: SessionExercise
    let exerciseIndex: Int
    let displayNumber: Int
    let settings: UserSettings?
    let isCollapsed: Bool
    let activeRestTimer: RestTimerState?
    let onToggleCollapse: () -> Void
    let onCompleteSet: (Int, Double?, Int?, Int?) -> Void
    let onSkipSet: (Int) -> Void
    let onEditExercise: () -> Void
    let onSaveSet: (Int, Double?, Int?) -> Void
    let onDismissRest: () -> Void
    var restTimerGeneration: Int = 0

    @State private var currentWeightText: String = ""

    private var currentSetIndex: Int? {
        exercise.sets.firstIndex { $0.status == .pending }
    }

    private var completedSetCount: Int {
        exercise.sets.filter { $0.status == .completed || $0.status == .skipped }.count
    }

    /// Index of the last completed/skipped set (for placing rest timer after it)
    private var lastCompletedSetIndex: Int? {
        for i in stride(from: exercise.sets.count - 1, through: 0, by: -1) {
            if exercise.sets[i].status == .completed || exercise.sets[i].status == .skipped {
                return i
            }
        }
        return nil
    }

    var body: some View {
        VStack(alignment: .leading, spacing: LiftMarkTheme.spacingSM) {
            // Exercise header — tappable to toggle collapse
            Button {
                onToggleCollapse()
            } label: {
                HStack(spacing: LiftMarkTheme.spacingSM) {
                    Text("\(displayNumber)")
                        .font(.caption.bold())
                        .foregroundStyle(.white)
                        .frame(width: 24, height: 24)
                        .background(exerciseStatusColor)
                        .clipShape(Circle())

                    Text(exercise.exerciseName)
                        .font(.headline)
                        .foregroundStyle(exercise.sets.allSatisfy({ $0.status == .completed || $0.status == .skipped }) ? LiftMarkTheme.secondaryLabel : LiftMarkTheme.label)

                    Spacer()

                    if isCollapsed {
                        Text("\(completedSetCount)/\(exercise.sets.count) sets")
                            .font(.caption)
                            .foregroundStyle(LiftMarkTheme.secondaryLabel)
                        Image(systemName: "chevron.right")
                            .font(.caption)
                            .foregroundStyle(LiftMarkTheme.tertiaryLabel)
                    } else {
                        // Edit button
                        Button {
                            onEditExercise()
                        } label: {
                            Image(systemName: "pencil")
                                .font(.caption)
                                .foregroundStyle(LiftMarkTheme.secondaryLabel)
                        }
                        .buttonStyle(.plain)
                        .accessibilityIdentifier("edit-exercise-button-\(exerciseIndex)")

                        // YouTube link
                        if let url = youtubeSearchURL(for: exercise.exerciseName) {
                            Link(destination: url) {
                                Image(systemName: "play.rectangle")
                                    .font(.caption)
                                    .foregroundStyle(LiftMarkTheme.secondaryLabel)
                            }
                            .accessibilityIdentifier("youtube-link-\(exercise.exerciseName)")
                        }
                    }
                }
            }
            .buttonStyle(.plain)

            if !isCollapsed {
                // Notes — indented to align with title
                if let notes = exercise.notes, !notes.isEmpty {
                    Text(notes)
                        .font(.caption)
                        .foregroundStyle(LiftMarkTheme.secondaryLabel)
                        .italic()
                        .padding(.leading, 32) // badge width + spacing
                }

                // Sets with inline rest placeholders and rest timer
                ForEach(Array(exercise.sets.enumerated()), id: \.element.id) { setIndex, set in
                    SetRowView(
                        set: set,
                        setNumber: setIndex + 1,
                        isCurrent: setIndex == currentSetIndex,
                        exerciseName: exercise.exerciseName,
                        equipmentType: exercise.equipmentType,
                        onComplete: { weight, reps in
                            onCompleteSet(setIndex, weight, reps, nil)
                        },
                        onSkip: { onSkipSet(setIndex) },
                        onSave: { weight, reps in
                            onSaveSet(setIndex, weight, reps)
                        },
                        onWeightChanged: setIndex == currentSetIndex ? { newWeight in
                            currentWeightText = newWeight
                        } : nil
                    )

                    // Inline rest timer — placed after the last completed set
                    if let lastIdx = lastCompletedSetIndex, setIndex == lastIdx,
                       let restState = activeRestTimer {
                        RestTimerView(totalSeconds: restState.seconds) {
                            onDismissRest()
                        }
                        .id(restTimerGeneration)
                    }

                    // Rest placeholder between pending sets
                    if set.status == .pending,
                       let rest = set.restSeconds, rest > 0,
                       setIndex < exercise.sets.count - 1,
                       setIndex != currentSetIndex {
                        HStack(spacing: LiftMarkTheme.spacingSM) {
                            Rectangle()
                                .fill(LiftMarkTheme.tertiaryLabel.opacity(0.3))
                                .frame(height: 1)
                            Text("Rest \(rest)s")
                                .font(.caption2)
                                .foregroundStyle(LiftMarkTheme.tertiaryLabel)
                            Rectangle()
                                .fill(LiftMarkTheme.tertiaryLabel.opacity(0.3))
                                .frame(height: 1)
                        }
                        .padding(.vertical, 2)
                    }
                }

                // Timed exercise timer — keyed by set ID so it resets between sets
                if let currentIdx = currentSetIndex {
                    let currentSet = exercise.sets[currentIdx]
                    if let targetTime = currentSet.targetTime, targetTime > 0 {
                        ExerciseTimerView(targetSeconds: targetTime, isPerSide: currentSet.isPerSide) { elapsedSeconds in
                            let weight = Double(currentWeightText)
                            onCompleteSet(currentIdx, weight, nil, elapsedSeconds)
                        }
                        .id(currentSet.id)
                    }
                }
            }
        }
        .padding()
        .background(LiftMarkTheme.secondaryBackground)
        .clipShape(RoundedRectangle(cornerRadius: LiftMarkTheme.cornerRadiusMD))
        .opacity(exercise.sets.allSatisfy({ $0.status == .completed || $0.status == .skipped }) ? 0.6 : 1.0)
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("exercise-card-\(exerciseIndex)")
    }

    private var exerciseStatusColor: Color {
        switch exercise.status {
        case .completed: return LiftMarkTheme.success
        case .inProgress: return LiftMarkTheme.primary
        case .skipped: return LiftMarkTheme.warning
        case .pending: return LiftMarkTheme.tertiaryLabel
        }
    }

    private func youtubeSearchURL(for name: String) -> URL? {
        let query = name.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? name
        return URL(string: "https://www.youtube.com/results?search_query=\(query)+form")
    }
}

// MARK: - Add Exercise Sheet

private struct AddExerciseSheet: View {
    let onAdd: (String) -> Void
    @State private var markdown = ""
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            VStack(spacing: LiftMarkTheme.spacingMD) {
                Text("Enter exercise in LMWF format:")
                    .font(.subheadline)
                    .foregroundStyle(LiftMarkTheme.secondaryLabel)

                TextEditor(text: $markdown)
                    .font(.system(.body, design: .monospaced))
                    .frame(minHeight: 120)
                    .overlay(
                        RoundedRectangle(cornerRadius: LiftMarkTheme.cornerRadiusSM)
                            .stroke(LiftMarkTheme.tertiaryLabel, lineWidth: 1)
                    )

                Text("Example:\n## Bicep Curl [dumbbell]\n- 25 x 12\n- 25 x 10")
                    .font(.caption)
                    .foregroundStyle(LiftMarkTheme.tertiaryLabel)
                    .frame(maxWidth: .infinity, alignment: .leading)

                Spacer()
            }
            .padding()
            .navigationTitle("Add Exercise")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Add") {
                        onAdd(markdown)
                        dismiss()
                    }
                    .disabled(markdown.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
            }
        }
    }
}

// MARK: - Edit Exercise Set Change

private enum EditExerciseSetChange {
    case update(setId: String, weight: Double?, reps: Int?, time: Int?)
    case add(weight: Double?, unit: WeightUnit?, reps: Int?, time: Int?)
    case delete(setId: String)
}

// MARK: - Editable Set Row Model

private struct EditableSetRow: Identifiable {
    let id: String
    let existingSetId: String?
    var weightText: String
    var repsText: String
    var timeText: String
    var weightUnit: WeightUnit?
    var status: SetStatus

    static func from(_ set: SessionSet) -> EditableSetRow {
        EditableSetRow(
            id: set.id,
            existingSetId: set.id,
            weightText: {
                if let w = set.targetWeight {
                    return w.truncatingRemainder(dividingBy: 1) == 0 ? "\(Int(w))" : String(format: "%.1f", w)
                }
                return ""
            }(),
            repsText: set.targetReps.map { "\($0)" } ?? "",
            timeText: set.targetTime.map { "\($0)" } ?? "",
            weightUnit: set.targetWeightUnit,
            status: set.status
        )
    }
}

// MARK: - Edit Exercise Sheet

private struct EditExerciseSheet: View {
    let exercise: SessionExercise
    let onSave: (String, String?, String?, [EditExerciseSetChange]) -> Void
    @State private var name: String
    @State private var equipmentType: String
    @State private var notes: String
    @State private var editableSets: [EditableSetRow]
    @State private var editMode: Int = 0
    @State private var markdownText: String = ""
    @State private var markdownError: String?
    @Environment(\.dismiss) private var dismiss

    init(exercise: SessionExercise, onSave: @escaping (String, String?, String?, [EditExerciseSetChange]) -> Void) {
        self.exercise = exercise
        self.onSave = onSave
        self._name = State(initialValue: exercise.exerciseName)
        self._equipmentType = State(initialValue: exercise.equipmentType ?? "")
        self._notes = State(initialValue: exercise.notes ?? "")
        self._editableSets = State(initialValue: exercise.sets.map { EditableSetRow.from($0) })
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
                .accessibilityIdentifier("edit-exercise-mode-picker")

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
                        .accessibilityIdentifier("edit-exercise-cancel")
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        saveExercise()
                    }
                    .accessibilityIdentifier("edit-exercise-save")
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
                    .accessibilityIdentifier("edit-exercise-name")
                TextField("Equipment", text: $equipmentType)
                    .accessibilityIdentifier("edit-exercise-equipment")
            }

            Section("Notes") {
                TextEditor(text: $notes)
                    .frame(minHeight: 60)
                    .accessibilityIdentifier("edit-exercise-notes")
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
                            .accessibilityIdentifier("edit-set-weight-\(index)")

                        Text("x")
                            .foregroundStyle(LiftMarkTheme.secondaryLabel)

                        TextField("Reps", text: $editableSets[index].repsText)
                            #if os(iOS)
                            .keyboardType(.numberPad)
                            #endif
                            .textFieldStyle(.roundedBorder)
                            .frame(width: 50)
                            .accessibilityIdentifier("edit-set-reps-\(index)")

                        if !setRow.timeText.isEmpty {
                            TextField("Time", text: $editableSets[index].timeText)
                                #if os(iOS)
                                .keyboardType(.numberPad)
                                #endif
                                .textFieldStyle(.roundedBorder)
                                .frame(width: 50)
                                .accessibilityIdentifier("edit-set-time-\(index)")
                            Text("s")
                                .font(.caption)
                                .foregroundStyle(LiftMarkTheme.secondaryLabel)
                        }

                        Spacer()

                        if setRow.status != .pending {
                            Text(setRow.status.rawValue)
                                .font(.caption2)
                                .foregroundStyle(LiftMarkTheme.secondaryLabel)
                        }
                    }
                }
                .onDelete(perform: deleteSets)
                .onMove(perform: moveSets)

                Button {
                    addSet()
                } label: {
                    Label("Add Set", systemImage: "plus.circle")
                }
                .accessibilityIdentifier("edit-exercise-add-set")
            } header: {
                Text("Sets")
            }
        }
        .accessibilityIdentifier("edit-exercise-form")
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
                .accessibilityIdentifier("edit-exercise-markdown")

            Text("LMWF format: ## Name [equipment]\n> notes\n- weight x reps")
                .font(.caption)
                .foregroundStyle(LiftMarkTheme.tertiaryLabel)
                .padding(.horizontal)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .accessibilityIdentifier("edit-exercise-markdown-view")
    }

    private func addSet() {
        let lastSet = editableSets.last
        let newSet = EditableSetRow(
            id: UUID().uuidString,
            existingSetId: nil,
            weightText: lastSet?.weightText ?? "",
            repsText: lastSet?.repsText ?? "",
            timeText: lastSet?.timeText ?? "",
            weightUnit: lastSet?.weightUnit,
            status: .pending
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
        if editMode == 1 {
            parseMarkdownIntoForm()
            if markdownError != nil { return }
        }

        var changes: [EditExerciseSetChange] = []
        let originalSetIds = Set(exercise.sets.map { $0.id })
        let currentSetIds = Set(editableSets.compactMap { $0.existingSetId })

        for originalId in originalSetIds where !currentSetIds.contains(originalId) {
            changes.append(.delete(setId: originalId))
        }

        for setRow in editableSets {
            let weight = Double(setRow.weightText)
            let reps = Int(setRow.repsText)
            let time = Int(setRow.timeText)

            if let existingId = setRow.existingSetId {
                changes.append(.update(setId: existingId, weight: weight, reps: reps, time: time))
            } else {
                changes.append(.add(weight: weight, unit: setRow.weightUnit, reps: reps, time: time))
            }
        }

        onSave(
            name,
            notes.isEmpty ? nil : notes,
            equipmentType.isEmpty ? nil : equipmentType,
            changes
        )
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

    private func formatSetLine(_ setRow: EditableSetRow) -> String {
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

    private static func generateMarkdown(from exercise: SessionExercise) -> String {
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

        var newSets: [EditableSetRow] = []
        for (i, parsedSet) in parsedExercise.sets.enumerated() {
            let existingId: String? = i < exercise.sets.count ? exercise.sets[i].id : nil
            let existingStatus: SetStatus = i < exercise.sets.count ? exercise.sets[i].status : .pending
            newSets.append(EditableSetRow(
                id: existingId ?? UUID().uuidString,
                existingSetId: existingId,
                weightText: parsedSet.targetWeight.map {
                    $0.truncatingRemainder(dividingBy: 1) == 0 ? "\(Int($0))" : String(format: "%.1f", $0)
                } ?? "",
                repsText: parsedSet.targetReps.map { "\($0)" } ?? "",
                timeText: parsedSet.targetTime.map { "\($0)" } ?? "",
                weightUnit: parsedSet.targetWeightUnit,
                status: existingStatus
            ))
        }
        editableSets = newSets
    }
}

// MARK: - Exercise Display Item

private enum ExerciseDisplayItem: Identifiable {
    case single(exercise: SessionExercise, exerciseIndex: Int, displayNumber: Int)
    case superset(parent: SessionExercise, children: [(exercise: SessionExercise, exerciseIndex: Int, displayNumber: Int)])
    case section(name: String)

    var id: String {
        switch self {
        case .single(let exercise, _, _): return exercise.id
        case .superset(let parent, _): return parent.id
        case .section(let name): return "section-\(name)"
        }
    }
}

// MARK: - Superset Card

private struct SupersetCard: View {
    let parentExercise: SessionExercise
    let children: [(exercise: SessionExercise, exerciseIndex: Int, displayNumber: Int)]
    let settings: UserSettings?
    let isCollapsed: Bool
    let activeRestTimer: RestTimerState?
    let onToggleCollapse: () -> Void
    let onCompleteSet: (Int, Int, Double?, Int?, Int?) -> Void  // exerciseIndex, setIndex, weight, reps, time
    let onSkipSet: (Int, Int) -> Void  // exerciseIndex, setIndex
    let onSaveSet: (Int, Int, Double?, Int?) -> Void  // exerciseIndex, setIndex, weight, reps
    let onDismissRest: () -> Void
    var restTimerGeneration: Int = 0

    private var allSetsCompleted: Bool {
        children.allSatisfy { child in
            child.exercise.sets.allSatisfy { $0.status == .completed || $0.status == .skipped }
        }
    }

    private var completedSetCount: Int {
        children.reduce(0) { sum, child in
            sum + child.exercise.sets.filter { $0.status == .completed || $0.status == .skipped }.count
        }
    }

    private var totalSetCount: Int {
        children.reduce(0) { $0 + $1.exercise.sets.count }
    }

    /// Build interleaved sets: round-robin across children
    private var interleavedSets: [(exercise: SessionExercise, exerciseIndex: Int, set: SessionSet, setIndex: Int)] {
        let maxSets = children.map { $0.exercise.sets.count }.max() ?? 0
        var result: [(exercise: SessionExercise, exerciseIndex: Int, set: SessionSet, setIndex: Int)] = []
        for round in 0..<maxSets {
            for child in children {
                if round < child.exercise.sets.count {
                    result.append((
                        exercise: child.exercise,
                        exerciseIndex: child.exerciseIndex,
                        set: child.exercise.sets[round],
                        setIndex: round
                    ))
                }
            }
        }
        return result
    }

    /// The last completed/skipped set across all children
    private var lastCompletedSetId: String? {
        let allSets = interleavedSets
        for item in allSets.reversed() {
            if item.set.status == .completed || item.set.status == .skipped {
                return item.set.id
            }
        }
        return nil
    }

    var body: some View {
        VStack(alignment: .leading, spacing: LiftMarkTheme.spacingSM) {
            // Superset header
            Button {
                onToggleCollapse()
            } label: {
                HStack(spacing: LiftMarkTheme.spacingSM) {
                    // Purple superset icon
                    Image(systemName: "arrow.triangle.2.circlepath")
                        .font(.caption.bold())
                        .foregroundStyle(.white)
                        .frame(width: 24, height: 24)
                        .background(Color.purple)
                        .clipShape(Circle())

                    VStack(alignment: .leading, spacing: 2) {
                        HStack(spacing: LiftMarkTheme.spacingXS) {
                            Text("SUPERSET")
                                .font(.caption2.bold())
                                .foregroundStyle(.white)
                                .padding(.horizontal, 6)
                                .padding(.vertical, 2)
                                .background(Color.purple)
                                .clipShape(Capsule())
                            Text(supersetTitle)
                                .font(.headline)
                                .foregroundStyle(allSetsCompleted ? LiftMarkTheme.secondaryLabel : LiftMarkTheme.label)
                        }
                        Text(children.map { "\($0.displayNumber). \($0.exercise.exerciseName)" }.joined(separator: " + "))
                            .font(.caption)
                            .foregroundStyle(LiftMarkTheme.secondaryLabel)
                    }

                    Spacer()

                    if isCollapsed {
                        Text("\(completedSetCount)/\(totalSetCount) sets")
                            .font(.caption)
                            .foregroundStyle(LiftMarkTheme.secondaryLabel)
                        Image(systemName: "chevron.right")
                            .font(.caption)
                            .foregroundStyle(LiftMarkTheme.tertiaryLabel)
                    }
                }
            }
            .buttonStyle(.plain)

            if !isCollapsed {
                // Interleaved sets
                let interleaved = interleavedSets
                let firstPendingSetId = interleaved.first(where: { $0.set.status == .pending })?.set.id
                ForEach(Array(interleaved.enumerated()), id: \.element.set.id) { idx, item in
                    let isCurrent = item.set.id == firstPendingSetId

                    // Exercise name label for each set
                    Text(item.exercise.exerciseName)
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(LiftMarkTheme.secondaryLabel)
                        .padding(.leading, 32)

                    SetRowView(
                        set: item.set,
                        setNumber: item.setIndex + 1,
                        isCurrent: isCurrent,
                        exerciseName: item.exercise.exerciseName,
                        equipmentType: item.exercise.equipmentType,
                        onComplete: { weight, reps in
                            onCompleteSet(item.exerciseIndex, item.setIndex, weight, reps, nil)
                        },
                        onSkip: { onSkipSet(item.exerciseIndex, item.setIndex) },
                        onSave: { weight, reps in
                            onSaveSet(item.exerciseIndex, item.setIndex, weight, reps)
                        }
                    )

                    // Rest timer after last completed set
                    if let lastId = lastCompletedSetId, item.set.id == lastId,
                       let restState = activeRestTimer {
                        RestTimerView(totalSeconds: restState.seconds) {
                            onDismissRest()
                        }
                        .id(restTimerGeneration)
                    }
                }
            }
        }
        .padding()
        .background(LiftMarkTheme.secondaryBackground)
        .clipShape(RoundedRectangle(cornerRadius: LiftMarkTheme.cornerRadiusMD))
        .opacity(allSetsCompleted ? 0.6 : 1.0)
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("superset-card-\(parentExercise.exerciseName)")
    }

    private var supersetTitle: String {
        let name = parentExercise.exerciseName
        if name.lowercased().hasPrefix("superset") {
            return name
        }
        return "Superset"
    }
}

// MARK: - Exercise History Last Session (iPad Sidebar)

private struct ExerciseHistoryLastSessionView: View {
    let exerciseName: String
    @State private var historyPoints: [ExerciseHistoryPoint] = []
    @State private var isLoading = true

    private var lastSession: ExerciseHistoryPoint? {
        historyPoints.sorted { $0.date > $1.date }.first
    }

    var body: some View {
        Group {
            if isLoading {
                ProgressView()
                    .frame(maxWidth: .infinity, minHeight: 60)
            } else if let session = lastSession {
                VStack(alignment: .leading, spacing: LiftMarkTheme.spacingSM) {
                    Text("Last Session")
                        .font(.headline)

                    VStack(alignment: .leading, spacing: LiftMarkTheme.spacingXS) {
                        HStack {
                            Text("Date")
                                .foregroundStyle(LiftMarkTheme.secondaryLabel)
                            Spacer()
                            Text(formatDate(session.date))
                        }
                        .font(.subheadline)

                        HStack {
                            Text("Workout")
                                .foregroundStyle(LiftMarkTheme.secondaryLabel)
                            Spacer()
                            Text(session.workoutName)
                        }
                        .font(.subheadline)

                        if session.maxWeight > 0 {
                            HStack {
                                Text("Max Weight")
                                    .foregroundStyle(LiftMarkTheme.secondaryLabel)
                                Spacer()
                                Text("\(Int(session.maxWeight)) \(session.unit.rawValue)")
                            }
                            .font(.subheadline)
                        }

                        HStack {
                            Text("Sets")
                                .foregroundStyle(LiftMarkTheme.secondaryLabel)
                            Spacer()
                            Text("\(session.setsCount)")
                        }
                        .font(.subheadline)

                        if session.avgReps > 0 {
                            HStack {
                                Text("Avg Reps")
                                    .foregroundStyle(LiftMarkTheme.secondaryLabel)
                                Spacer()
                                Text(String(format: "%.1f", session.avgReps))
                            }
                            .font(.subheadline)
                        }

                        if session.maxTime > 0 {
                            HStack {
                                Text("Max Time")
                                    .foregroundStyle(LiftMarkTheme.secondaryLabel)
                                Spacer()
                                Text("\(Int(session.maxTime))s")
                            }
                            .font(.subheadline)
                        }

                        if session.totalVolume > 0 {
                            HStack {
                                Text("Volume")
                                    .foregroundStyle(LiftMarkTheme.secondaryLabel)
                                Spacer()
                                Text(formatVolume(session.totalVolume))
                            }
                            .font(.subheadline)
                        }
                    }
                    .padding()
                    .background(LiftMarkTheme.secondaryBackground)
                    .clipShape(RoundedRectangle(cornerRadius: LiftMarkTheme.cornerRadiusMD))
                }
            } else {
                Text("No previous sessions")
                    .font(.subheadline)
                    .foregroundStyle(LiftMarkTheme.secondaryLabel)
                    .frame(maxWidth: .infinity, alignment: .center)
            }
        }
        .onAppear { loadHistory() }
    }

    private func loadHistory() {
        let repo = ExerciseHistoryRepository()
        do {
            historyPoints = try repo.getHistoryNormalized(forExercise: exerciseName)
        } catch {
            print("Failed to load exercise history: \(error)")
        }
        isLoading = false
    }

    private func formatDate(_ dateString: String) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        guard let date = formatter.date(from: String(dateString.prefix(10))) else {
            return dateString
        }
        let display = DateFormatter()
        display.dateStyle = .medium
        return display.string(from: date)
    }

    private func formatVolume(_ volume: Double) -> String {
        if volume >= 1000 {
            return String(format: "%.1fk", volume / 1000)
        }
        return "\(Int(volume))"
    }
}

