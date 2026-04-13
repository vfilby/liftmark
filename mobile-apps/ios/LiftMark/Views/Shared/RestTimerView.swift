import SwiftUI

/// Countdown rest timer displayed inline after completing a set.
/// Uses wall-clock Date() timestamps so the timer survives app backgrounding.
struct RestTimerView: View {
    let totalSeconds: Int
    let onSkip: () -> Void

    @State private var startDate: Date = Date()
    @State private var timer: Timer?
    @State private var isRunning = false
    @State private var displayRemaining: Int
    @State private var lastPlayedSecond: Int = -1
    @Environment(\.scenePhase) private var scenePhase
    @Environment(SettingsStore.self) private var settingsStore

    init(totalSeconds: Int, onSkip: @escaping () -> Void) {
        self.totalSeconds = totalSeconds
        self.onSkip = onSkip
        self._displayRemaining = State(initialValue: totalSeconds)
    }

    private var progress: Double {
        guard totalSeconds > 0 else { return 0 }
        return Double(totalSeconds - displayRemaining) / Double(totalSeconds)
    }

    var body: some View {
        HStack(spacing: LiftMarkTheme.spacingMD) {
            Spacer()

            Text(formatTime(displayRemaining))
                .font(.title)
                .fontWeight(.semibold)
                .monospacedDigit()
                .foregroundStyle(displayRemaining <= 0 ? LiftMarkTheme.success : LiftMarkTheme.primary)
                .accessibilityLabel("Rest timer, \(displayRemaining) seconds remaining")

            Button {
                stopTimer()
                onSkip()
            } label: {
                Text("Stop")
                    .font(.caption)
                    .fontWeight(.semibold)
                    .foregroundStyle(LiftMarkTheme.destructive)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 5)
                    .overlay(
                        RoundedRectangle(cornerRadius: LiftMarkTheme.cornerRadiusSM)
                            .stroke(LiftMarkTheme.destructive, lineWidth: 1.5)
                    )
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Stop rest timer")
            .accessibilityHint("Dismisses the rest timer and moves to the next set")

            Spacer()
        }
        .padding(.vertical, LiftMarkTheme.spacingLG)
        .background(LiftMarkTheme.primary.opacity(0.05))
        .clipShape(RoundedRectangle(cornerRadius: LiftMarkTheme.cornerRadiusSM))
        .overlay(
            RoundedRectangle(cornerRadius: LiftMarkTheme.cornerRadiusSM)
                .strokeBorder(LiftMarkTheme.primary.opacity(0.2), style: StrokeStyle(lineWidth: 1, dash: [5, 3]))
        )
        .onAppear {
            AudioService.shared.preloadSounds()
            startTimer()
        }
        .onDisappear { stopTimer() }
        .onChange(of: scenePhase) { _, newPhase in
            if newPhase == .active {
                recalculate()
                // Restart tick timer aligned to second boundaries if still running
                if isRunning && displayRemaining > 0 {
                    timer?.invalidate()
                    timer = nil
                    let fractional = Date().timeIntervalSince1970.truncatingRemainder(dividingBy: 1)
                    let delayToNextSecond = fractional < 0.001 ? 1.0 : (1.0 - fractional)
                    timer = Timer.scheduledTimer(withTimeInterval: delayToNextSecond, repeats: false) { _ in
                        recalculate()
                        self.timer?.invalidate()
                        self.timer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { _ in
                            recalculate()
                        }
                    }
                }
            }
        }
    }

    private func recalculate() {
        let elapsed = Int(Date().timeIntervalSince(startDate))
        let newRemaining = max(0, totalSeconds - elapsed)
        let previousRemaining = displayRemaining
        displayRemaining = newRemaining

        // Play countdown sounds if enabled
        if settingsStore.settings?.countdownSoundsEnabled == true && newRemaining != previousRemaining {
            if newRemaining >= 1 && newRemaining <= 5 && lastPlayedSecond != newRemaining {
                lastPlayedSecond = newRemaining
                AudioService.shared.playTick()
            }
            if newRemaining == 0 && lastPlayedSecond != 0 {
                lastPlayedSecond = 0
                AudioService.shared.playComplete()
            }
        }

        if displayRemaining <= 0 && isRunning {
            stopTimer()
            onSkip()
        }
    }

