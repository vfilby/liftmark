import SwiftUI

struct ActiveWorkoutView: View {
    @Environment(SessionStore.self) private var sessionStore
    @Environment(SettingsStore.self) private var settingsStore
    @Environment(\.dismiss) private var dismiss

    @State private var showAddExercise = false
    @State private var showEditExercise = false
    @State private var editingExercise: SessionExercise?
    @State private var addExerciseMarkdown = ""
    @State private var activeRestTimer: RestTimerState?
    @State private var showFinishConfirm = false
    @State private var showEditSet = false
    @State private var editingSetInfo: (exerciseIndex: Int, setIndex: Int)?

    private var session: WorkoutSession? { sessionStore.activeSession }

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

    var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack(spacing: LiftMarkTheme.spacingSM) {
                Button {
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
                    showFinishConfirm = true
                } label: {
                    Text("Finish")
                        .font(.subheadline.bold())
                }
                .accessibilityIdentifier("active-workout-finish-button")
            }
            .padding()
            .background(LiftMarkTheme.background)
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

            // Active rest timer
            if let restState = activeRestTimer {
                RestTimerView(totalSeconds: restState.seconds) {
                    activeRestTimer = nil
                }
                .padding(.horizontal)
                .padding(.vertical, LiftMarkTheme.spacingXS)
            }

