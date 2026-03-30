import SwiftUI

struct SettingsAISection: View {
    @Environment(SettingsStore.self) private var settingsStore
    @State private var showApiKey = false
    @State private var apiKeyText = ""

    var body: some View {
        if let settings = settingsStore.settings {
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
}
