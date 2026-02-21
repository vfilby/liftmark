import SwiftUI

/// Countdown rest timer displayed inline after completing a set.
struct RestTimerView: View {
    let totalSeconds: Int
    let onSkip: () -> Void

    @State private var remainingSeconds: Int
    @State private var timer: Timer?
    @State private var isRunning = false

    init(totalSeconds: Int, onSkip: @escaping () -> Void) {
        self.totalSeconds = totalSeconds
        self.onSkip = onSkip
        self._remainingSeconds = State(initialValue: totalSeconds)
    }

    private var progress: Double {
        guard totalSeconds > 0 else { return 0 }
        return Double(totalSeconds - remainingSeconds) / Double(totalSeconds)
    }

    var body: some View {
        HStack(spacing: LiftMarkTheme.spacingSM) {
            Image(systemName: "timer")
                .foregroundStyle(LiftMarkTheme.primary)

            VStack(alignment: .leading, spacing: 2) {
                Text("Rest")
                    .font(.caption2)
                    .foregroundStyle(LiftMarkTheme.secondaryLabel)

                ProgressView(value: progress)
                    .tint(remainingSeconds <= 0 ? LiftMarkTheme.success : LiftMarkTheme.primary)
            }

            Text(formatTime(remainingSeconds))
                .font(.subheadline.monospacedDigit().bold())
                .foregroundStyle(remainingSeconds <= 0 ? LiftMarkTheme.success : LiftMarkTheme.label)
                .frame(width: 50, alignment: .trailing)

            Text("/ \(formatTime(totalSeconds))")
                .font(.caption)
                .foregroundStyle(LiftMarkTheme.tertiaryLabel)

            Spacer()

            Button {
                stopTimer()
                onSkip()
            } label: {
                Text("Skip")
                    .font(.caption.bold())
                    .foregroundStyle(LiftMarkTheme.primary)
            }
            .buttonStyle(.plain)
        }
        .padding(LiftMarkTheme.spacingSM)
        .background(LiftMarkTheme.primary.opacity(0.05))
        .clipShape(RoundedRectangle(cornerRadius: LiftMarkTheme.cornerRadiusSM))
        .onAppear { startTimer() }
        .onDisappear { stopTimer() }
    }

    private func startTimer() {
        guard !isRunning else { return }
        isRunning = true
        timer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { _ in
            if remainingSeconds > 0 {
                remainingSeconds -= 1
            } else {
                stopTimer()
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
        return "\(s)s"
    }
}

/// Large exercise timer for timed exercises (e.g., planks).
struct ExerciseTimerView: View {
    let targetSeconds: Int?
    let onComplete: () -> Void

    @State private var elapsedSeconds: Int = 0
    @State private var timer: Timer?
    @State private var isRunning = false

    private var progress: Double {
        guard let target = targetSeconds, target > 0 else { return 0 }
        return min(Double(elapsedSeconds) / Double(target), 1.0)
    }

    private var isComplete: Bool {
        guard let target = targetSeconds else { return false }
        return elapsedSeconds >= target
    }

    var body: some View {
        VStack(spacing: LiftMarkTheme.spacingSM) {
            // Timer display
            Text(formatTime(elapsedSeconds))
                .font(.system(size: 48, weight: .bold, design: .monospaced))
                .foregroundStyle(isComplete ? LiftMarkTheme.success : LiftMarkTheme.label)

            // Progress bar
            if targetSeconds != nil {
                ProgressView(value: progress)
                    .tint(isComplete ? LiftMarkTheme.success : LiftMarkTheme.primary)
                    .padding(.horizontal, LiftMarkTheme.spacingLG)
            }

            // Controls
            HStack(spacing: LiftMarkTheme.spacingMD) {
                Button {
                    if isRunning {
                        pauseTimer()
                    } else {
                        startTimer()
                    }
                } label: {
                    Label(
                        isRunning ? "Pause" : (elapsedSeconds > 0 ? "Resume" : "Start"),
                        systemImage: isRunning ? "pause.fill" : "play.fill"
                    )
                    .font(.headline)
                    .padding(.horizontal, LiftMarkTheme.spacingMD)
                    .padding(.vertical, LiftMarkTheme.spacingSM)
                    .background(isRunning ? LiftMarkTheme.warning : LiftMarkTheme.primary)
                    .foregroundStyle(.white)
                    .clipShape(Capsule())
                }
                .buttonStyle(.plain)

                if isComplete {
                    Button {
                        stopTimer()
                        onComplete()
                    } label: {
                        Label("Done", systemImage: "checkmark")
                            .font(.headline)
                            .padding(.horizontal, LiftMarkTheme.spacingMD)
                            .padding(.vertical, LiftMarkTheme.spacingSM)
                            .background(LiftMarkTheme.success)
                            .foregroundStyle(.white)
                            .clipShape(Capsule())
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .padding()
        .onDisappear { stopTimer() }
    }

    private func startTimer() {
        guard !isRunning else { return }
        isRunning = true
        timer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { _ in
            elapsedSeconds += 1
        }
    }

    private func pauseTimer() {
        timer?.invalidate()
        timer = nil
        isRunning = false
    }

    private func stopTimer() {
        pauseTimer()
        elapsedSeconds = 0
    }

    private func formatTime(_ seconds: Int) -> String {
        let m = seconds / 60
        let s = seconds % 60
        return String(format: "%d:%02d", m, s)
    }
}
