import SwiftUI
#if canImport(UIKit)
import UIKit
#endif

struct DebugLogsView: View {
    @State private var isLoading = true
    @State private var logs: [LogEntry] = []
    @State private var selectedLevel: LogLevel? = nil
    @State private var showClearConfirmation = false
    @State private var showShareSheet = false
    @State private var shareURL: URL?

    private var filteredLogs: [LogEntry] {
        if let level = selectedLevel {
            return logs.filter { $0.level == level }
        }
        return logs
    }

    private var logStats: [LogLevel: Int] {
        var stats: [LogLevel: Int] = [:]
        for log in logs {
            stats[log.level, default: 0] += 1
        }
        return stats
    }

    var body: some View {
        Group {
            if isLoading {
                ProgressView()
                    .accessibilityIdentifier("debug-logs-loading")
            } else if logs.isEmpty {
                VStack(spacing: LiftMarkTheme.spacingMD) {
                    Image(systemName: "doc.text")
                        .font(.largeTitle)
                        .foregroundStyle(.secondary)
                    Text("No Logs")
                        .font(.headline)
                    Text("Debug logs will appear here.")
                        .foregroundStyle(.secondary)
                }
                .accessibilityIdentifier("debug-logs-empty")
            } else {
                VStack(spacing: 0) {
                    // Device info + stats header
                    deviceInfoHeader

                    // Filter bar
                    filterBar

                    // Log entries
                    ScrollView {
                        LazyVStack(alignment: .leading, spacing: LiftMarkTheme.spacingXS) {
                            ForEach(filteredLogs, id: \.id) { entry in
                                LogEntryRow(entry: entry)
                            }
                        }
                        .padding()
                    }
                    .accessibilityIdentifier("debug-logs-list")
                }
            }
        }
        .accessibilityIdentifier("debug-logs-screen")
        .navigationTitle("Debug Logs")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Menu {
                    Button {
                        shareLogs()
                    } label: {
                        Label("Share Logs", systemImage: "square.and.arrow.up")
                    }
                    .accessibilityIdentifier("debug-logs-share")

                    Button {
                        copyLogsToClipboard()
                    } label: {
                        Label("Copy to Clipboard", systemImage: "doc.on.clipboard")
                    }
                    .accessibilityIdentifier("debug-logs-export")

                    Button(role: .destructive) {
                        showClearConfirmation = true
                    } label: {
                        Label("Clear Logs", systemImage: "trash")
                    }
                    .accessibilityIdentifier("debug-logs-clear")
                } label: {
                    Image(systemName: "ellipsis.circle")
                }
                .accessibilityIdentifier("debug-logs-actions")
            }
        }
        .alert("Clear Logs", isPresented: $showClearConfirmation) {
            Button("Clear", role: .destructive) {
                Logger.shared.clearLogs()
                logs = []
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Are you sure you want to clear all debug logs?")
        }
        .sheet(isPresented: $showShareSheet) {
            if let shareURL {
                ShareSheet(items: [shareURL])
            }
        }
        .onAppear {
            loadLogs()
        }
    }

    // MARK: - Device Info Header

    @ViewBuilder
    private var deviceInfoHeader: some View {
        let info = Logger.shared.getDeviceInformation()
        VStack(alignment: .leading, spacing: LiftMarkTheme.spacingXS) {
            HStack {
                Text("Device:")
                    .font(.caption)
                    .fontWeight(.medium)
                Text("\(info.platform) \(info.osVersion)")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                if info.isSimulator {
                    Text("(Simulator)")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }

            HStack {
                Text("App:")
                    .font(.caption)
                    .fontWeight(.medium)
                Text("v\(info.appVersion) (\(info.buildType))")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            HStack(spacing: LiftMarkTheme.spacingMD) {
                ForEach(LogLevel.allCases, id: \.self) { level in
                    let count = logStats[level] ?? 0
                    HStack(spacing: 2) {
                        Circle()
                            .fill(logLevelColor(level))
                            .frame(width: 6, height: 6)
                        Text("\(count)")
                            .font(.caption)
                            .fontWeight(.medium)
                        Text(level.rawValue)
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                }
            }
        }
        .padding()
        .background(LiftMarkTheme.secondaryBackground)
    }

    // MARK: - Filter Bar

    @ViewBuilder
    private var filterBar: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: LiftMarkTheme.spacingSM) {
                FilterChip(label: "All", isSelected: selectedLevel == nil) {
                    selectedLevel = nil
                }
                ForEach(LogLevel.allCases, id: \.self) { level in
                    FilterChip(
                        label: level.rawValue.capitalized,
                        isSelected: selectedLevel == level,
                        color: logLevelColor(level)
                    ) {
                        selectedLevel = selectedLevel == level ? nil : level
                    }
                }
            }
            .padding(.horizontal)
            .padding(.vertical, LiftMarkTheme.spacingSM)
        }
    }

    // MARK: - Actions

    private func loadLogs() {
        logs = Logger.shared.getLogs(limit: 200)
        isLoading = false
    }

    private func shareLogs() {
        let logText = Logger.shared.exportLogs()
        let timestamp = ISO8601DateFormatter().string(from: Date())
            .replacingOccurrences(of: ":", with: "-")
            .replacingOccurrences(of: ".", with: "-")
        let fileName = "liftmark_debug_logs_\(timestamp).json"
        let tempURL = FileManager.default.temporaryDirectory.appendingPathComponent(fileName)

        do {
            try logText.write(to: tempURL, atomically: true, encoding: .utf8)
            shareURL = tempURL
            showShareSheet = true
        } catch {
            print("Failed to write log file: \(error)")
        }
    }

    private func copyLogsToClipboard() {
        let logText = Logger.shared.exportLogs()
        #if canImport(UIKit)
        UIPasteboard.general.string = logText
        #endif
    }

    // MARK: - Helpers

    private func logLevelColor(_ level: LogLevel) -> Color {
        switch level {
        case .debug: return .gray
        case .info: return LiftMarkTheme.primary
        case .warn: return LiftMarkTheme.warning
        case .error: return LiftMarkTheme.destructive
        }
    }
}

