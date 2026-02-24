import SwiftUI

struct SyncSettingsView: View {
    @Environment(SettingsStore.self) private var settingsStore
    @State private var accountStatus: CloudKitAccountStatus = .couldNotDetermine
    @State private var isCheckingStatus = false
    @State private var isSyncing = false

    var body: some View {
        List {
            // iCloud Status Section
            Section {
                HStack(spacing: LiftMarkTheme.spacingSM) {
                    Circle()
                        .fill(statusBadgeColor)
                        .frame(width: 12, height: 12)
                        .accessibilityIdentifier("sync-status-badge")

                    VStack(alignment: .leading, spacing: 2) {
                        Text(statusLabel)
                            .font(.subheadline.weight(.medium))
                            .accessibilityIdentifier("sync-status-label")

                        Text(statusDescription)
                            .font(.caption)
                            .foregroundStyle(LiftMarkTheme.secondaryLabel)
                            .accessibilityIdentifier("sync-status-description")
                    }
                }

                Button {
                    Task {
                        isCheckingStatus = true
                        accountStatus = await CloudKitService.shared.getAccountStatus()
                        isCheckingStatus = false
                    }
                } label: {
                    HStack {
                        Label("Check Status", systemImage: "arrow.clockwise")
                        if isCheckingStatus {
                            Spacer()
                            ProgressView()
                        }
                    }
                }
                .disabled(isCheckingStatus)
                .accessibilityIdentifier("sync-check-status")
            } header: {
                Text("iCloud Status")
            }

            // Sync Controls Section (only when available)
            if accountStatus == .available {
                Section("Sync Controls") {
                    Toggle(isOn: Binding(
                        get: { settingsStore.settings?.notificationsEnabled ?? false },
                        set: { newValue in
                            guard var settings = settingsStore.settings else { return }
                            settings.notificationsEnabled = newValue
                            settingsStore.updateSettings(settings)
                        }
                    )) {
                        Label("Enable Sync", systemImage: "arrow.triangle.2.circlepath")
                    }
                    .accessibilityIdentifier("switch-enable-sync")

                    HStack {
                        Text("Last Synced")
                        Spacer()
                        Text("Never")
                            .foregroundStyle(LiftMarkTheme.secondaryLabel)
                    }
                    .accessibilityIdentifier("sync-last-synced")

                    Button {
                        isSyncing = true
                        Task {
                            // Sync operation placeholder
                            try? await Task.sleep(nanoseconds: 1_000_000_000)
                            isSyncing = false
                        }
                    } label: {
                        HStack {
                            Label("Sync Now", systemImage: "arrow.triangle.2.circlepath")
                            if isSyncing {
                                Spacer()
                                ProgressView()
                            }
                        }
                    }
                    .disabled(isSyncing)
                    .accessibilityIdentifier("sync-now-button")
                }
            }

            // Sync Info Section (always visible)
            Section {
                Text("iCloud Sync keeps your workout plans, session history, and settings in sync across all your devices signed into the same iCloud account.")
                    .font(.subheadline)
                    .foregroundStyle(LiftMarkTheme.secondaryLabel)
                    .accessibilityIdentifier("sync-info-text")

                if accountStatus != .available {
                    Text("To use iCloud Sync, sign in to iCloud in your device's Settings app.")
                        .font(.subheadline)
                        .foregroundStyle(LiftMarkTheme.warning)
                }
            } header: {
                Text("About iCloud Sync")
            }
        }
        .accessibilityIdentifier("sync-settings-screen")
        .navigationTitle("iCloud Sync")
        #if os(iOS)
        .navigationBarTitleDisplayMode(.inline)
        #endif
        .onAppear {
            Task {
                isCheckingStatus = true
                accountStatus = await CloudKitService.shared.getAccountStatus()
                isCheckingStatus = false
            }
        }
    }

    // MARK: - Status Display

    private var statusBadgeColor: Color {
        switch accountStatus {
        case .available: return LiftMarkTheme.success
        case .noAccount: return .orange
        case .restricted: return LiftMarkTheme.destructive
        case .couldNotDetermine: return .gray
        case .error: return LiftMarkTheme.destructive
        }
    }

    private var statusLabel: String {
        switch accountStatus {
        case .available: return "iCloud Available"
        case .noAccount: return "No iCloud Account"
        case .restricted: return "Restricted"
        case .couldNotDetermine: return "Unknown"
        case .error: return "Error"
        }
    }

    private var statusDescription: String {
        switch accountStatus {
        case .available:
            return "Your iCloud account is connected and ready for sync."
        case .noAccount:
            return "Sign in to iCloud in your device Settings to enable sync."
        case .restricted:
            return "iCloud access is restricted on this device (e.g., parental controls)."
        case .couldNotDetermine:
            return "Could not determine iCloud status. Try again later."
        case .error:
            return "An error occurred checking iCloud status."
        }
    }
}
