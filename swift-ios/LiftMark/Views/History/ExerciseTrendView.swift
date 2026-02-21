import SwiftUI

/// Collapsible view showing exercise trend data inline in history detail.
struct ExerciseTrendView: View {
    let exerciseName: String
    @State private var isExpanded = false
    @State private var historyPoints: [ExerciseHistoryPoint] = []
    @State private var isLoading = false

    private var trend: String {
        guard historyPoints.count >= 2 else { return "→" }
        let sorted = historyPoints.sorted { $0.date < $1.date }
        let recent = sorted.suffix(3).map(\.maxWeight)
        let older = sorted.prefix(3).map(\.maxWeight)
        let recentAvg = recent.reduce(0, +) / Double(recent.count)
        let olderAvg = older.reduce(0, +) / Double(older.count)
        if recentAvg > olderAvg * 1.02 { return "↗" }
        if recentAvg < olderAvg * 0.98 { return "↘" }
        return "→"
    }

    private var trendColor: Color {
        switch trend {
        case "↗": return LiftMarkTheme.success
        case "↘": return LiftMarkTheme.destructive
        default: return LiftMarkTheme.secondaryLabel
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: LiftMarkTheme.spacingXS) {
            Button {
                withAnimation(.easeInOut(duration: 0.2)) {
                    isExpanded.toggle()
                }
                if isExpanded && historyPoints.isEmpty {
                    loadHistory()
                }
            } label: {
                HStack {
                    Text(isExpanded ? "Hide trends" : "Show trends")
                        .font(.caption)
                    Text(trend)
                        .foregroundStyle(trendColor)
                    Spacer()
                    Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                        .font(.caption)
                }
                .foregroundStyle(LiftMarkTheme.primary)
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("trend-toggle-\(exerciseName)")

            if isExpanded {
                if isLoading {
                    ProgressView()
                        .frame(maxWidth: .infinity)
                } else if historyPoints.isEmpty {
                    Text("No previous sessions")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                } else {
                    VStack(alignment: .leading, spacing: LiftMarkTheme.spacingSM) {
                        ForEach(historyPoints.prefix(5), id: \.date) { point in
                            TrendSessionRow(point: point)
                        }
                    }
                    .transition(.opacity.combined(with: .move(edge: .top)))
                }
            }
        }
        .onAppear {
            if historyPoints.isEmpty {
                loadHistory()
            }
        }
    }

    private func loadHistory() {
        isLoading = true
        let repo = ExerciseHistoryRepository()
        do {
            historyPoints = try repo.getHistory(forExercise: exerciseName)
        } catch {
            print("Failed to load trend data: \(error)")
        }
        isLoading = false
    }
}

// MARK: - Trend Session Row

private struct TrendSessionRow: View {
    let point: ExerciseHistoryPoint

    private var formattedDate: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        guard let date = formatter.date(from: String(point.date.prefix(10))) else {
            return point.date
        }

        let calendar = Calendar.current
        if calendar.isDateInToday(date) {
            return "Today"
        } else if calendar.isDateInYesterday(date) {
            return "Yesterday"
        } else {
            let daysDiff = calendar.dateComponents([.day], from: date, to: Date()).day ?? 0
            if daysDiff < 7 {
                return "\(daysDiff) days ago"
            }
            let displayFormatter = DateFormatter()
            displayFormatter.dateStyle = .short
            return displayFormatter.string(from: date)
        }
    }

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(formattedDate)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Text(point.workoutName)
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
            }

            Spacer()

            HStack(spacing: LiftMarkTheme.spacingSM) {
                if point.maxWeight > 0 {
                    Text("\(Int(point.maxWeight)) \(point.unit.rawValue)")
                        .font(.caption)
                        .fontWeight(.medium)
                }
                Text("\(point.setsCount) sets")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                if point.totalVolume > 0 {
                    Text(formatVolume(point.totalVolume))
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }
        }
        .padding(.vertical, 2)
    }

    private func formatVolume(_ volume: Double) -> String {
        if volume >= 1000 {
            return String(format: "%.1fk vol", volume / 1000)
        }
        return "\(Int(volume)) vol"
    }
}