            // Workout content
            ScrollView {
                VStack(alignment: .leading, spacing: LiftMarkTheme.spacingMD) {
                    if let exercises = session?.exercises {
                        ForEach(Array(exercises.enumerated()), id: \.element.id) { exerciseIndex, exercise in
                            ActiveExerciseCard(
                                exercise: exercise,
                                exerciseIndex: exerciseIndex,
                                settings: settingsStore.settings,
                                onCompleteSet: { setIndex in
                                    completeSet(exerciseIndex: exerciseIndex, setIndex: setIndex)
                                },
                                onSkipSet: { setIndex in
                                    skipSet(exerciseIndex: exerciseIndex, setIndex: setIndex)
                                },
                                onEditExercise: {
                                    editingExercise = exercise
                                    showEditExercise = true
                                },
                                onEditSet: { setIndex in
                                    editingSetInfo = (exerciseIndex: exerciseIndex, setIndex: setIndex)
                                    showEditSet = true
                                }
                            )
                        }
                    }
                }
                .padding()
            }
            .accessibilityIdentifier("active-workout-scroll")
        }
        .accessibilityIdentifier("active-workout-screen")
        #if os(iOS)
        .toolbar(.hidden, for: .navigationBar)
        #endif
        .onAppear {
            if settingsStore.settings?.keepScreenAwake == true {
                #if canImport(UIKit)
                UIApplication.shared.isIdleTimerDisabled = true
                #endif
            }
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
        .sheet(isPresented: $showEditExercise) {
            if let exercise = editingExercise {
                EditExerciseSheet(exercise: exercise, onSave: { name, notes, equipmentType in
                    sessionStore.updateExercise(exerciseId: exercise.id, name: name, notes: notes, equipmentType: equipmentType)
                    showEditExercise = false
                })
            }
        }
        .alert("Finish Workout?", isPresented: $showFinishConfirm) {
            Button("Cancel", role: .cancel) {}
            Button("Finish") {
                sessionStore.completeSession()
            }
        } message: {
            let skipped = totalSets - completedSets
            if skipped > 0 {
                Text("You have \(skipped) incomplete sets. They will be marked as skipped.")
            } else {
                Text("Great job completing all your sets!")
            }
        }
        .sheet(isPresented: $showEditSet) {
            if let info = editingSetInfo,
               let session,
               info.exerciseIndex < session.exercises.count,
               info.setIndex < session.exercises[info.exerciseIndex].sets.count {
                let set = session.exercises[info.exerciseIndex].sets[info.setIndex]
                EditSetSheet(set: set) { weight, reps, status in
                    if status == .completed {
                        sessionStore.completeSet(
                            setId: set.id,
                            actualWeight: weight,
                            actualWeightUnit: set.actualWeightUnit ?? set.targetWeightUnit,
                            actualReps: reps,
                            actualTime: set.actualTime ?? set.targetTime,
                            actualRpe: set.actualRpe ?? set.targetRpe
                        )
                    } else if status == .pending {
                        // Reset to pending by updating targets
                        sessionStore.updateSetTarget(
                            setId: set.id,
                            targetWeight: weight,
                            targetReps: reps,
                            targetTime: set.targetTime
                        )
                    }
                    showEditSet = false
                }
            }
        }
    }

    // MARK: - Actions

    private func completeSet(exerciseIndex: Int, setIndex: Int) {
        guard let session, exerciseIndex < session.exercises.count else { return }
        let exercise = session.exercises[exerciseIndex]
        guard setIndex < exercise.sets.count else { return }
        let set = exercise.sets[setIndex]

        // Persist with actual values (use targets as defaults if user didn't edit)
        sessionStore.completeSet(
            setId: set.id,
            actualWeight: set.actualWeight ?? set.targetWeight,
            actualWeightUnit: set.actualWeightUnit ?? set.targetWeightUnit,
            actualReps: set.actualReps ?? set.targetReps,
            actualTime: set.actualTime ?? set.targetTime,
            actualRpe: set.actualRpe ?? set.targetRpe
        )

        // Trigger rest timer if applicable
        if let rest = set.restSeconds, rest > 0,
           settingsStore.settings?.autoStartRestTimer == true {
            activeRestTimer = RestTimerState(seconds: rest)
        }
    }

    private func skipSet(exerciseIndex: Int, setIndex: Int) {
        guard let session, exerciseIndex < session.exercises.count else { return }
        let exercise = session.exercises[exerciseIndex]
        guard setIndex < exercise.sets.count else { return }
        sessionStore.skipSet(setId: exercise.sets[setIndex].id)
    }

    private func addExerciseFromMarkdown(_ markdown: String) {
        let result = MarkdownParser.parseWorkout(markdown)
        guard let plan = result.data, let firstExercise = plan.exercises.first else { return }
        let sets = firstExercise.sets.map { set in
            (weight: set.targetWeight, unit: set.targetWeightUnit, reps: set.targetReps, time: set.targetTime)
        }
        sessionStore.addExercise(exerciseName: firstExercise.exerciseName, sets: sets)
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
    let settings: UserSettings?
    let onCompleteSet: (Int) -> Void
    let onSkipSet: (Int) -> Void
    let onEditExercise: () -> Void
    let onEditSet: (Int) -> Void

    private var currentSetIndex: Int? {
        exercise.sets.firstIndex { $0.status == .pending }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: LiftMarkTheme.spacingSM) {
            // Exercise header
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: LiftMarkTheme.spacingXS) {
                        Text("\(exerciseIndex + 1)")
                            .font(.caption.bold())
                            .foregroundStyle(.white)
                            .frame(width: 22, height: 22)
                            .background(exerciseStatusColor)
                            .clipShape(Circle())

                        Text(exercise.exerciseName)
                            .font(.headline)
                    }

                    if let equipment = exercise.equipmentType {
                        Text(equipment)
                            .font(.caption)
                            .foregroundStyle(LiftMarkTheme.secondaryLabel)
                    }
                }

                Spacer()

                // Edit button
                Button {
                    onEditExercise()
                } label: {
                    Image(systemName: "pencil")
                        .font(.caption)
                        .foregroundStyle(LiftMarkTheme.secondaryLabel)
                }
                .buttonStyle(.plain)

                // YouTube link
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
            ForEach(Array(exercise.sets.enumerated()), id: \.element.id) { setIndex, set in
                SetRowView(
                    set: set,
                    setNumber: setIndex + 1,
                    isCurrent: setIndex == currentSetIndex,
                    equipmentType: exercise.equipmentType,
                    onComplete: { onCompleteSet(setIndex) },
                    onSkip: { onSkipSet(setIndex) },
                    onEdit: { onEditSet(setIndex) }
                )
            }

            // Timed exercise timer
            if let currentIdx = currentSetIndex {
                let currentSet = exercise.sets[currentIdx]
                if let targetTime = currentSet.targetTime, targetTime > 0 {
                    ExerciseTimerView(targetSeconds: targetTime) {
                        onCompleteSet(currentIdx)
                    }
                }
            }
        }
        .padding()
        .background(LiftMarkTheme.secondaryBackground)
        .clipShape(RoundedRectangle(cornerRadius: LiftMarkTheme.cornerRadiusMD))
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

