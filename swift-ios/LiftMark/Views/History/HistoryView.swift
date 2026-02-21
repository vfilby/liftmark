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

    /// Group sessions by relative date label (Today, Yesterday, This Week, etc.)
    private var groupedSessions: [(key: String, sessions: [WorkoutSession])] {
        let calendar = Calendar.current
        let now = Date()
        let dateFormatter = DateFormatter()
        dateFormatter.dateFormat = "yyyy-MM-dd"

        var groups: [String: [WorkoutSession]] = [:]
        var order: [String] = []

        for session in filteredSessions {
            guard let sessionDate = dateFormatter.date(from: String(session.date.prefix(10))) else {
                let key = "Other"
                if groups[key] == nil { order.append(key) }
                groups[key, default: []].append(session)
                continue
            }

            let key: String
            if calendar.isDateInToday(sessionDate) {
                key = "Today"
            } else if calendar.isDateInYesterday(sessionDate) {
                key = "Yesterday"
            } else if calendar.isDate(sessionDate, equalTo: now, toGranularity: .weekOfYear) {
                key = "This Week"
            } else if calendar.isDate(sessionDate, equalTo: now, toGranularity: .month) {
                key = "This Month"
            } else {
                let monthFormatter = DateFormatter()
                monthFormatter.dateFormat = "MMMM yyyy"
                key = monthFormatter.string(from: sessionDate)
            }

            if groups[key] == nil { order.append(key) }
            groups[key, default: []].append(session)
        }

        return order.compactMap { key in
            guard let sessions = groups[key] else { return nil }
            return (key: key, sessions: sessions)
        }
    }

    var body: some View {
        Group {
            if completedSessions.isEmpty {
                VStack(spacing: LiftMarkTheme.spacingMD) {
                    Spacer()
                    Image(systemName: "dumbbell")
                        .font(.largeTitle)
                        .foregroundStyle(.secondary)
                    Text("No Workouts Yet")
                        .font(.headline)
                    Text("Complete a workout to see your history.")
                        .foregroundStyle(.secondary)
                    Spacer()
                }
                .frame(maxWidth: .infinity)
                .accessibilityIdentifier("history-empty-state")
            } else {
                List {
                    ForEach(groupedSessions, id: \.key) { group in
                        Section(group.key) {
                            ForEach(group.sessions) { session in
                                NavigationLink(value: AppDestination.historyDetail(id: session.id)) {
                                    SessionCardView(session: session)
                                }
                                .accessibilityIdentifier("history-session-card")
                            }
                            .onDelete { offsets in
                                deleteSessionsInGroup(group.sessions, at: offsets)
                            }
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

    private func deleteSessionsInGroup(_ sessions: [WorkoutSession], at offsets: IndexSet) {
        for index in offsets {
            let session = sessions[index]
            sessionStore.deleteSession(id: session.id)
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
        if calendar.isDateInToday(date) {
            return "Today"
        } else if calendar.isDateInYesterday(date) {
            return "Yesterday"
        } else {
            let displayFormatter = DateFormatter()
            displayFormatter.dateStyle = .medium
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
        VStack(alignment: .leading, spacing: LiftMarkTheme.spacingXS) {
            Text(session.name)
                .font(.headline)

            HStack(spacing: LiftMarkTheme.spacingSM) {
                Text(formattedDate)
                if let time = startTimeFormatted {
                    Text("at \(time)")
                }
                if let duration = durationFormatted {
                    Text("·")
                    Text(duration)
                }
            }
            .font(.subheadline)
            .foregroundStyle(.secondary)

            HStack(spacing: LiftMarkTheme.spacingMD) {
                Label("\(completedSetsCount)/\(totalSetsCount) sets", systemImage: "checkmark.circle")
                Label("\(exerciseCount) exercises", systemImage: "figure.strengthtraining.traditional")
                if totalVolume > 0 {
                    Label(formatVolume(totalVolume), systemImage: "scalemass")
                }
            }
            .font(.caption)
            .foregroundStyle(.secondary)
        }
        .padding(.vertical, LiftMarkTheme.spacingXS)
    }

    private func formatVolume(_ volume: Double) -> String {
        if volume >= 1000 {
            return String(format: "%.1fk", volume / 1000)
        }
        return "\(Int(volume))"
    }
}

// MARK: - Share Sheet

#if os(iOS)
struct ShareSheet: UIViewControllerRepresentable {
    let items: [Any]

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: items, applicationActivities: nil)
    }

    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}
#endif
