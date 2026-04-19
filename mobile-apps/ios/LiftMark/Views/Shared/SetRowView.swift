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
    var onCompleteDropSet: ((_ entries: [(weight: Double?, weightUnit: WeightUnit?, reps: Int?)]) -> Void)? = nil
    let onSkip: () -> Void
    let onSave: (Double?, Int?, Int?) -> Void
    var onWeightChanged: ((String) -> Void)? = nil

    @State private var weightText: String = ""
    @State private var repsText: String = ""
    @State private var timeText: String = ""
    @State private var isEditing = false
    /// Additional drop entries (groupIndex > 0). Each pair is (weight, reps) text.
    @State private var dropEntries: [(weight: String, reps: String)] = []

    var body: some View {
        Group {
            if isCurrent {
                currentSetContent
            } else {
                HStack(spacing: LiftMarkTheme.spacingSM) {
                    // Set number indicator
                    setIndicator

                    // Side label for per-side sets (Left/Right) — between indicator and data
                    if let side = set.side {
                        Text(side.capitalized)
                            .font(.caption2)
                            .fontWeight(.semibold)
                            .foregroundStyle(LiftMarkTheme.primary)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(LiftMarkTheme.primary.opacity(0.1))
                            .clipShape(RoundedRectangle(cornerRadius: 4))
                    }

                    completedOrPendingContent
                }
            }
        }
        .padding(.vertical, LiftMarkTheme.spacingXS)
        .padding(.horizontal, LiftMarkTheme.spacingSM)
        .background(isCurrent ? LiftMarkTheme.primary.opacity(0.05) : Color.clear)
        .clipShape(RoundedRectangle(cornerRadius: LiftMarkTheme.cornerRadiusSM))
        .onAppear {
            let target = set.entries.first?.target
            let actual = set.entries.first?.actual
            if let w = target?.weight?.value ?? actual?.weight?.value {
                weightText = formatWeight(w)
                onWeightChanged?(weightText)
            }
            if let r = target?.reps ?? actual?.reps {
                repsText = "\(r)"
            }
            if let t = target?.time ?? actual?.time {
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
        .accessibilityLabel("Set \(setNumber), \(set.status == .completed ? "completed" : set.status == .skipped ? "skipped" : set.status == .failed ? "failed" : isCurrent ? "current" : "pending")")
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
                        .accessibilityHidden(true)
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
                .accessibilityElement(children: .combine)
                .accessibilityLabel("Plate loading: \(plateMathText)")
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
                if set.entries.first?.target?.weight != nil {
                    VStack(alignment: .center, spacing: 2) {
                        Text("Weight\(weightUnitLabel)")
                            .font(.caption2)
                            .foregroundStyle(LiftMarkTheme.secondaryLabel)
                        HStack(spacing: 4) {
                            Button { adjustWeight(by: -weightStepIncrement) } label: {
                                Image(systemName: "minus.circle")
                                    .font(.body)
                                    .foregroundStyle(LiftMarkTheme.secondaryLabel)
                            }
                            .buttonStyle(.plain)
                            .accessibilityLabel("Decrease weight by \(formatWeight(weightStepIncrement))")

                            TextField("--", text: $weightText)
                                #if os(iOS)
                                .keyboardType(.decimalPad)
                                #endif
                                .font(.title3.monospacedDigit())
                                .multilineTextAlignment(.center)
                                .textFieldStyle(.roundedBorder)
                                .frame(width: 90)
                                .onChange(of: weightText) { _, newValue in
                                    onWeightChanged?(newValue)
                                }

                            Button { adjustWeight(by: weightStepIncrement) } label: {
                                Image(systemName: "plus.circle")
                                    .font(.body)
                                    .foregroundStyle(LiftMarkTheme.secondaryLabel)
                            }
                            .buttonStyle(.plain)
                            .accessibilityLabel("Increase weight by \(formatWeight(weightStepIncrement))")
                        }
                        .alignmentGuide(.textFieldCenter) { d in d[VerticalAlignment.center] }
                    }

                    // Show × separator only when reps follow (not for weighted-timed sets)
                    if set.entries.first?.target?.time == nil {
                        Text("×")
                            .font(.callout)
                            .foregroundStyle(LiftMarkTheme.secondaryLabel)
                            .alignmentGuide(.textFieldCenter) { d in d[VerticalAlignment.center] }
                    }
                }

                // Time input — for all timed exercises (including weighted-timed)
                if set.entries.first?.target?.time != nil {
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
                if set.entries.first?.target?.time == nil {
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
                .accessibilityLabel("Skip set \(setNumber)")
                .accessibilityHint("Marks this set as skipped")
                .alignmentGuide(.textFieldCenter) { d in d[VerticalAlignment.center] }
            }

            // Drop set entries (additional drops, groupIndex > 0)
            if set.isDropset && !dropEntries.isEmpty {
                ForEach(Array(dropEntries.enumerated()), id: \.offset) { index, _ in
                    dropEntryRow(index: index)
                }
            }

            // "+ Drop" button for drop sets
            if set.isDropset {
                Button {
                    // Auto-decrement weight by 5 lbs from previous entry
                    let prevWeightStr = dropEntries.last?.weight ?? weightText
                    let prevWeight = Double(prevWeightStr) ?? 0
                    let droppedWeight = max(0, prevWeight - 5)
                    let newWeight = droppedWeight.truncatingRemainder(dividingBy: 1) == 0
                        ? "\(Int(droppedWeight))" : String(format: "%.1f", droppedWeight)

                    // Pre-fill reps with remaining count (target - sum of entered reps)
                    let targetReps = set.entries.first?.target?.reps ?? 0
                    let primaryReps = Int(repsText) ?? 0
                    let dropRepsSum = dropEntries.compactMap { Int($0.reps) }.reduce(0, +)
                    let remaining = max(0, targetReps - primaryReps - dropRepsSum)
                    let newReps = remaining > 0 ? "\(remaining)" : ""

                    dropEntries.append((weight: newWeight, reps: newReps))
                } label: {
                    HStack(spacing: 4) {
                        Image(systemName: "plus")
                            .font(.caption.bold())
                        Text("Drop")
                            .font(.caption.bold())
                    }
                    .foregroundStyle(LiftMarkTheme.destructive)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(LiftMarkTheme.destructive.opacity(0.1))
                    .clipShape(RoundedRectangle(cornerRadius: LiftMarkTheme.cornerRadiusSM))
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("add-drop-button")
                .accessibilityLabel("Add drop")
                .accessibilityHint("Adds another weight reduction entry to this drop set")
            }

            // Middle row: target hint — always reserve space, show when values differ from target
            if let target = targetHint {
                Text(target)
                    .font(.caption)
                    .foregroundStyle(LiftMarkTheme.tertiaryLabel)
                    .opacity(valuesChangedFromTarget ? 1 : 0)
            }

            // Bottom row: complete button — hide for timed sets (completed via ExerciseTimerView Done)
            if set.entries.first?.target?.time == nil {
                Button {
                    if set.isDropset && !dropEntries.isEmpty, let callback = onCompleteDropSet {
                        // Build all entries: primary + drops
                        let weightUnit = set.entries.first?.target?.weight?.unit
                        var allEntries: [(weight: Double?, weightUnit: WeightUnit?, reps: Int?)] = [
                            (weight: Double(weightText), weightUnit: weightUnit, reps: Int(repsText))
                        ]
                        for drop in dropEntries {
                            allEntries.append((weight: Double(drop.weight), weightUnit: weightUnit, reps: Int(drop.reps)))
                        }
                        callback(allEntries)
                    } else {
                        onComplete(Double(weightText), Int(repsText), Int(timeText))
                    }
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
                .accessibilityLabel("Complete set \(setNumber)")
                .accessibilityHint("Records this set with the entered weight and reps")
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
                    // Don't allow inline edit for multi-entry drop sets (too complex)
                    let actualEntries = set.entries.filter { $0.actual != nil }
                    guard !(set.isDropset && actualEntries.count > 1) else { return }

                    isEditing.toggle()
                    // Initialize edit fields with current values
                    let target = set.entries.first?.target
                    let actual = set.entries.first?.actual
                    if let w = actual?.weight?.value ?? target?.weight?.value {
                        weightText = formatWeight(w)
                    }
                    if let r = actual?.reps ?? target?.reps {
                        repsText = "\(r)"
                    }
                    if let t = actual?.time ?? target?.time {
                        timeText = "\(t)"
                    }
                }
            } label: {
                if set.status == .completed && set.isDropset {
                    completedDropSetContent
                } else {
                    HStack(spacing: LiftMarkTheme.spacingSM) {
                        if set.status == .completed {
                            normalCompletedContent
                        } else if set.status == .skipped {
                            // Show target values + "-- Skipped"
                            let target = set.entries.first?.target
                            if let w = target?.weight?.value, let u = target?.weight?.unit {
                                Text("\(formatWeight(w)) \(u.rawValue)")
                                    .font(.subheadline.monospacedDigit())
                                    .foregroundStyle(LiftMarkTheme.warning)
                            }
                            if let r = target?.reps {
                                Text("\u{00D7} \(r)")
                                    .font(.subheadline.monospacedDigit())
                                    .foregroundStyle(LiftMarkTheme.warning)
                            }
                            Text("-- Skipped")
                                .font(.subheadline)
                                .foregroundStyle(LiftMarkTheme.warning)

                            Spacer()

                            modifierBadges
                        } else {
                            // Pending - show targets
                            let target = set.entries.first?.target
                            if let w = target?.weight?.value, let u = target?.weight?.unit {
                                Text("\(formatWeight(w)) \(u.rawValue)")
                                    .font(.subheadline.monospacedDigit())
                                    .foregroundStyle(LiftMarkTheme.tertiaryLabel)
                            }
                            if let r = target?.reps {
                                Text("\u{00D7} \(r)")
                                    .font(.subheadline.monospacedDigit())
                                    .foregroundStyle(LiftMarkTheme.tertiaryLabel)
                            }
                            if let t = target?.time {
                                Text(formatTime(t))
                                    .font(.subheadline.monospacedDigit())
                                    .foregroundStyle(LiftMarkTheme.tertiaryLabel)
                            }

                            Spacer()

                            modifierBadges
                        }
                    }
                }
            }
            .buttonStyle(.plain)
        }
    }

    // MARK: - Inline Edit (completed/skipped sets)

    @ViewBuilder
    private var inlineEditContent: some View {
        HStack(alignment: .textFieldCenter, spacing: LiftMarkTheme.spacingSM) {
            if set.entries.first?.actual?.weight != nil || set.entries.first?.target?.weight != nil {
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
                if set.entries.first?.target?.time == nil {
                    Text("×")
                        .font(.caption)
                        .foregroundStyle(LiftMarkTheme.secondaryLabel)
                        .alignmentGuide(.textFieldCenter) { d in d[VerticalAlignment.center] }
                }
            }

            // Reps field — only for non-timed sets
            if set.entries.first?.target?.time == nil {
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
            if set.entries.first?.actual?.time != nil || set.entries.first?.target?.time != nil {
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
            .accessibilityLabel("Save changes")
            .accessibilityHint("Updates this set with the edited values")
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
            .accessibilityLabel("Cancel editing")
            .alignmentGuide(.textFieldCenter) { d in d[VerticalAlignment.center] }
        }
    }

    // MARK: - Drop Entry Row

    @ViewBuilder
    private func dropEntryRow(index: Int) -> some View {
        HStack(spacing: LiftMarkTheme.spacingSM) {
            // Drop arrow indicator
            Image(systemName: "arrow.turn.down.right")
                .font(.caption)
                .foregroundStyle(LiftMarkTheme.destructive)
                .frame(width: 28)

            Text("Drop \(index + 1)")
                .font(.caption2)
                .fontWeight(.semibold)
                .foregroundStyle(LiftMarkTheme.destructive)

            if set.entries.first?.target?.weight != nil {
                HStack(spacing: 4) {
                    Button { adjustDropWeight(index: index, by: -weightStepIncrement) } label: {
                        Image(systemName: "minus.circle")
                            .font(.body)
                            .foregroundStyle(LiftMarkTheme.secondaryLabel)
                    }
                    .buttonStyle(.plain)

                    TextField("--", text: Binding(
                        get: { dropEntries[index].weight },
                        set: { dropEntries[index].weight = $0 }
                    ))
                    #if os(iOS)
                    .keyboardType(.decimalPad)
                    #endif
                    .font(.body.monospacedDigit())
                    .multilineTextAlignment(.center)
                    .textFieldStyle(.roundedBorder)
                    .frame(width: 80)

                    Button { adjustDropWeight(index: index, by: weightStepIncrement) } label: {
                        Image(systemName: "plus.circle")
                            .font(.body)
                            .foregroundStyle(LiftMarkTheme.secondaryLabel)
                    }
                    .buttonStyle(.plain)
                }

                Text("\u{00D7}")
                    .font(.caption)
                    .foregroundStyle(LiftMarkTheme.secondaryLabel)
            }

            TextField("--", text: Binding(
                get: { dropEntries[index].reps },
                set: { dropEntries[index].reps = $0 }
            ))
            #if os(iOS)
            .keyboardType(.numberPad)
            #endif
            .font(.body.monospacedDigit())
            .multilineTextAlignment(.center)
            .textFieldStyle(.roundedBorder)
            .frame(width: 60)

            Spacer()

            // Delete drop button
            Button {
                dropEntries.remove(at: index)
            } label: {
                Image(systemName: "minus.circle.fill")
                    .font(.body)
                    .foregroundStyle(LiftMarkTheme.destructive.opacity(0.7))
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Remove drop \(index + 1)")
        }
        .padding(.leading, LiftMarkTheme.spacingSM)
    }

    // MARK: - Completed Drop Set Display

    /// Compact display for completed drop sets: "225x10 -> 185x6 -> 135x4"
    @ViewBuilder
    private var completedDropSetContent: some View {
        let actualEntries = set.entries.filter { $0.actual != nil }
        if actualEntries.count > 1 {
            HStack(spacing: 4) {
                ForEach(Array(actualEntries.enumerated()), id: \.offset) { index, entry in
                    if index > 0 {
                        Image(systemName: "arrow.right")
                            .font(.caption2)
                            .foregroundStyle(LiftMarkTheme.success.opacity(0.6))
                    }
                    HStack(spacing: 2) {
                        if let w = entry.actual?.weight?.value {
                            Text(formatWeight(w))
                                .font(.subheadline.monospacedDigit())
                                .foregroundStyle(LiftMarkTheme.success)
                        }
                        if let r = entry.actual?.reps {
                            Text("\u{00D7}\(r)")
                                .font(.subheadline.monospacedDigit())
                                .foregroundStyle(LiftMarkTheme.success)
                        }
                    }
                }

                Spacer()

                modifierBadges
            }
        } else {
            // Single entry or no entries — fall back to normal display
            normalCompletedContent
        }
    }

    /// Standard single-entry completed content (extracted from completedOrPendingContent)
    @ViewBuilder
    private var normalCompletedContent: some View {
        HStack(spacing: LiftMarkTheme.spacingSM) {
            let actual = set.entries.first?.actual
            if let w = actual?.weight?.value, let u = actual?.weight?.unit {
                Text("\(formatWeight(w)) \(u.rawValue)")
                    .font(.subheadline.monospacedDigit())
                    .foregroundStyle(LiftMarkTheme.success)
            }
            if let r = actual?.reps {
                Text("\u{00D7} \(r)")
                    .font(.subheadline.monospacedDigit())
                    .foregroundStyle(LiftMarkTheme.success)
            }
            if let t = actual?.time {
                Text(formatTime(t))
                    .font(.subheadline.monospacedDigit())
                    .foregroundStyle(LiftMarkTheme.success)
            }

            Spacer()

            modifierBadges
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
            // Side label (/side badge for non-expanded per-side sets) — expanded Left/Right shown inline before data
            if set.isPerSide && set.side == nil {
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

    // MARK: - Helpers

    /// Plate math text for barbell exercises, computed from current weight input.
    private var plateMathText: String? {
        let target = set.entries.first?.target
        guard target?.weight != nil,
              PlateCalculator.isBarbellExercise(exerciseName: exerciseName, equipmentType: equipmentType)
        else { return nil }

        guard let weight = Double(weightText), weight > 0 else { return nil }

        let unit = target?.weight?.unit.rawValue ?? "lbs"
        let breakdown = PlateCalculator.calculatePlates(totalWeight: weight, unit: unit)

        // Don't show if weight is less than bar
        guard breakdown.isAchievable || !breakdown.plates.isEmpty else { return nil }

        return PlateCalculator.formatCompletePlateSetup(breakdown)
    }

    private var weightUnitLabel: String {
        let target = set.entries.first?.target
        let actual = set.entries.first?.actual
        if let unit = target?.weight?.unit ?? actual?.weight?.unit {
            return " (\(unit.rawValue))"
        }
        return ""
    }

    private var valuesChangedFromTarget: Bool {
        let target = set.entries.first?.target
        if let tw = target?.weight?.value {
            if Double(weightText) != tw { return true }
        }
        if let tr = target?.reps {
            if Int(repsText) != tr { return true }
        }
        return false
    }

    private var targetHint: String? {
        let target = set.entries.first?.target
        var parts: [String] = []
        if let w = target?.weight?.value {
            let unit = target?.weight?.unit.rawValue ?? ""
            parts.append("\(formatWeight(w)) \(unit)")
        }
        if let r = target?.reps {
            parts.append("× \(r)")
        }
        guard !parts.isEmpty else { return nil }
        return "Target: \(parts.joined(separator: " "))"
    }

    /// Step increment for weight stepper buttons: 5 for lbs, 2.5 for kg.
    private var weightStepIncrement: Double {
        let unit = set.entries.first?.target?.weight?.unit ?? set.entries.first?.actual?.weight?.unit
        return unit == .kg ? 2.5 : 5.0
    }

    /// Adjusts the main weight field by the given delta, clamped to 0.
    private func adjustWeight(by delta: Double) {
        let current = Double(weightText) ?? 0
        let newWeight = max(0, current + delta)
        weightText = formatWeight(newWeight)
        onWeightChanged?(weightText)
    }

    /// Adjusts a drop entry's weight field by the given delta, clamped to 0.
    private func adjustDropWeight(index: Int, by delta: Double) {
        guard index >= 0 && index < dropEntries.count else { return }
        let current = Double(dropEntries[index].weight) ?? 0
        let newWeight = max(0, current + delta)
        dropEntries[index].weight = formatWeight(newWeight)
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
