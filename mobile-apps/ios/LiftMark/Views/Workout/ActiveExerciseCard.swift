import SwiftUI

struct ActiveExerciseCard: View {
    let exercise: SessionExercise
    let exerciseIndex: Int
    let displayNumber: Int
    let settings: UserSettings?
    let isCollapsed: Bool
    let activeRestTimer: RestTimerState?
    let onToggleCollapse: () -> Void
    let onCompleteSet: (Int, Double?, Int?, Int?) -> Void
    let onCompleteDropSet: ((Int, [(weight: Double?, weightUnit: WeightUnit?, reps: Int?)]) -> Void)?
    let onSkipSet: (Int) -> Void
    let onEditExercise: () -> Void
    let onSaveSet: (Int, Double?, Int?, Int?) -> Void
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
            // Exercise header
            HStack(spacing: LiftMarkTheme.spacingSM) {
                // Collapse toggle — covers number + name + spacer
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
                        }
                    }
                    .contentShape(Rectangle())
                    .padding(.vertical, 4)
                }
                .buttonStyle(.plain)
                .accessibilityLabel(isCollapsed ? "Expand \(exercise.exerciseName), \(completedSetCount) of \(exercise.sets.count) sets done" : "Collapse \(exercise.exerciseName)")
                .accessibilityHint(isCollapsed ? "Shows all sets for this exercise" : "Hides sets for this exercise")

                // Edit button — separate from collapse toggle for reliable tap handling
                if !isCollapsed {
                    Button {
                        onEditExercise()
                    } label: {
                        Image(systemName: "pencil")
                            .font(.body)
                            .foregroundStyle(LiftMarkTheme.secondaryLabel)
                            .frame(width: 36, height: 36)
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("edit-exercise-button-\(exerciseIndex)")
                    .accessibilityLabel("Edit \(exercise.exerciseName)")
                    .accessibilityHint("Opens editor for exercise name, notes, and sets")
                }
            }

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
                        onComplete: { weight, reps, time in
                            onCompleteSet(setIndex, weight, reps, time)
                        },
                        onCompleteDropSet: set.isDropset ? { entries in
                            onCompleteDropSet?(setIndex, entries)
                        } : nil,
                        onSkip: { onSkipSet(setIndex) },
                        onSave: { weight, reps, time in
                            onSaveSet(setIndex, weight, reps, time)
                        },
                        onWeightChanged: setIndex == currentSetIndex ? { newWeight in
                            currentWeightText = newWeight
                        } : nil
                    )

                    // Timed exercise timer — inline after the current set
                    if setIndex == currentSetIndex,
                       let targetTime = set.entries.first?.target?.time, targetTime > 0 {
                        ExerciseTimerView(targetSeconds: targetTime) { elapsedSeconds in
                            let weight = Double(currentWeightText)
                            onCompleteSet(setIndex, weight, nil, elapsedSeconds)
                        }
                        .id(set.id)
                    }

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
                                .accessibilityHidden(true)
                            Text("Rest \(rest)s")
                                .font(.caption2)
                                .foregroundStyle(LiftMarkTheme.tertiaryLabel)
                            Rectangle()
                                .fill(LiftMarkTheme.tertiaryLabel.opacity(0.3))
                                .frame(height: 1)
                                .accessibilityHidden(true)
                        }
                        .padding(.vertical, 2)
                        .accessibilityElement(children: .combine)
                        .accessibilityLabel("Rest \(rest) seconds between sets")
                    }
                }

                // YouTube search — bottom of expanded card
                if let url = youtubeSearchURL(for: exercise.exerciseName) {
                    Divider()
                    Link(destination: url) {
                        HStack(spacing: LiftMarkTheme.spacingSM) {
                            Image(systemName: "play.rectangle")
                                .font(.caption)
                                .accessibilityHidden(true)
                            Text("Search \"\(exercise.exerciseName)\" on YouTube")
                                .font(.caption)
                        }
                        .foregroundStyle(LiftMarkTheme.secondaryLabel)
                        .frame(maxWidth: .infinity, alignment: .center)
                    }
                    .accessibilityIdentifier("youtube-link-\(exercise.exerciseName)")
                    .accessibilityLabel("Search \(exercise.exerciseName) form videos on YouTube")
                    .accessibilityHint("Opens YouTube in your browser")
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