    private func startTimer() {
        guard !isRunning else { return }
        startDate = Date()
        isRunning = true

        // Align to next whole-second boundary so countdown sounds fire precisely
        let fractional = Date().timeIntervalSince1970.truncatingRemainder(dividingBy: 1)
        let delayToNextSecond = fractional < 0.001 ? 1.0 : (1.0 - fractional)

        timer = Timer.scheduledTimer(withTimeInterval: delayToNextSecond, repeats: false) { _ in
            recalculate()
            self.timer?.invalidate()
            self.timer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { _ in
                recalculate()
            }
        }
    }

    private func stopTimer() {
        timer?.invalidate()
        timer = nil
        isRunning = false
    }

    private func formatTime(_ seconds: Int) -> String {
        let m = seconds / 60
        let s = seconds % 60
        if m > 0 {
            return String(format: "%d:%02d", m, s)
        }
        return "0:\(String(format: "%02d", s))"
    }
}

/// Large exercise timer for timed exercises (e.g., planks).
/// Uses wall-clock Date() timestamps so the timer survives app backgrounding.
struct ExerciseTimerView: View {
    let targetSeconds: Int?
    let onComplete: (Int) -> Void

    /// The Date when the timer was last started/resumed. nil when paused or stopped.
    @State private var startDate: Date?
    /// Accumulated elapsed time from previous start/pause cycles.
    @State private var pausedElapsed: TimeInterval = 0
    @State private var timer: Timer?
    @State private var isRunning = false
    /// Display value updated by the 1-second timer tick.
    @State private var displayElapsed: Int = 0
    @State private var lastPlayedSecond: Int = -1
    @State private var completionPlayed: Bool = false
    @Environment(\.scenePhase) private var scenePhase
    @Environment(SettingsStore.self) private var settingsStore

    init(targetSeconds: Int?, onComplete: @escaping (Int) -> Void) {
        self.targetSeconds = targetSeconds
        self.onComplete = onComplete
    }

    /// Total elapsed seconds (running + paused accumulated).
    private var currentElapsed: Int {
        if let start = startDate {
            return Int(pausedElapsed + Date().timeIntervalSince(start))
        }
        return Int(pausedElapsed)
    }

    private var isComplete: Bool {
        guard let target = targetSeconds else { return false }
        return displayElapsed >= target
    }

