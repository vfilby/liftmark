import SwiftUI

// MARK: - Display Models

enum PlanDisplayItem: Identifiable {
    case single(exercise: PlannedExercise)
    case superset(parent: PlannedExercise, children: [PlannedExercise])

    var id: String {
        switch self {
        case .single(let exercise): return exercise.id
        case .superset(let parent, _): return parent.id
        }
    }
}

struct ExerciseDisplaySection {
    let name: String?
    let items: [PlanDisplayItem]
}

// MARK: - Section Color Helper

func workoutSectionColor(for name: String) -> Color {
    switch name.lowercased() {
    case "warmup", "warm-up", "warm up": return LiftMarkTheme.warmupAccent
    case "cooldown", "cool-down", "cool down": return LiftMarkTheme.cooldownAccent
    default: return LiftMarkTheme.primary
    }
}

// MARK: - Set Detail Formatting

func planSetDetailString(_ set: PlannedSet) -> String {
    var parts: [String] = []

    if let weight = set.targetWeight, let unit = set.targetWeightUnit {
        parts.append("\(planFormatWeight(weight)) \(unit.rawValue)")
    }

    if let reps = set.targetReps {
        let amrapSuffix = set.isAmrap ? "+" : ""
        parts.append("× \(reps)\(amrapSuffix) reps")
    } else if set.isAmrap {
        parts.append("AMRAP")
    }

    if let time = set.targetTime {
        parts.append(planFormatTime(time))
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

func planFormatWeight(_ w: Double) -> String {
    w.truncatingRemainder(dividingBy: 1) == 0 ? "\(Int(w))" : String(format: "%.1f", w)
}

func planFormatTime(_ seconds: Int) -> String {
    let m = seconds / 60
    let s = seconds % 60
    return m > 0 ? String(format: "%d:%02d", m, s) : "\(s)s"
}

// MARK: - Stat Card

struct WorkoutStatCard: View {
    let value: String
    let label: String

    var body: some View {
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
}

// MARK: - Section Header

struct WorkoutSectionHeader: View {
    let name: String

    var body: some View {
        HStack(spacing: LiftMarkTheme.spacingSM) {
            Rectangle()
                .fill(workoutSectionColor(for: name))
                .frame(height: 1)
            Text(name.uppercased())
                .font(.subheadline)
                .fontWeight(.semibold)
                .foregroundStyle(workoutSectionColor(for: name))
                .tracking(1)
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
                .layoutPriority(1)
            Rectangle()
                .fill(workoutSectionColor(for: name))
                .frame(height: 1)
        }
        .padding(.vertical, LiftMarkTheme.spacingSM)
    }
}

// MARK: - Exercise Card

struct PlanExerciseCard: View {
    let exercise: PlannedExercise
    let sectionName: String?
    let exerciseIndex: Int
    let supersetIndex: Int
    let onEdit: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: LiftMarkTheme.spacingMD) {
            // Exercise header
            HStack(alignment: .top, spacing: LiftMarkTheme.spacingMD) {
                // Numbered index
                Text("\(exerciseIndex)")
                    .font(.callout)
                    .fontWeight(.bold)
                    .foregroundStyle(workoutSectionColor(for: sectionName ?? ""))
                    .frame(minWidth: 20)

                VStack(alignment: .leading, spacing: 2) {
                    // Superset badge
                    if exercise.groupType == .superset {
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

                // Edit button
                Button {
                    onEdit()
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
                            .foregroundStyle(workoutSectionColor(for: sectionName ?? ""))
                            .frame(width: 28, height: 28)
                            .background(workoutSectionColor(for: sectionName ?? "").opacity(0.12))
                            .clipShape(Circle())

                        // Set details
                        Text(planSetDetailString(set))
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

            // YouTube search
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

    private func youtubeSearchURL(for exerciseName: String) -> URL? {
        let query = exerciseName.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? exerciseName
        return URL(string: "https://www.youtube.com/results?search_query=\(query)+form")
    }
}

// MARK: - Superset Card

struct PlanSupersetCard: View {
    let parent: PlannedExercise
    let children: [PlannedExercise]
    let sectionName: String?

    private var interleavedSets: [(exercise: PlannedExercise, set: PlannedSet, round: Int)] {
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

    var body: some View {
        let interleaved = interleavedSets

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
                            .foregroundStyle(workoutSectionColor(for: sectionName ?? ""))
                            .frame(width: 28, height: 28)
                            .background(workoutSectionColor(for: sectionName ?? "").opacity(0.12))
                            .clipShape(Circle())

                        VStack(alignment: .leading, spacing: 2) {
                            Text(item.exercise.exerciseName)
                                .font(.caption2)
                                .fontWeight(.semibold)
                                .foregroundStyle(LiftMarkTheme.secondaryLabel)

                            Text(planSetDetailString(item.set))
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
}
