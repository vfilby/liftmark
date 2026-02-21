import SwiftUI

struct HistoryDetailView: View {
    let sessionId: String
    @Environment(SessionStore.self) private var sessionStore
    @Environment(\.dismiss) private var dismiss
    @State private var showDeleteConfirmation = false
    @State private var showShareSheet = false
    @State private var exportFileURL: URL?
    @State private var showExerciseHistory = false
    @State private var selectedExerciseName: String?

    private var session: WorkoutSession? {
        sessionStore.sessions.first { $0.id == sessionId }
    }

    private var completedSetsCount: Int {
        guard let session else { return 0 }
        return session.exercises.flatMap(\.sets).filter { $0.status == .completed }.count
    }

    private var totalSetsCount: Int {
        guard let session else { return 0 }
        return session.exercises.flatMap(\.sets).count
    }

    private var totalVolume: Double {
        guard let session else { return 0 }
        return session.exercises.flatMap(\.sets)
            .filter { $0.status == .completed }
            .reduce(0.0) { total, set in
                total + (set.actualWeight ?? 0) * Double(set.actualReps ?? 0)
            }
    }

    private var totalReps: Int {
        guard let session else { return 0 }
        return session.exercises.flatMap(\.sets)
            .filter { $0.status == .completed }
            .compactMap(\.actualReps)
            .reduce(0, +)
    }

