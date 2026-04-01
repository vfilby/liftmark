import Foundation

@MainActor
@Observable
final class SettingsStore {
    private(set) var settings: UserSettings?
    private(set) var isLoading = false
    private(set) var lastError: Error?
    private let repository = SettingsRepository()

    func clearError() {
        lastError = nil
    }

    func loadSettings() {
        isLoading = true
        defer { isLoading = false }
        do {
            settings = try repository.get()
            lastError = nil
        } catch {
            lastError = error
            Logger.shared.error(.database, "Failed to load settings", error: error)
        }
    }

    func updateSettings(_ settings: UserSettings) {
        do {
            try repository.update(settings)
            let previousSettings = self.settings
            self.settings = settings
            lastError = nil
            // Only sync if a syncable field changed (not local-only fields like hasAcceptedDisclaimer)
            if previousSettings == nil || settings.hasSyncableChanges(from: previousSettings!) {
                CKSyncEngineManager.notifySave(recordType: "UserSettings", recordID: settings.id)
            }
        } catch {
            lastError = error
            Logger.shared.error(.database, "Failed to update settings", error: error)
        }
    }
}