// MARK: - Edit Exercise Sheet

private struct EditExerciseSheet: View {
    let exercise: SessionExercise
    let onSave: (String, String?, String?) -> Void
    @State private var name: String
    @State private var equipmentType: String
    @State private var notes: String
    @Environment(\.dismiss) private var dismiss

    init(exercise: SessionExercise, onSave: @escaping (String, String?, String?) -> Void) {
        self.exercise = exercise
        self.onSave = onSave
        self._name = State(initialValue: exercise.exerciseName)
        self._equipmentType = State(initialValue: exercise.equipmentType ?? "")
        self._notes = State(initialValue: exercise.notes ?? "")
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Exercise") {
                    TextField("Name", text: $name)
                    TextField("Equipment Type", text: $equipmentType)
                }

                Section("Notes") {
                    TextEditor(text: $notes)
                        .frame(minHeight: 60)
                }

                Section("Sets") {
                    ForEach(exercise.sets) { set in
                        HStack {
                            Text("Set \(set.orderIndex + 1)")
                            Spacer()
                            if let w = set.targetWeight {
                                Text("\(Int(w)) \(set.targetWeightUnit?.rawValue ?? "")")
                            }
                            if let r = set.targetReps {
                                Text("x \(r)")
                            }
                            Text(set.status.rawValue)
                                .font(.caption)
                                .foregroundStyle(LiftMarkTheme.secondaryLabel)
                        }
                    }
                }
            }
            .navigationTitle("Edit Exercise")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        onSave(
                            name,
                            notes.isEmpty ? nil : notes,
                            equipmentType.isEmpty ? nil : equipmentType
                        )
                        dismiss()
                    }
                }
            }
        }
    }
}

// MARK: - Edit Set Sheet

private struct EditSetSheet: View {
    let set: SessionSet
    let onSave: (Double?, Int?, SetStatus) -> Void
    @State private var weightText: String
    @State private var repsText: String
    @Environment(\.dismiss) private var dismiss

    init(set: SessionSet, onSave: @escaping (Double?, Int?, SetStatus) -> Void) {
        self.set = set
        self.onSave = onSave
        self._weightText = State(initialValue: {
            if let w = set.actualWeight ?? set.targetWeight {
                return w.truncatingRemainder(dividingBy: 1) == 0 ? "\(Int(w))" : String(format: "%.1f", w)
            }
            return ""
        }())
        self._repsText = State(initialValue: {
            if let r = set.actualReps ?? set.targetReps {
                return "\(r)"
            }
            return ""
        }())
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Set Values") {
                    HStack {
                        Text("Weight")
                        Spacer()
                        TextField("--", text: $weightText)
                            #if os(iOS)
                            .keyboardType(.decimalPad)
                            #endif
                            .multilineTextAlignment(.trailing)
                            .frame(width: 100)
                        Text(set.actualWeightUnit?.rawValue ?? set.targetWeightUnit?.rawValue ?? "lbs")
                            .foregroundStyle(LiftMarkTheme.secondaryLabel)
                    }
                    HStack {
                        Text("Reps")
                        Spacer()
                        TextField("--", text: $repsText)
                            #if os(iOS)
                            .keyboardType(.numberPad)
                            #endif
                            .multilineTextAlignment(.trailing)
                            .frame(width: 100)
                    }
                }

                Section("Status") {
                    Text(set.status.rawValue.capitalized)
                        .foregroundStyle(LiftMarkTheme.secondaryLabel)
                }
            }
            .navigationTitle("Edit Set")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        let weight = Double(weightText)
                        let reps = Int(repsText)
                        onSave(weight, reps, set.status)
                        dismiss()
                    }
                }
            }
        }
    }
}