// MARK: - Log Entry Row

private struct LogEntryRow: View {
    let entry: LogEntry
    @State private var isExpanded = false

    private var levelColor: Color {
        switch entry.level {
        case .debug: return .gray
        case .info: return LiftMarkTheme.primary
        case .warn: return LiftMarkTheme.warning
        case .error: return LiftMarkTheme.destructive
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: LiftMarkTheme.spacingXS) {
            HStack(alignment: .top) {
                Circle()
                    .fill(levelColor)
                    .frame(width: 8, height: 8)
                    .padding(.top, 4)

                VStack(alignment: .leading, spacing: 2) {
                    HStack {
                        Text(formatTimestamp(entry.timestamp))
                            .font(.system(.caption2, design: .monospaced))
                            .foregroundStyle(.secondary)
                        Text(entry.category.rawValue)
                            .font(.caption2)
                            .padding(.horizontal, 4)
                            .padding(.vertical, 1)
                            .background(LiftMarkTheme.secondaryBackground)
                            .clipShape(Capsule())
                    }

                    Text(entry.message)
                        .font(.system(.caption, design: .monospaced))
                        .lineLimit(isExpanded ? nil : 2)
                }

                Spacer()

                if entry.metadata != nil || entry.stackTrace != nil {
                    Button {
                        isExpanded.toggle()
                    } label: {
                        Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                            .font(.caption)
                    }
                    .buttonStyle(.plain)
                }
            }

            if isExpanded {
                if let metadata = entry.metadata, !metadata.isEmpty {
                    let formatted = metadata.map { "\($0.key): \($0.value)" }.joined(separator: "\n")
                    Text(formatted)
                        .font(.system(.caption2, design: .monospaced))
                        .foregroundStyle(.secondary)
                        .padding(.leading, LiftMarkTheme.spacingMD)
                }
                if let stackTrace = entry.stackTrace {
                    Text(stackTrace)
                        .font(.system(.caption2, design: .monospaced))
                        .foregroundStyle(LiftMarkTheme.destructive.opacity(0.8))
                        .padding(.leading, LiftMarkTheme.spacingMD)
                }
            }
        }
        .padding(.vertical, LiftMarkTheme.spacingXS)
    }

    private func formatTimestamp(_ timestamp: String) -> String {
        guard let date = ISO8601DateFormatter().date(from: timestamp) else {
            return timestamp
        }
        let formatter = DateFormatter()
        formatter.dateFormat = "HH:mm:ss.SSS"
        return formatter.string(from: date)
    }
}

// MARK: - Filter Chip

private struct FilterChip: View {
    let label: String
    let isSelected: Bool
    var color: Color = LiftMarkTheme.primary
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(label)
                .font(.caption)
                .fontWeight(isSelected ? .semibold : .regular)
                .padding(.horizontal, LiftMarkTheme.spacingSM)
                .padding(.vertical, LiftMarkTheme.spacingXS)
                .background(isSelected ? color.opacity(0.15) : Color.clear)
                .foregroundStyle(isSelected ? color : .secondary)
                .clipShape(Capsule())
                .overlay(
                    Capsule()
                        .strokeBorder(isSelected ? color.opacity(0.3) : Color.secondary.opacity(0.2), lineWidth: 1)
                )
        }
        .buttonStyle(.plain)
    }
}
