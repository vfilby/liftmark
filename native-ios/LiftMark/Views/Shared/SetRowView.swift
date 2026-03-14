import SwiftUI

/// Custom alignment to vertically center the indicator and skip button on the text fields.
extension VerticalAlignment {
    private enum TextFieldCenter: AlignmentID {
        static func defaultValue(in context: ViewDimensions) -> CGFloat {
            context[VerticalAlignment.center]
        }
    }
    static let textFieldCenter = VerticalAlignment(TextFieldCenter.self)
}

/// Individual set row in the active workout view.
/// Handles display for pending, current, completed, and skipped states.
struct SetRowView: View {
    let set: SessionSet
    let setNumber: Int
    let isCurrent: Bool
    let exerciseName: String
    let equipmentType: String?
    let onComplete: (Double?, Int?, Int?) -> Void
    let onSkip: () -> Void
    let onSave: (Double?, Int?, Int?) -> Void
    var onWeightChanged: ((String) -> Void)? = nil

    @State private var weightText: String = ""
    @State private var repsText: String = ""
    @State private var timeText: String = ""
    @State private var isEditing = false

    var body: some View {
        Group {
            if isCurrent {
                currentSetContent
            } else {
                HStack(spacing: LiftMarkTheme.spacingSM) {
                    // Set number indicator
                    setIndicator
                    completedOrPendingContent
                }
            }
        }
        .padding(.vertical, LiftMarkTheme.spacingXS)
        .padding(.horizontal, LiftMarkTheme.spacingSM)
        .background(isCurrent ? LiftMarkTheme.primary.opacity(0.05) : Color.clear)
        .clipShape(RoundedRectangle(cornerRadius: LiftMarkTheme.cornerRadiusSM))
        .onAppear {
            if let w = set.targetWeight ?? set.actualWeight {
                weightText = formatWeight(w)
                onWeightChanged?(weightText)
            }
            if let r = set.targetReps ?? set.actualReps {
                repsText = "\(r)"
            }
            if let t = set.targetTime ?? set.actualTime {
                timeText = "\(t)"
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
                    .font(.title3)
            case .skipped:
                Image(systemName: "minus.circle.fill")
                    .foregroundStyle(LiftMarkTheme.warning)
                    .font(.title3)
            case .failed:
                Image(systemName: "xmark.circle.fill")
                    .foregroundStyle(LiftMarkTheme.destructive)
                    .font(.title3)
            case .pending:
                if isCurrent {
                    Image(systemName: "arrow.right.circle.fill")
                        .foregroundStyle(LiftMarkTheme.primary)
                        .font(.title3)
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
        VStack(spacing: LiftMarkTheme.spacingSM) {
            // Plate math info — barbell exercises only (above weight × reps)
            if let plateMathText = plateMathText {
                HStack(spacing: 6) {
                    Image(systemName: "scalemass")
                        .font(.caption)
                    Text(plateMathText)
                        .font(.callout)
                }
                .foregroundStyle(Color.blue)
                .padding(.horizontal, 10)
                .padding(.vertical, 6)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color.blue.opacity(0.08))
                .overlay(
                    Rectangle()
                        .frame(width: 3)
                        .foregroundStyle(Color.blue.opacity(0.4)),
                    alignment: .leading
                )
                .clipShape(RoundedRectangle(cornerRadius: 6))
            }

            // Top row: indicator + inputs + skip
            HStack(alignment: .textFieldCenter, spacing: LiftMarkTheme.spacingSM) {
                setIndicator
                    .alignmentGuide(.textFieldCenter) { d in d[VerticalAlignment.center] }

                // Side label for per-side sets (Left/Right)
                if let side = set.side {
                    Text(side.capitalized)
                        .font(.caption2)
                        .fontWeight(.semibold)
                        .foregroundStyle(LiftMarkTheme.primary)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(LiftMarkTheme.primary.opacity(0.1))
                        .clipShape(RoundedRectangle(cornerRadius: 4))
                        .alignmentGuide(.textFieldCenter) { d in d[VerticalAlignment.center] }
                }

                // Weight input — only for weighted exercises (not bodyweight/timed)
                if set.targetWeight != nil {
                    VStack(alignment: .center, spacing: 2) {
                        Text("Weight\(weightUnitLabel)")
                            .font(.caption2)
                            .foregroundStyle(LiftMarkTheme.secondaryLabel)
                        TextField("--", text: $weightText)
                            #if os(iOS)
                            .keyboardType(.decimalPad)
                            #endif
                            .font(.title3.monospacedDigit())
                            .multilineTextAlignment(.center)
                            .textFieldStyle(.roundedBorder)
                            .frame(width: 90)
                            .alignmentGuide(.textFieldCenter) { d in d[VerticalAlignment.center] }
                            .onChange(of: weightText) { _, newValue in
                                onWeightChanged?(newValue)
                            }
                    }

                    // Show × separator only when reps follow (not for weighted-timed sets)
                    if set.targetTime == nil {
                        Text("×")
                            .font(.callout)
                            .foregroundStyle(LiftMarkTheme.secondaryLabel)
                            .alignmentGuide(.textFieldCenter) { d in d[VerticalAlignment.center] }
                    }
                }

                // Time input — for all timed exercises (including weighted-timed)
                if set.targetTime != nil {
                    VStack(alignment: .center, spacing: 2) {
                        Text("Time (s)")
                            .font(.caption2)
                            .foregroundStyle(LiftMarkTheme.secondaryLabel)
                        TextField("--", text: $timeText)
                            #if os(iOS)
                            .keyboardType(.numberPad)
                            #endif
                            .font(.title3.monospacedDigit())
                            .multilineTextAlignment(.center)
                            .textFieldStyle(.roundedBorder)
                            .frame(width: 70)
                            .alignmentGuide(.textFieldCenter) { d in d[VerticalAlignment.center] }
                    }
                }

                // Reps input — only for non-timed exercises
                if set.targetTime == nil {
                    VStack(alignment: .center, spacing: 2) {
                        Text("Reps")
                            .font(.caption2)
                            .foregroundStyle(LiftMarkTheme.secondaryLabel)
                        TextField("--", text: $repsText)
                            #if os(iOS)
                            .keyboardType(.numberPad)
                            #endif
                            .font(.title3.monospacedDigit())
                            .multilineTextAlignment(.center)
                            .textFieldStyle(.roundedBorder)
                            .frame(width: 70)
                            .alignmentGuide(.textFieldCenter) { d in d[VerticalAlignment.center] }
                    }
                }

                Spacer()

                // Skip button
                Button {
                    onSkip()
                } label: {
                    Image(systemName: "forward.fill")
                        .font(.body)
                        .foregroundStyle(LiftMarkTheme.warning)
                        .frame(width: 44, height: 44)
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("set-skip-button")
                .alignmentGuide(.textFieldCenter) { d in d[VerticalAlignment.center] }
            }

            // Middle row: target hint — only when values differ from target
            if let target = targetHint, valuesChangedFromTarget {
                Text(target)
                    .font(.caption)
                    .foregroundStyle(LiftMarkTheme.tertiaryLabel)
            }

            // Bottom row: complete button — hide for timed sets (completed via ExerciseTimerView Done)
            if set.targetTime == nil {
                Button {
                    onComplete(Double(weightText), Int(repsText), Int(timeText))
                } label: {
                    HStack {
                        Image(systemName: "checkmark")
                            .font(.body.bold())
                        Text("Complete Set")
                            .font(.subheadline.bold())
                    }
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity, minHeight: 44)
                    .background(LiftMarkTheme.success)
                    .clipShape(RoundedRectangle(cornerRadius: LiftMarkTheme.cornerRadiusSM))
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("set-complete-button")
            }
        }
    }

    // MARK: - Completed / Pending Set

    @ViewBuilder
    private var completedOrPendingContent: some View {
        if isEditing && (set.status == .completed || set.status == .skipped) {
            // Inline edit form
            inlineEditContent
        } else {
            Button {
                if set.status == .completed || set.status == .skipped {
                    isEditing.toggle()
                    // Initialize edit fields with current values
                    if let w = set.actualWeight ?? set.targetWeight {
                        weightText = formatWeight(w)
                    }
                    if let r = set.actualReps ?? set.targetReps {
                        repsText = "\(r)"
                    }
                    if let t = set.actualTime ?? set.targetTime {
                        timeText = "\(t)"
                    }
                }
            } label: {
                HStack(spacing: LiftMarkTheme.spacingSM) {
                    if set.status == .completed {
                        if let w = set.actualWeight, let u = set.actualWeightUnit {
                            Text("\(formatWeight(w)) \(u.rawValue)")
                                .font(.subheadline.monospacedDigit())
                                .foregroundStyle(LiftMarkTheme.success)
                        }
                        if let r = set.actualReps {
                            Text("× \(r)")
                                .font(.subheadline.monospacedDigit())
                                .foregroundStyle(LiftMarkTheme.success)
                        }
                        if let t = set.actualTime {
                            Text(formatTime(t))
                                .font(.subheadline.monospacedDigit())
                                .foregroundStyle(LiftMarkTheme.success)
                        }
                    } else if set.status == .skipped {
                        // Show target values + "— Skipped"
                        if let w = set.targetWeight, let u = set.targetWeightUnit {
                            Text("\(formatWeight(w)) \(u.rawValue)")
                                .font(.subheadline.monospacedDigit())
                                .foregroundStyle(LiftMarkTheme.warning)
                        }
                        if let r = set.targetReps {
                            Text("× \(r)")
                                .font(.subheadline.monospacedDigit())
                                .foregroundStyle(LiftMarkTheme.warning)
                        }
                        Text("— Skipped")
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
                            Text("× \(r)")
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
    }

    // MARK: - Inline Edit (completed/skipped sets)

    @ViewBuilder
    private var inlineEditContent: some View {
        HStack(alignment: .textFieldCenter, spacing: LiftMarkTheme.spacingSM) {
            if set.actualWeight != nil || set.targetWeight != nil {
                VStack(alignment: .center, spacing: 2) {
                    Text("Weight\(weightUnitLabel)")
                        .font(.caption2)
                        .foregroundStyle(LiftMarkTheme.secondaryLabel)
                    TextField("--", text: $weightText)
                        #if os(iOS)
                        .keyboardType(.decimalPad)
                        #endif
                        .font(.body.monospacedDigit())
                        .multilineTextAlignment(.center)
                        .textFieldStyle(.roundedBorder)
                        .frame(width: 80)
                        .alignmentGuide(.textFieldCenter) { d in d[VerticalAlignment.center] }
                }

                // Show × separator only for non-timed sets (weighted reps)
                if set.targetTime == nil {
                    Text("×")
                        .font(.caption)
                        .foregroundStyle(LiftMarkTheme.secondaryLabel)
                        .alignmentGuide(.textFieldCenter) { d in d[VerticalAlignment.center] }
                }
            }

            // Reps field — only for non-timed sets
            if set.targetTime == nil {
                VStack(alignment: .center, spacing: 2) {
                    Text("Reps")
                        .font(.caption2)
                        .foregroundStyle(LiftMarkTheme.secondaryLabel)
                    TextField("--", text: $repsText)
                        #if os(iOS)
                        .keyboardType(.numberPad)
                        #endif
                        .font(.body.monospacedDigit())
                        .multilineTextAlignment(.center)
                        .textFieldStyle(.roundedBorder)
                        .frame(width: 60)
                        .alignmentGuide(.textFieldCenter) { d in d[VerticalAlignment.center] }
                }
            }

            // Time input — editable for timed sets in inline edit
            if set.actualTime != nil || set.targetTime != nil {
                VStack(alignment: .center, spacing: 2) {
                    Text("Time (s)")
                        .font(.caption2)
                        .foregroundStyle(LiftMarkTheme.secondaryLabel)
                    TextField("--", text: $timeText)
                        #if os(iOS)
                        .keyboardType(.numberPad)
                        #endif
                        .font(.body.monospacedDigit())
                        .multilineTextAlignment(.center)
                        .textFieldStyle(.roundedBorder)
                        .frame(width: 60)
                        .alignmentGuide(.textFieldCenter) { d in d[VerticalAlignment.center] }
                }
            }

            Spacer()

            // Update button
            Button {
                onSave(Double(weightText), Int(repsText), Int(timeText))
                isEditing = false
            } label: {
                Image(systemName: "checkmark")
                    .font(.body.bold())
                    .foregroundStyle(.white)
                    .frame(width: 36, height: 36)
                    .background(LiftMarkTheme.primary)
                    .clipShape(RoundedRectangle(cornerRadius: LiftMarkTheme.cornerRadiusSM))
            }
            .buttonStyle(.plain)
            .alignmentGuide(.textFieldCenter) { d in d[VerticalAlignment.center] }

            // Cancel button
            Button {
                isEditing = false
            } label: {
                Image(systemName: "xmark")
                    .font(.caption)
                    .foregroundStyle(LiftMarkTheme.secondaryLabel)
                    .frame(width: 36, height: 36)
                    .overlay(
                        RoundedRectangle(cornerRadius: LiftMarkTheme.cornerRadiusSM)
                            .stroke(LiftMarkTheme.tertiaryLabel, lineWidth: 1)
                    )
            }
            .buttonStyle(.plain)
            .alignmentGuide(.textFieldCenter) { d in d[VerticalAlignment.center] }
        }
    }

    // MARK: - Modifier Badges

    @ViewBuilder
    private var modifierBadges: some View {
        HStack(spacing: 4) {
            if set.isDropset {
                Text("Drop")
                    .font(.caption2)
                    .fontWeight(.semibold)
                    .foregroundStyle(LiftMarkTheme.destructive)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 1)
                    .background(LiftMarkTheme.destructive.opacity(0.1))
                    .clipShape(RoundedRectangle(cornerRadius: 4))
            }
            if set.isPerSide {
                if let side = set.side {
                    Text(side.capitalized)
                        .font(.caption2)
                        .fontWeight(.semibold)
                        .foregroundStyle(LiftMarkTheme.primary)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 1)
                        .background(LiftMarkTheme.primary.opacity(0.1))
                        .clipShape(RoundedRectangle(cornerRadius: 4))
                } else {
                    Text("/side")
                        .font(.caption2)
                        .fontWeight(.semibold)
                        .foregroundStyle(LiftMarkTheme.primary)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 1)
                        .background(LiftMarkTheme.primary.opacity(0.1))
                        .clipShape(RoundedRectangle(cornerRadius: 4))
                }
            }
        }
    }

    // MARK: - Helpers

    /// Plate math text for barbell exercises, computed from current weight input.
    private var plateMathText: String? {
        guard set.targetWeight != nil,
              PlateCalculator.isBarbellExercise(exerciseName: exerciseName, equipmentType: equipmentType)
        else { return nil }

        guard let weight = Double(weightText), weight > 0 else { return nil }

        let unit = set.targetWeightUnit?.rawValue ?? "lbs"
        let breakdown = PlateCalculator.calculatePlates(totalWeight: weight, unit: unit)

        // Don't show if weight is less than bar
        guard breakdown.isAchievable || !breakdown.plates.isEmpty else { return nil }

        return PlateCalculator.formatCompletePlateSetup(breakdown)
    }

    private var weightUnitLabel: String {
        if let unit = set.targetWeightUnit ?? set.actualWeightUnit {
            return " (\(unit.rawValue))"
        }
        return ""
    }

    private var valuesChangedFromTarget: Bool {
        if let tw = set.targetWeight {
            if Double(weightText) != tw { return true }
        }
        if let tr = set.targetReps {
            if Int(repsText) != tr { return true }
        }
        return false
    }

    private var targetHint: String? {
        var parts: [String] = []
        if let w = set.targetWeight {
            let unit = set.targetWeightUnit?.rawValue ?? ""
            parts.append("\(formatWeight(w)) \(unit)")
        }
        if let r = set.targetReps {
            parts.append("× \(r)")
        }
        guard !parts.isEmpty else { return nil }
        return "Target: \(parts.joined(separator: " "))"
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
