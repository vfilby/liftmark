import SwiftUI

struct SettingsAboutSection: View {
    @Environment(SettingsStore.self) private var settingsStore
    @State private var versionTapCount = 0
    @State private var versionTapTimer: Timer?
    @State private var showDeveloperModeAlert = false
    @State private var developerModeAlertMessage = ""

    var body: some View {
        Group {
            Button {
                handleVersionTap()
            } label: {
                HStack {
                    Text("Version")
                        .foregroundStyle(Color.primary)
                    Spacer()
                    Text("\(appVersionString) (\(BuildInfo.gitHash))")
                        .foregroundStyle(.secondary)
                }
            }
            .accessibilityIdentifier("version-info-row")
            NavigationLink {
                DisclaimerView()
            } label: {
                Text("Disclaimer")
            }
            .accessibilityIdentifier("disclaimer-button")
            NavigationLink {
                SettingsOpenSourceView()
            } label: {
                Text("Open Source")
            }
            .accessibilityIdentifier("open-source-button")
        }
        .alert(
            settingsStore.settings?.developerModeEnabled == true ? "Developer Mode Enabled" : "Developer Mode Disabled",
            isPresented: $showDeveloperModeAlert
        ) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(developerModeAlertMessage)
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

    // MARK: - Helpers

    private var appVersionString: String {
        Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0.0"
    }
}