    var body: some View {
        Group {
            if let session {
                ScrollView {
                    VStack(alignment: .leading, spacing: LiftMarkTheme.spacingMD) {
                        // Stats card
                        statsCard(session)

                        // Notes
                        if let notes = session.notes, !notes.isEmpty {
                            VStack(alignment: .leading, spacing: LiftMarkTheme.spacingXS) {
                                Text("Notes")
                                    .font(.subheadline)
                                    .fontWeight(.semibold)
                                Text(notes)
                                    .font(.body)
                                    .foregroundStyle(.secondary)
                            }
                            .padding()
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(LiftMarkTheme.secondaryBackground)
                            .clipShape(RoundedRectangle(cornerRadius: LiftMarkTheme.cornerRadiusMD))
                        }

                        // Exercises
                        ForEach(session.exercises) { exercise in
                            exerciseCard(exercise)
                        }

                        // Delete button
                        Button(role: .destructive) {
                            showDeleteConfirmation = true
                        } label: {
                            HStack {
                                Image(systemName: "trash")
                                Text("Delete Workout")
                            }
                            .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.bordered)
                        .tint(.red)
                        .padding(.top, LiftMarkTheme.spacingMD)
                        .accessibilityIdentifier("delete-session-button")
                    }
                    .padding()
                }
                .accessibilityIdentifier("history-detail-view")
            } else {
                ProgressView()
            }
        }
        .accessibilityIdentifier("history-detail-screen")
        .navigationTitle(session?.name ?? "Workout")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button {
                    exportSession()
                } label: {
                    Image(systemName: "square.and.arrow.up")
                }
                .accessibilityIdentifier("history-detail-share")
            }
        }
        .alert("Delete Workout", isPresented: $showDeleteConfirmation) {
            Button("Delete", role: .destructive) {
                sessionStore.deleteSession(id: sessionId)
                dismiss()
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Are you sure you want to delete this workout? This cannot be undone.")
        }
        #if os(iOS)
        .sheet(isPresented: $showShareSheet) {
            if let url = exportFileURL {
                ShareSheet(items: [url])
            }
        }
        #endif
        .sheet(isPresented: $showExerciseHistory) {
            if let name = selectedExerciseName {
                NavigationStack {
                    ExerciseHistorySheetView(exerciseName: name)
                }
            }
        }
    }

    // MARK: - Stats Card

    @ViewBuilder
    private func statsCard(_ session: WorkoutSession) -> some View {
        VStack(alignment: .leading, spacing: LiftMarkTheme.spacingSM) {
            // Date & time
            HStack {
                if let startTime = session.startTime,
                   let date = ISO8601DateFormatter().date(from: startTime) {
                    let formatter = DateFormatter()
                    let _ = formatter.dateStyle = .long
                    let _ = formatter.timeStyle = .short
                    Text(formatter.string(from: date))
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                } else {
                    Text(session.date)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }

                Spacer()

                if let duration = session.duration {
                    let minutes = duration / 60
                    Text(minutes < 60 ? "\(minutes) min" : "\(minutes / 60)h \(minutes % 60)m")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
            }

            Divider()

            // Stats row
            HStack(spacing: LiftMarkTheme.spacingMD) {
                VStack {
                    Text("\(completedSetsCount)")
                        .font(.title3)
                        .fontWeight(.bold)
                    Text("Sets")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity)

                VStack {
                    Text("\(totalReps)")
                        .font(.title3)
                        .fontWeight(.bold)
                    Text("Reps")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity)

                VStack {
                    Text(formatVolume(totalVolume))
                        .font(.title3)
                        .fontWeight(.bold)
                    Text("Volume")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity)
            }
        }
        .padding()
        .background(LiftMarkTheme.secondaryBackground)
        .clipShape(RoundedRectangle(cornerRadius: LiftMarkTheme.cornerRadiusMD))
        .accessibilityIdentifier("session-stats-card")
    }

    // MARK: - Exercise Card

    @ViewBuilder
    private func exerciseCard(_ exercise: SessionExercise) -> some View {
        VStack(alignment: .leading, spacing: LiftMarkTheme.spacingSM) {
            HStack {
                Text(exercise.exerciseName)
                    .font(.headline)

                if let groupType = exercise.groupType {
                    Text(groupType == .superset ? "Superset" : "Section")
                        .font(.caption)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(LiftMarkTheme.primary.opacity(0.1))
                        .clipShape(Capsule())
                }

                Spacer()

                Button {
                    selectedExerciseName = exercise.exerciseName
                    showExerciseHistory = true
                } label: {
                    Text("Details")
                        .font(.caption)
                }
                .buttonStyle(.bordered)
                .accessibilityIdentifier("exercise-details-\(exercise.exerciseName)")
            }

            // Sets
            ForEach(Array(exercise.sets.enumerated()), id: \.element.id) { index, set in
                setRow(set, index: index + 1)
            }

            // Exercise notes
            if let notes = exercise.notes, !notes.isEmpty {
                Text(notes)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .padding(.top, LiftMarkTheme.spacingXS)
            }

            // Inline trend
            ExerciseTrendView(exerciseName: exercise.exerciseName)
        }
        .padding()
        .background(LiftMarkTheme.secondaryBackground)
        .clipShape(RoundedRectangle(cornerRadius: LiftMarkTheme.cornerRadiusMD))
        .accessibilityIdentifier("exercise-card-\(exercise.exerciseName)")
    }

    // MARK: - Set Row

    @ViewBuilder
    private func setRow(_ set: SessionSet, index: Int) -> some View {
        HStack {
            // Set number badge
            Text("\(index)")
                .font(.caption2)
                .fontWeight(.bold)
                .frame(width: 22, height: 22)
                .background(statusColor(set.status).opacity(0.2))
                .foregroundStyle(statusColor(set.status))
                .clipShape(Circle())

            // Weight & reps
            if let weight = set.actualWeight ?? set.targetWeight,
               let unit = set.actualWeightUnit ?? set.targetWeightUnit {
                Text("\(Int(weight)) \(unit.rawValue)")
                    .font(.subheadline)
            }
            if let reps = set.actualReps ?? set.targetReps {
                Text("x \(reps)")
                    .font(.subheadline)
            }
            if let time = set.actualTime ?? set.targetTime {
                Text("\(time)s")
                    .font(.subheadline)
            }

            if let rpe = set.actualRpe ?? set.targetRpe {
                Text("RPE \(rpe)")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Spacer()

            // Status indicator
            switch set.status {
            case .completed:
                Image(systemName: "checkmark.circle.fill")
                    .foregroundStyle(LiftMarkTheme.success)
            case .skipped:
                Image(systemName: "forward.fill")
                    .foregroundStyle(.secondary)
            case .failed:
                Image(systemName: "xmark.circle.fill")
                    .foregroundStyle(LiftMarkTheme.destructive)
            case .pending:
                Image(systemName: "circle")
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.vertical, 2)
    }

    // MARK: - Helpers

    private func statusColor(_ status: SetStatus) -> Color {
        switch status {
        case .completed: return LiftMarkTheme.success
        case .skipped: return LiftMarkTheme.warning
        case .failed: return LiftMarkTheme.destructive
        case .pending: return LiftMarkTheme.secondaryLabel
        }
    }

    private func formatVolume(_ volume: Double) -> String {
        if volume >= 1000 {
            return String(format: "%.1fk", volume / 1000)
        }
        return "\(Int(volume))"
    }

    private func exportSession() {
        guard let session else { return }
        let exportService = WorkoutExportService()
        do {
            let url = try exportService.exportSingleSessionAsJson(session)
            exportFileURL = url
            showShareSheet = true
        } catch {
            print("Failed to export session: \(error)")
        }
    }
}

// MARK: - Exercise History Sheet

struct ExerciseHistorySheetView: View {
    let exerciseName: String
    @Environment(\.dismiss) private var dismiss
    @State private var historyPoints: [ExerciseHistoryPoint] = []
    @State private var isLoading = true

    private var summaryStats: (sessions: Int, maxWeight: Double, avgReps: Double, totalVolume: Double) {
        let sessions = historyPoints.count
        let maxWeight = historyPoints.map(\.maxWeight).max() ?? 0
        let avgReps = historyPoints.isEmpty ? 0 : historyPoints.map(\.avgReps).reduce(0, +) / Double(historyPoints.count)
        let totalVolume = historyPoints.map(\.totalVolume).reduce(0, +)
        return (sessions, maxWeight, avgReps, totalVolume)
    }

    var body: some View {
        Group {
            if isLoading {
                ProgressView()
            } else if historyPoints.isEmpty {
                VStack(spacing: LiftMarkTheme.spacingMD) {
                    Image(systemName: "chart.line.downtrend.xyaxis")
                        .font(.largeTitle)
                        .foregroundStyle(.secondary)
                    Text("No history for this exercise")
                        .foregroundStyle(.secondary)
                }
            } else {
                ScrollView {
                    VStack(alignment: .leading, spacing: LiftMarkTheme.spacingMD) {
                        // Summary card
                        summaryCard

                        // Chart
                        ExerciseHistoryChartView(exerciseName: exerciseName)
                            .padding()
                            .background(LiftMarkTheme.secondaryBackground)
                            .clipShape(RoundedRectangle(cornerRadius: LiftMarkTheme.cornerRadiusMD))

                        // Session list
                        Text("Sessions")
                            .font(.headline)

                        ForEach(historyPoints, id: \.date) { point in
                            historyPointRow(point)
                        }
                    }
                    .padding()
                }
            }
        }
        .navigationTitle(exerciseName)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("Done") { dismiss() }
            }
        }
        .onAppear { loadHistory() }
    }

    @ViewBuilder
    private var summaryCard: some View {
        let stats = summaryStats
        HStack(spacing: LiftMarkTheme.spacingMD) {
            VStack {
                Text("\(stats.sessions)")
                    .font(.title3).fontWeight(.bold)
                Text("Sessions")
                    .font(.caption).foregroundStyle(.secondary)
            }.frame(maxWidth: .infinity)

            VStack {
                Text("\(Int(stats.maxWeight))")
                    .font(.title3).fontWeight(.bold)
                Text("Max Weight")
                    .font(.caption).foregroundStyle(.secondary)
            }.frame(maxWidth: .infinity)

            VStack {
                Text(String(format: "%.1f", stats.avgReps))
                    .font(.title3).fontWeight(.bold)
                Text("Avg Reps")
                    .font(.caption).foregroundStyle(.secondary)
            }.frame(maxWidth: .infinity)

            VStack {
                Text(formatVolume(stats.totalVolume))
                    .font(.title3).fontWeight(.bold)
                Text("Total Vol")
                    .font(.caption).foregroundStyle(.secondary)
            }.frame(maxWidth: .infinity)
        }
        .padding()
        .background(LiftMarkTheme.secondaryBackground)
        .clipShape(RoundedRectangle(cornerRadius: LiftMarkTheme.cornerRadiusMD))
    }

    @ViewBuilder
    private func historyPointRow(_ point: ExerciseHistoryPoint) -> some View {
        VStack(alignment: .leading, spacing: LiftMarkTheme.spacingXS) {
            HStack {
                Text(point.workoutName)
                    .font(.subheadline)
                    .fontWeight(.medium)
                Spacer()
                Text(formatDate(point.date))
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            HStack(spacing: LiftMarkTheme.spacingMD) {
                if point.maxWeight > 0 {
                    Label("\(Int(point.maxWeight)) \(point.unit.rawValue)", systemImage: "scalemass")
                }
                Label("\(point.setsCount) sets", systemImage: "number")
                if point.totalVolume > 0 {
                    Label(formatVolume(point.totalVolume), systemImage: "chart.bar")
                }
            }
            .font(.caption)
            .foregroundStyle(.secondary)
        }
        .padding()
        .background(LiftMarkTheme.secondaryBackground)
        .clipShape(RoundedRectangle(cornerRadius: LiftMarkTheme.cornerRadiusSM))
    }

    private func loadHistory() {
        let repo = ExerciseHistoryRepository()
        do {
            historyPoints = try repo.getHistory(forExercise: exerciseName)
        } catch {
            print("Failed to load history: \(error)")
        }
        isLoading = false
    }

    private func formatDate(_ dateString: String) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        guard let date = formatter.date(from: String(dateString.prefix(10))) else { return dateString }
        let displayFormatter = DateFormatter()
        displayFormatter.dateStyle = .medium
        return displayFormatter.string(from: date)
    }

    private func formatVolume(_ volume: Double) -> String {
        if volume >= 1000 {
            return String(format: "%.1fk", volume / 1000)
        }
        return "\(Int(volume))"
    }
}
