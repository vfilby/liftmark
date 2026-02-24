import SwiftUI
import UniformTypeIdentifiers

struct SettingsView: View {
    @Environment(SettingsStore.self) private var settingsStore
    @Environment(GymStore.self) private var gymStore
    @State private var showApiKey = false
    @State private var apiKeyText = ""
    @State private var showExportConfirmation = false
    @State private var showImportSheet = false
    @State private var healthKitAuthStatus: HealthKitAuthStatus = .notDetermined
    @State private var liveActivitiesEnabled = false
    @State private var showExportError = false
    @State private var exportErrorMessage = ""
    @State private var exportURL: URL?
    @State private var showShareSheet = false
    @State private var showImportConfirm = false
    @State private var importSourceURL: URL?
    @State private var importIsDatabase = false
    @State private var showImportResult = false
    @State private var importResultMessage = ""
    @State private var showImportError = false
    @State private var importErrorMessage = ""

    var body: some View {
        Group {
            if let settings = settingsStore.settings {
                List {
                    // Appearance
                    Section("Appearance") {
                        HStack {
                            Text("Theme")
                            Spacer()
                            HStack(spacing: 0) {
                                themeButton("Light", theme: .light, currentTheme: settings.theme)
                                    .accessibilityIdentifier("button-theme-light")
                                themeButton("Dark", theme: .dark, currentTheme: settings.theme)
                                    .accessibilityIdentifier("button-theme-dark")
                                themeButton("Auto", theme: .auto, currentTheme: settings.theme)
                                    .accessibilityIdentifier("button-theme-auto")
                            }
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                            .frame(width: 200)
                        }
                    }

                    // Workout
                    Section("Workout") {
                        NavigationLink(value: AppDestination.workoutSettings) {
                            Text("Workout Settings")
                        }
                        .accessibilityIdentifier("workout-settings-button")
                    }

                    // Gym
                    Section("Gym") {
                        ForEach(gymStore.gyms) { gym in
                            NavigationLink(value: AppDestination.gymDetail(id: gym.id)) {
                                HStack {
                                    Image(systemName: gym.isDefault ? "star.fill" : "star")
                                        .foregroundStyle(gym.isDefault ? LiftMarkTheme.warning : LiftMarkTheme.secondaryLabel)
                                    Text(gym.name)
                                    Spacer()
                                    if gym.isDefault {
                                        Text("Default")
                                            .font(.caption)
                                            .fontWeight(.semibold)
                                            .foregroundStyle(LiftMarkTheme.warning)
                                            .padding(.horizontal, 8)
                                            .padding(.vertical, 2)
                                            .background(LiftMarkTheme.warning.opacity(0.12))
                                            .clipShape(RoundedRectangle(cornerRadius: 4))
                                    }
                                }
                            }
                            .accessibilityIdentifier("gym-item")
                        }

                        Button {
                            gymStore.createGym(name: "New Gym")
                        } label: {
                            Label("Add Gym", systemImage: "plus")
                        }
                        .accessibilityIdentifier("add-gym-button")
                    }

                    // Integrations
                    Section("Integrations") {
                        NavigationLink(value: AppDestination.syncSettings) {
                            Label("iCloud Sync", systemImage: "icloud")
                        }
                        .accessibilityIdentifier("sync-settings-button")

                        // HealthKit
                        VStack(alignment: .leading, spacing: LiftMarkTheme.spacingXS) {
                            Toggle(isOn: Binding(
                                get: { settings.healthKitEnabled },
                                set: { newValue in
                                    if newValue {
                                        Task {
                                            let granted = await HealthKitService.requestAuthorization()
                                            if granted {
                                                var updated = settings
                                                updated.healthKitEnabled = true
                                                settingsStore.updateSettings(updated)
                                                healthKitAuthStatus = .authorized
                                            } else {
                                                healthKitAuthStatus = .denied
                                            }
                                        }
                                    } else {
                                        var updated = settings
                                        updated.healthKitEnabled = false
                                        settingsStore.updateSettings(updated)
                                    }
                                }
                            )) {
                                Label("Apple Health", systemImage: "heart")
                            }
                            .disabled(healthKitAuthStatus == .denied)
                            .accessibilityIdentifier("switch-healthkit")

                            Text(healthKitStatusText)
                                .font(.caption)
                                .foregroundStyle(LiftMarkTheme.secondaryLabel)
                                .accessibilityIdentifier("healthkit-status-label")

                            if healthKitAuthStatus == .denied {
                                Button {
                                    openAppSettings()
                                } label: {
                                    Text("Open Health Settings")
                                        .font(.caption)
                                        .foregroundStyle(LiftMarkTheme.primary)
                                }
                                .accessibilityIdentifier("healthkit-open-settings")
                            }
                        }

                        // Live Activities
                        VStack(alignment: .leading, spacing: LiftMarkTheme.spacingXS) {
                            Toggle(isOn: Binding(
                                get: { settings.liveActivitiesEnabled },
                                set: { newValue in
                                    var updated = settings
                                    updated.liveActivitiesEnabled = newValue
                                    settingsStore.updateSettings(updated)
                                }
                            )) {
                                Label("Live Activities", systemImage: "rectangle.stack")
                            }
                            .disabled(!liveActivitiesEnabled)
                            .accessibilityIdentifier("switch-live-activities")

                            Text(liveActivitiesStatusText)
                                .font(.caption)
                                .foregroundStyle(LiftMarkTheme.secondaryLabel)
                                .accessibilityIdentifier("live-activities-status-label")

                            if !liveActivitiesEnabled {
                                Button {
                                    openAppSettings()
                                } label: {
                                    Text("Open Settings to enable Live Activities")
                                        .font(.caption)
                                        .foregroundStyle(LiftMarkTheme.primary)
                                }
                                .accessibilityIdentifier("live-activities-open-settings")
                            }
                        }
                    }

                    // AI Assistance
                    Section("AI Assistance") {
                        VStack(alignment: .leading, spacing: LiftMarkTheme.spacingSM) {
                            Text("Custom Prompt")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                            TextField("Additional instructions for AI...", text: Binding(
                                get: { settings.customPromptAddition ?? "" },
                                set: { newValue in
                                    var updated = settings
                                    updated.customPromptAddition = newValue.isEmpty ? nil : newValue
                                    settingsStore.updateSettings(updated)
                                }
                            ), axis: .vertical)
                            .lineLimit(2...4)
                        }
                        .accessibilityIdentifier("input-custom-prompt")

                        VStack(alignment: .leading, spacing: LiftMarkTheme.spacingSM) {
                            Text("API Key")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                            HStack(spacing: LiftMarkTheme.spacingSM) {
                                if showApiKey {
                                    TextField("API Key", text: $apiKeyText)
                                        .textContentType(.password)
                                        .autocorrectionDisabled()
                                } else {
                                    SecureField("Anthropic API Key", text: $apiKeyText)
                                }
                                Button {
                                    showApiKey.toggle()
                                } label: {
                                    Image(systemName: showApiKey ? "eye.slash" : "eye")
                                }
                                .buttonStyle(.plain)
                                .accessibilityIdentifier("toggle-api-key-visibility")

                                Button {
                                    saveApiKey()
                                } label: {
                                    Text("Save")
                                        .font(.subheadline.weight(.semibold))
                                        .padding(.horizontal, 14)
                                        .padding(.vertical, 6)
                                        .background(LiftMarkTheme.primary)
                                        .foregroundStyle(.white)
                                        .clipShape(RoundedRectangle(cornerRadius: 8))
                                }
                                .buttonStyle(.plain)
                                .accessibilityIdentifier("save-api-key-button")

                                Button {
                                    removeApiKey()
                                } label: {
                                    Text("Remove")
                                        .font(.subheadline.weight(.semibold))
                                        .padding(.horizontal, 14)
                                        .padding(.vertical, 6)
                                        .overlay(
                                            RoundedRectangle(cornerRadius: 8)
                                                .stroke(LiftMarkTheme.destructive, lineWidth: 1.5)
                                        )
                                        .foregroundStyle(LiftMarkTheme.destructive)
                                }
                                .buttonStyle(.plain)
                                .accessibilityIdentifier("remove-api-key-button")
                            }
                        }
                        .accessibilityIdentifier("input-api-key")

                        if let status = settings.anthropicApiKeyStatus {
                            HStack {
                                Circle()
                                    .fill(apiKeyStatusColor(status))
                                    .frame(width: 8, height: 8)
                                Text(apiKeyStatusLabel(status))
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }

                    // Data Management
                    Section("Data Management") {
                        Button {
                            exportData()
                        } label: {
                            Label("Export Data", systemImage: "square.and.arrow.up")
                        }
                        .accessibilityIdentifier("export-data-button")

                        Button {
                            showImportSheet = true
                        } label: {
                            Label("Import Data", systemImage: "square.and.arrow.down")
                        }
                        .accessibilityIdentifier("import-data-button")
                    }

                    // Developer
                    Section("Developer") {
                        NavigationLink(value: AppDestination.debugLogs) {
                            Label("Debug Logs", systemImage: "doc.text")
                        }
                        .accessibilityIdentifier("debug-logs-button")

                        Button {
                            exportDatabase()
                        } label: {
                            Label("Export Database", systemImage: "cylinder.split.1x2")
                        }
                        .accessibilityIdentifier("export-database-button")
                    }

                    // About
                    Section("About") {
                        HStack {
                            Text("Version")
                            Spacer()
                            Text(appVersionString)
                                .foregroundStyle(.secondary)
                        }
                        HStack {
                            Text("Build")
                            Spacer()
                            Text(appBuildString)
                                .foregroundStyle(.secondary)
                        }
                    }

                    // Footer
                    Section {
                        Text("LiftMark")
                            .frame(maxWidth: .infinity, alignment: .center)
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                            .listRowBackground(Color.clear)
                    }
                }
            } else {
                ProgressView()
                    .accessibilityIdentifier("settings-loading")
            }
        }
        .accessibilityIdentifier("settings-screen")
        .navigationTitle("Settings")
        .onAppear {
            checkHealthKitStatus()
            liveActivitiesEnabled = LiveActivityService.shared.isAvailable()
        }
        .navigationDestination(for: AppDestination.self) { destination in
            switch destination {
            case .workoutSettings:
                WorkoutSettingsView()
            case .gymDetail(let id):
                GymDetailView(gymId: id)
            case .syncSettings:
                SyncSettingsView()
            case .debugLogs:
                DebugLogsView()
            default:
                EmptyView()
            }
        }
        .modifier(DatabaseBackupModifiers(
            showShareSheet: $showShareSheet,
            exportURL: exportURL,
            showImportSheet: $showImportSheet,
            handleImportFileSelection: handleImportFileSelection,
            showExportError: $showExportError,
            exportErrorMessage: exportErrorMessage,
            showImportConfirm: $showImportConfirm,
            importIsDatabase: importIsDatabase,
            performImport: performImport,
            showImportResult: $showImportResult,
            importResultMessage: importResultMessage,
            showImportError: $showImportError,
            importErrorMessage: importErrorMessage
        ))
    }

    // MARK: - Helpers

    private var appVersionString: String {
        Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0.0"
    }

    private var appBuildString: String {
        Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "1"
    }

    // MARK: - API Key Actions

    private func saveApiKey() {
        let trimmed = apiKeyText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        do {
            try SecureStorage.storeApiKey(trimmed)
            guard var updated = settingsStore.settings else { return }
            updated.anthropicApiKeyStatus = .verified
            settingsStore.updateSettings(updated)
        } catch {
            guard var updated = settingsStore.settings else { return }
            updated.anthropicApiKeyStatus = .invalid
            settingsStore.updateSettings(updated)
        }
    }

    private func removeApiKey() {
        try? SecureStorage.removeApiKey()
        apiKeyText = ""
        guard var updated = settingsStore.settings else { return }
        updated.anthropicApiKeyStatus = .notSet
        settingsStore.updateSettings(updated)
    }

    private func apiKeyStatusColor(_ status: ApiKeyStatus) -> Color {
        switch status {
        case .verified: return LiftMarkTheme.success
        case .invalid: return LiftMarkTheme.destructive
        case .notSet: return LiftMarkTheme.secondaryLabel
        }
    }

    private func apiKeyStatusLabel(_ status: ApiKeyStatus) -> String {
        switch status {
        case .verified: return "Verified"
        case .invalid: return "Invalid"
        case .notSet: return "Not Set"
        }
    }

    // MARK: - Theme Button

    @ViewBuilder
    private func themeButton(_ label: String, theme: AppTheme, currentTheme: AppTheme) -> some View {
        Button {
            guard let settings = settingsStore.settings else { return }
            var updated = settings
            updated.theme = theme
            settingsStore.updateSettings(updated)
        } label: {
            Text(label)
                .font(.subheadline.weight(currentTheme == theme ? .semibold : .regular))
                .frame(maxWidth: .infinity)
                .padding(.vertical, 8)
                .background(currentTheme == theme ? LiftMarkTheme.primary : LiftMarkTheme.secondaryBackground)
                .foregroundStyle(currentTheme == theme ? .white : LiftMarkTheme.label)
        }
        .buttonStyle(.plain)
    }

    // MARK: - HealthKit Status

    private var healthKitStatusText: String {
        if !HealthKitService.isHealthKitAvailable() {
            return "HealthKit is not available on this device"
        }
        switch healthKitAuthStatus {
        case .notDetermined:
            return "Not connected"
        case .authorized:
            return "Connected"
        case .denied:
            return "Access denied — open Settings to enable"
        }
    }

    private func checkHealthKitStatus() {
        if !HealthKitService.isHealthKitAvailable() {
            return
        }
        if HealthKitService.isAuthorized() {
            healthKitAuthStatus = .authorized
        } else if settingsStore.settings?.healthKitEnabled == true {
            // Was enabled but now not authorized = denied
            healthKitAuthStatus = .denied
        } else {
            healthKitAuthStatus = .notDetermined
        }
    }

    // MARK: - Live Activities Status

    private var liveActivitiesStatusText: String {
        if liveActivitiesEnabled {
            return "Enabled"
        } else {
            return "Disabled — go to Settings to enable"
        }
    }

    // MARK: - Open Settings

    private func openAppSettings() {
        #if canImport(UIKit)
        if let url = URL(string: UIApplication.openSettingsURLString) {
            UIApplication.shared.open(url)
        }
        #endif
    }

    // MARK: - Data Export (JSON)

    private func exportData() {
        do {
            let service = WorkoutExportService()
            let url = try service.exportUnifiedJson()
            exportURL = url
            showShareSheet = true
        } catch {
            exportErrorMessage = error.localizedDescription
            showExportError = true
        }
    }

    // MARK: - Database Export

    private func exportDatabase() {
        do {
            let url = try DatabaseBackupService.exportDatabase()
            exportURL = url
            showShareSheet = true
        } catch {
            exportErrorMessage = error.localizedDescription
            showExportError = true
        }
    }

    // MARK: - Data Import (JSON + DB)

    private func handleImportFileSelection(_ result: Result<[URL], Error>) {
        switch result {
        case .success(let urls):
            guard let url = urls.first else { return }

            // Start accessing the security-scoped resource
            guard url.startAccessingSecurityScopedResource() else {
                importErrorMessage = "Unable to access the selected file."
                showImportError = true
                return
            }
            defer { url.stopAccessingSecurityScopedResource() }

            // Copy to a temporary location so we can validate and import later
            let tempURL = FileManager.default.temporaryDirectory
                .appendingPathComponent(url.lastPathComponent)
            try? FileManager.default.removeItem(at: tempURL)
            do {
                try FileManager.default.copyItem(at: url, to: tempURL)
            } catch {
                importErrorMessage = "Failed to copy file: \(error.localizedDescription)"
                showImportError = true
                return
            }

            let isJson = url.pathExtension.lowercased() == "json"

            if isJson {
                // Validate JSON
                let importService = JsonImportService()
                guard importService.validateJsonFile(at: tempURL) else {
                    try? FileManager.default.removeItem(at: tempURL)
                    importErrorMessage = "The selected file is not a valid LiftMark export."
                    showImportError = true
                    return
                }
                importSourceURL = tempURL
                importIsDatabase = false
                showImportConfirm = true
            } else {
                // Validate database
                guard DatabaseBackupService.validateDatabaseFile(at: tempURL) else {
                    try? FileManager.default.removeItem(at: tempURL)
                    importErrorMessage = "The selected file is not a valid LiftMark database."
                    showImportError = true
                    return
                }
                importSourceURL = tempURL
                importIsDatabase = true
                showImportConfirm = true
            }

        case .failure(let error):
            importErrorMessage = error.localizedDescription
            showImportError = true
        }
    }

    private func performImport() {
        guard let sourceURL = importSourceURL else { return }

        if importIsDatabase {
            // Database import (replaces all data)
            do {
                try DatabaseBackupService.importDatabase(from: sourceURL)
                try? FileManager.default.removeItem(at: sourceURL)
                importResultMessage = "Your data has been replaced successfully."
                showImportResult = true
            } catch {
                try? FileManager.default.removeItem(at: sourceURL)
                importErrorMessage = error.localizedDescription
                showImportError = true
            }
        } else {
            // JSON import (merges data)
            do {
                let importService = JsonImportService()
                let result = try importService.importUnifiedJson(from: sourceURL)
                try? FileManager.default.removeItem(at: sourceURL)
                importResultMessage = result.summary
                showImportResult = true
            } catch {
                try? FileManager.default.removeItem(at: sourceURL)
                importErrorMessage = error.localizedDescription
                showImportError = true
            }
        }
    }
}

// MARK: - Database Backup Modifiers

struct DatabaseBackupModifiers: ViewModifier {
    @Binding var showShareSheet: Bool
    let exportURL: URL?
    @Binding var showImportSheet: Bool
    let handleImportFileSelection: (Result<[URL], Error>) -> Void
    @Binding var showExportError: Bool
    let exportErrorMessage: String
    @Binding var showImportConfirm: Bool
    let importIsDatabase: Bool
    let performImport: () -> Void
    @Binding var showImportResult: Bool
    let importResultMessage: String
    @Binding var showImportError: Bool
    let importErrorMessage: String

    func body(content: Content) -> some View {
        content
            .sheet(isPresented: $showShareSheet) {
                if let exportURL {
                    ShareSheet(items: [exportURL])
                }
            }
            .fileImporter(
                isPresented: $showImportSheet,
                allowedContentTypes: [.json, .database, .data],
                allowsMultipleSelection: false
            ) { result in
                handleImportFileSelection(result)
            }
            .alert("Export Error", isPresented: $showExportError) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(exportErrorMessage)
            }
            .alert(importIsDatabase ? "Replace All Data?" : "Import Data?", isPresented: $showImportConfirm) {
                Button("Cancel", role: .cancel) {}
                Button(importIsDatabase ? "Replace" : "Import", role: importIsDatabase ? .destructive : nil) {
                    performImport()
                }
            } message: {
                if importIsDatabase {
                    Text("This will replace all your workout data with the imported database. This cannot be undone.")
                } else {
                    Text("This will merge the imported data with your existing data. Duplicate plans and sessions will be skipped.")
                }
            }
            .alert("Import Successful", isPresented: $showImportResult) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(importResultMessage)
            }
            .alert("Import Error", isPresented: $showImportError) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(importErrorMessage)
            }
    }
}

// MARK: - HealthKit Auth Status

enum HealthKitAuthStatus {
    case notDetermined
    case authorized
    case denied
}
