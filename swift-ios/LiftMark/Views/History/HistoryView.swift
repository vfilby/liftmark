import SwiftUI

struct HistoryView: View {
    @Environment(SessionStore.self) private var sessionStore
    @State private var searchText = ""
    @State private var showExportConfirmation = false
    @State private var exportFileURL: URL?
    @State private var showShareSheet = false
    @State private var exportError: String?

    private var completedSessions: [WorkoutSession] {
        sessionStore.sessions.filter { $0.status == .completed }
    }

    private var filteredSessions: [WorkoutSession] {
        if searchText.isEmpty {
            return completedSessions
        }
        return completedSessions.filter {
            $0.name.localizedCaseInsensitiveContains(searchText)
        }
    }

    var body: some View {
        Group {
            if completedSessions.isEmpty {
                VStack(spacing: LiftMarkTheme.spacingSM) {
                    Spacer()
                    Image(systemName: "clock")
                        .font(.system(size: 48))
                        .foregroundStyle(LiftMarkTheme.tertiaryLabel)
                    Text("No Workouts Yet")
                        .font(.title3.weight(.semibold))
                    Text("Complete a workout to see it here")
                        .font(.subheadline)
                        .foregroundStyle(LiftMarkTheme.secondaryLabel)
                    Spacer()
                }
                .frame(maxWidth: .infinity)
                .accessibilityIdentifier("history-empty-state")
            } else {
                List {
                    ForEach(filteredSessions) { session in
                        NavigationLink(value: AppDestination.historyDetail(id: session.id)) {
                            SessionCardView(session: session)
                        }
                        .accessibilityIdentifier("history-session-card")
                    }
                    .onDelete { offsets in
                        let sessionsToDelete = offsets.map { filteredSessions[$0] }
                        for session in sessionsToDelete {
                            sessionStore.deleteSession(id: session.id)
                        }
                    }
                }
                .listStyle(.plain)
                .searchable(text: $searchText, prompt: "Search workouts")
                .accessibilityIdentifier("history-list")
            }
        }
        .accessibilityIdentifier("history-screen")
        .navigationTitle("Workouts")
        .refreshable {
            sessionStore.loadSessions()
        }
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button {
                    showExportConfirmation = true
                } label: {
                    Image(systemName: "square.and.arrow.up")
                }
                .disabled(completedSessions.isEmpty)
                .accessibilityIdentifier("history-export-button")
            }
        }
        .alert("Export Workouts", isPresented: $showExportConfirmation) {
            Button("Export All as JSON") {
                exportAllSessions()
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Export \(completedSessions.count) workout\(completedSessions.count == 1 ? "" : "s") as JSON?")
        }
        .alert("Export Error", isPresented: .init(
            get: { exportError != nil },
            set: { if !$0 { exportError = nil } }
        )) {
            Button("OK") { exportError = nil }
        } message: {
            Text(exportError ?? "")
        }
        #if os(iOS)
        .sheet(isPresented: $showShareSheet) {
            if let url = exportFileURL {
                ShareSheet(items: [url])
            }
        }
        #endif
        .navigationDestination(for: AppDestination.self) { destination in
            switch destination {
            case .historyDetail(let id):
                HistoryDetailView(sessionId: id)
            default:
                EmptyView()
            }
        }
    }

    private func exportAllSessions() {
        let exportService = WorkoutExportService()
        do {
            let url = try exportService.exportSessionsAsJson()
            exportFileURL = url
            showShareSheet = true
        } catch {
            exportError = error.localizedDescription
        }
    }
}

// MARK: - Session Card

private struct SessionCardView: View {
    let session: WorkoutSession

    private var completedSetsCount: Int {
        session.exercises.flatMap(\.sets).filter { $0.status == .completed }.count
    }

    private var totalSetsCount: Int {
        session.exercises.flatMap(\.sets).count
    }

    private var exerciseCount: Int {
        session.exercises.filter { !$0.sets.isEmpty }.count
    }

    private var totalVolume: Double {
        session.exercises.flatMap(\.sets)
            .filter { $0.status == .completed }
            .reduce(0.0) { total, set in
                total + (set.actualWeight ?? 0) * Double(set.actualReps ?? 0)
            }
    }

    private var formattedDate: String {
        let dateFormatter = DateFormatter()
        dateFormatter.dateFormat = "yyyy-MM-dd"
        guard let date = dateFormatter.date(from: String(session.date.prefix(10))) else {
            return session.date
        }

        let calendar = Calendar.current
        let now = Date()
        if calendar.isDateInToday(date) {
            return "Today"
        } else if calendar.isDateInYesterday(date) {
            return "Yesterday"
        } else if let daysAgo = calendar.dateComponents([.day], from: date, to: now).day,
                  daysAgo < 7 {
            // Show weekday name for dates within the past week
            let weekdayFormatter = DateFormatter()
            weekdayFormatter.dateFormat = "EEEE"
            return weekdayFormatter.string(from: date)
        } else {
            let displayFormatter = DateFormatter()
            displayFormatter.dateFormat = "MMM d"
            return displayFormatter.string(from: date)
        }
    }

    private var startTimeFormatted: String? {
        guard let startTime = session.startTime,
              let date = ISO8601DateFormatter().date(from: startTime) else { return nil }
        let formatter = DateFormatter()
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }

    private var durationFormatted: String? {
        guard let duration = session.duration else { return nil }
        let minutes = duration / 60
        if minutes < 60 {
            return "\(minutes) min"
        }
        let hours = minutes / 60
        let remainingMinutes = minutes % 60
        return "\(hours)h \(remainingMinutes)m"
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            // Row 1: Name (left) + relative date (right)
            HStack(alignment: .firstTextBaseline) {
                Text(session.name)
                    .font(.headline)
                Spacer()
                Text(formattedDate)
                    .font(.subheadline)
                    .foregroundStyle(LiftMarkTheme.secondaryLabel)
            }

            // Row 2: Start time · duration
            HStack(spacing: 0) {
                if let time = startTimeFormatted {
                    Text(time)
                    if durationFormatted != nil {
                        Text(" \u{00B7} ")
                    }
                }
                if let duration = durationFormatted {
                    Text(duration)
                }
            }
            .font(.subheadline)
            .foregroundStyle(LiftMarkTheme.secondaryLabel)

            // Row 3: sets · exercises · volume
            HStack(spacing: 0) {
                Text("\(completedSetsCount) sets")
                Text(" \u{00B7} ")
                Text("\(exerciseCount) exercises")
                if totalVolume > 0 {
                    Text(" \u{00B7} ")
                    Text(formatVolume(totalVolume))
                }
            }
            .font(.subheadline)
            .foregroundStyle(LiftMarkTheme.secondaryLabel)
        }
        .padding(.vertical, LiftMarkTheme.spacingXS)
    }

    private func formatVolume(_ volume: Double) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        formatter.maximumFractionDigits = 0
        let formatted = formatter.string(from: NSNumber(value: volume)) ?? "\(Int(volume))"
        return "\(formatted) lbs"
    }
}

// MARK: - Identifiable URL for sheet(item:)

struct ShareableURL: Identifiable {
    let id = UUID()
    let url: URL
}

