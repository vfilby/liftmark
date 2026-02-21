import SwiftUI

/// Individual set row in the active workout view.
/// Handles display for pending, current, completed, and skipped states.
struct SetRowView: View {
    let set: SessionSet
    let setNumber: Int
    let isCurrent: Bool
    let equipmentType: String?
    let onComplete: () -> Void
    let onSkip: () -> Void
    let onEdit: () -> Void

    @State private var weightText: String = ""
    @State private var repsText: String = ""
    @State private var isEditing = false

    var body: some View {
        HStack(spacing: LiftMarkTheme.spacingSM) {
            // Set number indicator
            setIndicator

            if isCurrent {
                currentSetContent
            } else {
                completedOrPendingContent
            }
        }
        .padding(.vertical, LiftMarkTheme.spacingXS)
        .padding(.horizontal, LiftMarkTheme.spacingSM)
        .background(isCurrent ? LiftMarkTheme.primary.opacity(0.05) : Color.clear)
        .clipShape(RoundedRectangle(cornerRadius: LiftMarkTheme.cornerRadiusSM))
        .onAppear {
            if let w = set.targetWeight ?? set.actualWeight {
                weightText = formatWeight(w)
            }
            if let r = set.targetReps ?? set.actualReps {
                repsText = "\(r)"
            }
        }
    }

    // MARK: - Set Number Indicator

    @ViewBuilder
    private var setIndicator: some View {
        ZStack {
            switch set.status {
            case .completed:
                Image(systemName: "checkmark.circle.fill")
                    .foregroundStyle(LiftMarkTheme.success)
            case .skipped:
                Image(systemName: "minus.circle.fill")
                    .foregroundStyle(LiftMarkTheme.warning)
            case .failed:
                Image(systemName: "xmark.circle.fill")
                    .foregroundStyle(LiftMarkTheme.destructive)
            case .pending:
                if isCurrent {
                    Image(systemName: "arrow.right.circle.fill")
                        .foregroundStyle(LiftMarkTheme.primary)
                } else {
                    Text("\(setNumber)")
                        .font(.caption.bold())
                        .foregroundStyle(LiftMarkTheme.tertiaryLabel)
                }
            }
        }
        .frame(width: 28)
    }

    // MARK: - Current Set (Editable)

    @ViewBuilder
    private var currentSetContent: some View {
        HStack(spacing: LiftMarkTheme.spacingSM) {
            // Weight input
            VStack(alignment: .leading, spacing: 2) {
                Text("Weight")
                    .font(.caption2)
                    .foregroundStyle(LiftMarkTheme.secondaryLabel)
                TextField("--", text: $weightText)
                    #if os(iOS)
                    .keyboardType(.decimalPad)
                    #endif
                    .font(.body.monospacedDigit())
                    .textFieldStyle(.roundedBorder)
                    .frame(width: 80)
            }

            // Reps input
            if set.targetTime == nil {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Reps")
                        .font(.caption2)
                        .foregroundStyle(LiftMarkTheme.secondaryLabel)
                    TextField("--", text: $repsText)
                        #if os(iOS)
                        .keyboardType(.numberPad)
                        #endif
                        .font(.body.monospacedDigit())
                        .textFieldStyle(.roundedBorder)
                        .frame(width: 60)
                }
            }

            // Target hint
            if let target = targetHint {
                Text(target)
                    .font(.caption)
                    .foregroundStyle(LiftMarkTheme.tertiaryLabel)
            }

            Spacer()

            // Modifiers
            modifierBadges

            // Actions
            Button {
                onComplete()
            } label: {
                Image(systemName: "checkmark")
                    .font(.body.bold())
                    .foregroundStyle(.white)
                    .frame(width: 36, height: 36)
                    .background(LiftMarkTheme.success)
                    .clipShape(Circle())
            }
            .buttonStyle(.plain)

            Button {
                onSkip()
            } label: {
                Image(systemName: "forward.fill")
                    .font(.caption)
                    .foregroundStyle(LiftMarkTheme.secondaryLabel)
            }
            .buttonStyle(.plain)
        }
    }

    // MARK: - Completed / Pending Set

    @ViewBuilder
    private var completedOrPendingContent: some View {
        Button {
            onEdit()
        } label: {
            HStack(spacing: LiftMarkTheme.spacingSM) {
                if set.status == .completed {
                    if let w = set.actualWeight, let u = set.actualWeightUnit {
                        Text("\(formatWeight(w)) \(u.rawValue)")
                            .font(.subheadline.monospacedDigit())
                    }
                    if let r = set.actualReps {
                        Text("x \(r)")
                            .font(.subheadline.monospacedDigit())
                    }
                    if let t = set.actualTime {
                        Text(formatTime(t))
                            .font(.subheadline.monospacedDigit())
                    }
                } else if set.status == .skipped {
                    Text("Skipped")
                        .font(.subheadline)
                        .foregroundStyle(LiftMarkTheme.warning)
                } else {
                    // Pending - show targets
                    if let w = set.targetWeight, let u = set.targetWeightUnit {
                        Text("\(formatWeight(w)) \(u.rawValue)")
                            .font(.subheadline.monospacedDigit())
                            .foregroundStyle(LiftMarkTheme.tertiaryLabel)
                    }
                    if let r = set.targetReps {
                        Text("x \(r)")
                            .font(.subheadline.monospacedDigit())
                            .foregroundStyle(LiftMarkTheme.tertiaryLabel)
                    }
                    if let t = set.targetTime {
                        Text(formatTime(t))
                            .font(.subheadline.monospacedDigit())
                            .foregroundStyle(LiftMarkTheme.tertiaryLabel)
                    }
                }

                Spacer()

                modifierBadges
            }
        }
        .buttonStyle(.plain)
    }

    // MARK: - Modifier Badges

    @ViewBuilder
    private var modifierBadges: some View {
        HStack(spacing: 4) {
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
        }
    }

    // MARK: - Helpers

    private var targetHint: String? {
        guard let w = set.targetWeight, let r = set.targetReps else { return nil }
        let unit = set.targetWeightUnit?.rawValue ?? ""
        return "Target: \(formatWeight(w)) \(unit) x \(r)"
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