    var body: some View {
        VStack(spacing: LiftMarkTheme.spacingSM) {
            // Timer display
            Text(formatTime(displayElapsed))
                .font(.system(size: 40, weight: .light, design: .monospaced))
                .foregroundStyle(isComplete ? LiftMarkTheme.success : LiftMarkTheme.primary)
                .tracking(1)
                .accessibilityLabel("Exercise timer, \(displayElapsed) seconds elapsed")

            // Target label
            if let target = targetSeconds {
                HStack(spacing: 4) {
                    Text("Target: \(formatTime(target))")
                        .font(.caption)
                        .foregroundStyle(isComplete ? LiftMarkTheme.success : LiftMarkTheme.secondaryLabel)
                    if isComplete {
                        Image(systemName: "checkmark")
                            .font(.caption)
                            .foregroundStyle(LiftMarkTheme.success)
                    }
                }
            }

            // Controls
            HStack(spacing: LiftMarkTheme.spacingSM) {
                Button {
                    if isRunning {
                        pauseTimer()
                    } else {
                        startTimer()
                    }
                } label: {
                    Text(isRunning ? "Pause" : (displayElapsed > 0 ? "Resume" : "Start"))
                        .font(.body)
                        .fontWeight(.semibold)
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity, minHeight: 40)
                        .background(isRunning ? LiftMarkTheme.warning : LiftMarkTheme.primary)
                        .clipShape(RoundedRectangle(cornerRadius: LiftMarkTheme.cornerRadiusSM))
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("exercise-timer-start-button")
                .accessibilityLabel(isRunning ? "Pause timer" : (displayElapsed > 0 ? "Resume timer" : "Start timer"))

                // Done button — available once the timer has been started.
                if isRunning || displayElapsed > 0 {
                    Button {
                        let elapsed = currentElapsed
                        stopTimer()
                        onComplete(elapsed)
                    } label: {
                        Text("Done")
                            .font(.body)
                            .fontWeight(.semibold)
                            .foregroundStyle(.white)
                            .frame(maxWidth: .infinity, minHeight: 40)
                            .background(LiftMarkTheme.success)
                            .clipShape(RoundedRectangle(cornerRadius: LiftMarkTheme.cornerRadiusSM))
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("exercise-timer-done-button")
                    .accessibilityLabel("Done")
                    .accessibilityHint("Completes the timed set with the current elapsed time")
                }
            }
        }
        .padding()
        .background(LiftMarkTheme.primary.opacity(0.05))
        .clipShape(RoundedRectangle(cornerRadius: LiftMarkTheme.cornerRadiusSM))
        .overlay(
            RoundedRectangle(cornerRadius: LiftMarkTheme.cornerRadiusSM)
                .stroke(LiftMarkTheme.primary.opacity(0.2), lineWidth: 1.5)
        )
        .onDisappear { stopTimer() }
        .onChange(of: scenePhase) { _, newPhase in
            if newPhase == .active {
                recalculate()
                // Restart tick timer aligned to second boundaries if still running
                if isRunning {
                    timer?.invalidate()
                    timer = nil
                    let fractional = Date().timeIntervalSince1970.truncatingRemainder(dividingBy: 1)
                    let delayToNextSecond = fractional < 0.001 ? 1.0 : (1.0 - fractional)
                    timer = Timer.scheduledTimer(withTimeInterval: delayToNextSecond, repeats: false) { _ in
                        recalculate()
                        self.timer?.invalidate()
                        self.timer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { _ in
                            recalculate()
                        }
                    }
                }
            }
        }
    }

    private func recalculate() {
        let previousElapsed = displayElapsed
        displayElapsed = currentElapsed

        // Play countdown sounds if enabled and there is a target
        if let target = targetSeconds,
           settingsStore.settings?.countdownSoundsEnabled == true,
           displayElapsed != previousElapsed {
            let remaining = target - displayElapsed
            if remaining >= 1 && remaining <= 5 && lastPlayedSecond != remaining {
                lastPlayedSecond = remaining
                AudioService.shared.playTick()
            }
            if displayElapsed >= target && !completionPlayed {
                completionPlayed = true
                AudioService.shared.playComplete()
            }
        }
    }

    private func startTimer() {
        guard !isRunning else { return }
        AudioService.shared.preloadSounds()
        startDate = Date()
        isRunning = true

        // Align to next whole-second boundary so countdown sounds fire precisely
        let fractional = Date().timeIntervalSince1970.truncatingRemainder(dividingBy: 1)
        let delayToNextSecond = fractional < 0.001 ? 1.0 : (1.0 - fractional)

        timer = Timer.scheduledTimer(withTimeInterval: delayToNextSecond, repeats: false) { _ in
            recalculate()
            self.timer?.invalidate()
            self.timer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { _ in
                recalculate()
            }
        }
    }

    private func pauseTimer() {
        if let start = startDate {
            pausedElapsed += Date().timeIntervalSince(start)
        }
        startDate = nil
        timer?.invalidate()
        timer = nil
        isRunning = false
        recalculate()
    }

    private func stopTimer() {
        startDate = nil
        pausedElapsed = 0
        timer?.invalidate()
        timer = nil
        isRunning = false
        displayElapsed = 0
    }

    private func formatTime(_ seconds: Int) -> String {
        let m = seconds / 60
        let s = seconds % 60
        return String(format: "%d:%02d", m, s)
    }
}
