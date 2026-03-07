import SwiftUI
import UniformTypeIdentifiers

struct SettingsView: View {
    @Environment(SettingsStore.self) private var settingsStore
    @Environment(GymStore.self) private var gymStore
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
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
    @State private var selectedSection: SettingsSection? = .appearance
    @State private var versionTapCount = 0
    @State private var versionTapTimer: Timer?
    @State private var showDeveloperModeAlert = false
    @State private var developerModeAlertMessage = ""

    var body: some View {
        Group {
            if let settings = settingsStore.settings {
                if horizontalSizeClass == .regular {
                    iPadLayout(settings: settings)
                } else {
                    iPhoneLayout(settings: settings)
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
        .alert(
            settingsStore.settings?.developerModeEnabled == true ? "Developer Mode Enabled" : "Developer Mode Disabled",
            isPresented: $showDeveloperModeAlert
        ) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(developerModeAlertMessage)
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

    // MARK: - iPad Layout

    @ViewBuilder
    private func iPadLayout(settings: UserSettings) -> some View {
        HStack(spacing: 0) {
            // Left pane - navigation list
            List {
                ForEach(visibleSections(settings: settings)) { section in
                    Button {
                        selectedSection = section
                    } label: {
                        SettingsNavRow(section: section, isSelected: selectedSection == section)
                    }
                    .buttonStyle(.plain)
                    .listRowInsets(EdgeInsets(top: 2, leading: 8, bottom: 2, trailing: 8))
                }
            }
            .listStyle(.plain)
            .frame(width: 280)

            Divider()

            // Right pane - detail content
            Group {
                if let selectedSection {
                    iPadDetailContent(for: selectedSection, settings: settings)
                } else {
                    ContentUnavailableView("Select a Category", systemImage: "gear", description: Text("Choose a settings category from the sidebar."))
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }

    @ViewBuilder
    private func iPadDetailContent(for section: SettingsSection, settings: UserSettings) -> some View {
        switch section {
        case .appearance:
            List {
                Section(section.rawValue) {
                    appearanceContent(settings: settings)
                }
            }
        case .workout:
            WorkoutSettingsView()
        case .gyms:
            List {
                Section(section.rawValue) {
                    gymContent()
                }
            }
        case .integrations:
            List {
                Section("iCloud Sync") {
                    NavigationLink(value: AppDestination.syncSettings) {
                        Label("iCloud Sync", systemImage: "icloud")
                    }
                    .accessibilityIdentifier("sync-settings-button")
                }
                Section("Health & Activities") {
                    healthKitContent(settings: settings)
                    liveActivitiesContent(settings: settings)
                }
            }
        case .ai:
            List {
                Section(section.rawValue) {
                    aiContent(settings: settings)
                }
            }
        case .data:
            List {
                Section(section.rawValue) {
                    dataContent()
                }
            }
        case .developer:
            List {
                Section(section.rawValue) {
                    developerContent()
                }
            }
        case .about:
            List {
                Section(section.rawValue) {
                    aboutContent()
                }
                Section {
                    Text("LiftMark")
                        .frame(maxWidth: .infinity, alignment: .center)
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                        .listRowBackground(Color.clear)
                }
            }
        }
    }

    // MARK: - iPhone Layout

    @ViewBuilder
    private func iPhoneLayout(settings: UserSettings) -> some View {
        List {
            // Appearance
            Section("Appearance") {
                appearanceContent(settings: settings)
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
                gymContent()
            }

            // Integrations
            Section("Integrations") {
                NavigationLink(value: AppDestination.syncSettings) {
                    Label("iCloud Sync", systemImage: "icloud")
                }
                .accessibilityIdentifier("sync-settings-button")

                healthKitContent(settings: settings)
                liveActivitiesContent(settings: settings)
            }

            // AI Assistance
            Section("AI Assistance") {
                aiContent(settings: settings)
            }

            // Data Management
            Section("Data Management") {
                dataContent()
            }

            // Developer
            #if DEBUG
            Section("Developer") {
                developerContent()
            }
            #else
            if settings.developerModeEnabled {
                Section("Developer") {
                    developerContent()
                }
            }
            #endif

            // About
            Section("About") {
                aboutContent()
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
    }

    // MARK: - Shared Content Builders

    @ViewBuilder
    private func appearanceContent(settings: UserSettings) -> some View {
        Picker("Theme", selection: Binding(
            get: { settings.theme },
            set: { newTheme in
                var updated = settings
                updated.theme = newTheme
                settingsStore.updateSettings(updated)
            }
        )) {
            Text("Light").tag(AppTheme.light)
            Text("Dark").tag(AppTheme.dark)
            Text("Auto").tag(AppTheme.auto)
        }
        .pickerStyle(.segmented)
        .accessibilityIdentifier("picker-theme")
    }

    @ViewBuilder
    private func gymContent() -> some View {
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

    @ViewBuilder
    private func healthKitContent(settings: UserSettings) -> some View {
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
                    openUserSettings()
                } label: {
                    Text("Open Health Settings")
                        .font(.caption)
                        .foregroundStyle(LiftMarkTheme.primary)
                }
                .accessibilityIdentifier("healthkit-open-settings")
            }
        }
    }

    @ViewBuilder
    private func liveActivitiesContent(settings: UserSettings) -> some View {
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
                    openUserSettings()
                } label: {
                    Text("Open Settings to enable Live Activities")
                        .font(.caption)
                        .foregroundStyle(LiftMarkTheme.primary)
                }
                .accessibilityIdentifier("live-activities-open-settings")
            }
        }
    }

    @ViewBuilder
    private func aiContent(settings: UserSettings) -> some View {
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

    @ViewBuilder
    private func dataContent() -> some View {
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

    @ViewBuilder
    private func developerContent() -> some View {
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

    @ViewBuilder
    private func aboutContent() -> some View {
        Button {
            handleVersionTap()
        } label: {
            HStack {
                Text("Version")
                    .foregroundStyle(Color.primary)
                Spacer()
                Text(appVersionString)
                    .foregroundStyle(.secondary)
            }
        }
        .accessibilityIdentifier("version-info-row")
        HStack {
            Text("Build")
            Spacer()
            Text(appBuildString)
                .foregroundStyle(.secondary)
        }
    }

    // MARK: - Developer Mode

    private func handleVersionTap() {
        versionTapCount += 1
        versionTapTimer?.invalidate()
        versionTapTimer = Timer.scheduledTimer(withTimeInterval: 2.0, repeats: false) { [self] _ in
            Task { @MainActor in
                versionTapCount = 0
            }
        }

        if versionTapCount >= 7 {
            versionTapCount = 0
            versionTapTimer?.invalidate()
            guard var updated = settingsStore.settings else { return }
            updated.developerModeEnabled.toggle()
            settingsStore.updateSettings(updated)

            developerModeAlertMessage = updated.developerModeEnabled
                ? "Developer options are now visible in Settings."
                : "Developer options have been hidden."
            showDeveloperModeAlert = true
        }
    }

    private func visibleSections(settings: UserSettings) -> [SettingsSection] {
        #if DEBUG
        return SettingsSection.allCases
        #else
        return SettingsSection.allCases.filter { section in
            section != .developer || settings.developerModeEnabled
        }
        #endif
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

    private func openUserSettings() {
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

    // MARK: - Settings Section Enum

    private enum SettingsSection: String, CaseIterable, Identifiable {
        case appearance = "Appearance"
        case workout = "Workout Settings"
        case gyms = "Gyms"
        case integrations = "Integrations"
        case ai = "AI Assistance"
        case data = "Data Management"
        case developer = "Developer"
        case about = "About"

        var id: String { rawValue }

        var icon: String {
            switch self {
            case .appearance: return "paintbrush"
            case .workout: return "figure.strengthtraining.traditional"
            case .gyms: return "building.2"
            case .integrations: return "link"
            case .ai: return "brain"
            case .data: return "externaldrive"
            case .developer: return "hammer"
            case .about: return "info.circle"
            }
        }

        var iconColor: Color {
            switch self {
            case .appearance: return .purple
            case .workout: return .orange
            case .gyms: return .blue
            case .integrations: return .green
            case .ai: return .pink
            case .data: return .gray
            case .developer: return .yellow
            case .about: return .secondary
            }
        }
    }

    // MARK: - Settings Nav Row

    private struct SettingsNavRow: View {
        let section: SettingsSection
        let isSelected: Bool

        var body: some View {
            HStack(spacing: 12) {
                Image(systemName: section.icon)
                    .font(.body)
                    .foregroundStyle(section.iconColor)
                    .frame(width: 28, height: 28)
                    .background(section.iconColor.opacity(0.12))
                    .clipShape(RoundedRectangle(cornerRadius: 6))
                Text(section.rawValue)
                    .font(.body)
                Spacer()
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 10)
            .background(isSelected ? LiftMarkTheme.primary.opacity(0.12) : Color.clear)
            .clipShape(RoundedRectangle(cornerRadius: 8))
            .contentShape(Rectangle())
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
