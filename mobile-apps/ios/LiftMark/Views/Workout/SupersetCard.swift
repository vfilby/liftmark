import SwiftUI

struct SupersetCard: View {
    let parentExercise: SessionExercise
    let children: [(exercise: SessionExercise, exerciseIndex: Int, displayNumber: Int)]
    let settings: UserSettings?
    let isCollapsed: Bool
    let activeRestTimer: RestTimerState?
    let onToggleCollapse: () -> Void
    let onCompleteSet: (Int, Int, Double?, Int?, Int?) -> Void  // exerciseIndex, setIndex, weight, reps, time
    let onSkipSet: (Int, Int) -> Void  // exerciseIndex, setIndex
    let onSaveSet: (Int, Int, Double?, Int?, Int?) -> Void  // exerciseIndex, setIndex, weight, reps, time
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
                        onComplete: { weight, reps, time in
                            onCompleteSet(item.exerciseIndex, item.setIndex, weight, reps, time)
                        },
                        onSkip: { onSkipSet(item.exerciseIndex, item.setIndex) },
                        onSave: { weight, reps, time in
                            onSaveSet(item.exerciseIndex, item.setIndex, weight, reps, time)
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
