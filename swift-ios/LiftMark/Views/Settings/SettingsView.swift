import SwiftUI

struct SettingsView: View {
    @Environment(SettingsStore.self) private var settingsStore
    @Environment(GymStore.self) private var gymStore
    @State private var showApiKey = false
    @State private var apiKeyText = ""
    @State private var showExportConfirmation = false
    @State private var showImportSheet = false

    var body: some View {
        Group {
            if let settings = settingsStore.settings {
                List {
                    // Preferences
                    Section("Preferences") {
                        HStack {
                            Text("Appearance")
                            Spacer()
                            Picker("Theme", selection: Binding(
                                get: { settings.theme },
                                set: { newTheme in
                                    var updated = settings
                                    updated.theme = newTheme
                                    settingsStore.updateSettings(updated)
                                }
                            )) {
                                Text("Light").tag(AppTheme.light)
                                    .accessibilityIdentifier("button-theme-light")
                                Text("Dark").tag(AppTheme.dark)
                                    .accessibilityIdentifier("button-theme-dark")
                                Text("Auto").tag(AppTheme.auto)
                                    .accessibilityIdentifier("button-theme-auto")
                            }
                            .pickerStyle(.segmented)
                            .frame(width: 200)
                        }
                    }

                    // Workout
                    Section("Workout") {
                        NavigationLink(value: AppDestination.workoutSettings) {
                            Label("Workout Settings", systemImage: "timer")
                        }
                        .accessibilityIdentifier("workout-settings-button")

                        // Gyms
                        ForEach(gymStore.gyms) { gym in
                            NavigationLink(value: AppDestination.gymDetail(id: gym.id)) {
                                HStack {
                                    Label(gym.name, systemImage: "building.2")
                                    Spacer()
                                    if gym.isDefault {
                                        Text("Default")
                                            .font(.caption)
                                            .padding(.horizontal, 6)
                                            .padding(.vertical, 2)
                                            .background(LiftMarkTheme.primary.opacity(0.1))
                                            .clipShape(Capsule())
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

                        Toggle(isOn: Binding(
                            get: { settings.healthKitEnabled },
                            set: { newValue in
                                var updated = settings
                                updated.healthKitEnabled = newValue
                                settingsStore.updateSettings(updated)
                            }
                        )) {
                            Label("Apple Health", systemImage: "heart")
                        }
                        .accessibilityIdentifier("switch-healthkit")

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
                        .accessibilityIdentifier("switch-live-activities")
                    }

                    // AI Assistance
                    Section("AI Assistance") {
                        VStack(alignment: .leading, spacing: LiftMarkTheme.spacingSM) {
                            Text("Custom Prompt Addition")
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

                        HStack {
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
                            showExportConfirmation = true
                        } label: {
                            Label("Export Database", systemImage: "square.and.arrow.up")
                        }
                        .accessibilityIdentifier("export-database-button")

                        Button {
                            showImportSheet = true
                        } label: {
                            Label("Import Workouts", systemImage: "square.and.arrow.down")
                        }
                        .accessibilityIdentifier("import-workouts-button")
                    }

                    // Developer
                    Section("Developer") {
                        NavigationLink(value: AppDestination.debugLogs) {
                            Label("Debug Logs", systemImage: "doc.text")
                        }
                        .accessibilityIdentifier("debug-logs-button")
                    }

                    // About
                    Section("About") {
                        HStack {
                            Text("Version")
                            Spacer()
                            Text(appVersion)
                                .foregroundStyle(.secondary)
                        }
                    }
                }
            } else {
                ProgressView()
                    .accessibilityIdentifier("settings-loading")
            }
        }
        .accessibilityIdentifier("settings-screen")
        .navigationTitle("Settings")
        .navigationDestination(for: AppDestination.self) { destination in
            switch destination {
            case .workoutSettings:
                WorkoutSettingsView()
            case .gymDetail(let id):
                GymDetailView(gymId: id)
            case .debugLogs:
                DebugLogsView()
            default:
                EmptyView()
            }
        }
    }

    // MARK: - Helpers

    private var appVersion: String {
        let version = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0.0"
        let build = Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "1"
        return "\(version) (\(build))"
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
}
