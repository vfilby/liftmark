import Foundation
import GRDB

@Observable
final class SettingsStore {
    private(set) var settings: UserSettings?
    private(set) var isLoading = false

    func loadSettings() {
        isLoading = true
        defer { isLoading = false }
        do {
            let dbQueue = try DatabaseManager.shared.database()
            let row = try dbQueue.read { db in
                try UserSettingsRow.fetchOne(db)
            }
            guard let row else { return }
            settings = UserSettings(
                id: row.id,
                defaultWeightUnit: WeightUnit(rawValue: row.defaultWeightUnit) ?? .lbs,
                enableWorkoutTimer: row.enableWorkoutTimer != 0,
                autoStartRestTimer: row.autoStartRestTimer != 0,
                theme: AppTheme(rawValue: row.theme) ?? .auto,
                notificationsEnabled: row.notificationsEnabled != 0,
                customPromptAddition: row.customPromptAddition,
                anthropicApiKey: nil, // Stored in Keychain
                anthropicApiKeyStatus: row.anthropicApiKeyStatus.flatMap { ApiKeyStatus(rawValue: $0) },
                healthKitEnabled: row.healthkitEnabled != 0,
                liveActivitiesEnabled: row.liveActivitiesEnabled != 0,
                keepScreenAwake: row.keepScreenAwake != 0,
                showOpenInClaudeButton: row.showOpenInClaudeButton != 0,
                developerModeEnabled: row.developerModeEnabled != 0,
                countdownSoundsEnabled: row.countdownSoundsEnabled != 0,
                hasAcceptedDisclaimer: row.hasAcceptedDisclaimer != 0,
                homeTiles: row.homeTiles.flatMap { data in
                    (try? JSONDecoder().decode([String].self, from: Data(data.utf8)))
                },
                createdAt: row.createdAt,
                updatedAt: row.updatedAt
            )
        } catch {
            print("Failed to load settings: \(error)")
        }
    }

    func updateSettings(_ settings: UserSettings) {
        do {
            let dbQueue = try DatabaseManager.shared.database()
            let now = ISO8601DateFormatter().string(from: Date())
            let homeTilesJSON = settings.homeTiles.flatMap { try? String(data: JSONEncoder().encode($0), encoding: .utf8) }
            try dbQueue.write { db in
                try db.execute(sql: """
                    UPDATE user_settings SET
                        default_weight_unit = ?,
                        enable_workout_timer = ?,
                        auto_start_rest_timer = ?,
                        theme = ?,
                        notifications_enabled = ?,
                        custom_prompt_addition = ?,
                        anthropic_api_key_status = ?,
                        healthkit_enabled = ?,
                        live_activities_enabled = ?,
                        keep_screen_awake = ?,
                        show_open_in_claude_button = ?,
                        developer_mode_enabled = ?,
                        countdown_sounds_enabled = ?,
                        has_accepted_disclaimer = ?,
                        home_tiles = ?,
                        updated_at = ?
                    WHERE id = ?
                """, arguments: [
                    settings.defaultWeightUnit.rawValue,
                    settings.enableWorkoutTimer ? 1 : 0,
                    settings.autoStartRestTimer ? 1 : 0,
                    settings.theme.rawValue,
                    settings.notificationsEnabled ? 1 : 0,
                    settings.customPromptAddition,
                    settings.anthropicApiKeyStatus?.rawValue,
                    settings.healthKitEnabled ? 1 : 0,
                    settings.liveActivitiesEnabled ? 1 : 0,
                    settings.keepScreenAwake ? 1 : 0,
                    settings.showOpenInClaudeButton ? 1 : 0,
                    settings.developerModeEnabled ? 1 : 0,
                    settings.countdownSoundsEnabled ? 1 : 0,
                    settings.hasAcceptedDisclaimer ? 1 : 0,
                    homeTilesJSON,
                    now,
                    settings.id
                ])
            }
            let previousSettings = self.settings
            self.settings = settings
            // Only sync if a syncable field changed (not local-only fields like hasAcceptedDisclaimer)
            if previousSettings == nil || settings.hasSyncableChanges(from: previousSettings!) {
                CKSyncEngineManager.notifySave(recordType: "UserSettings", recordID: settings.id)
            }
        } catch {
            print("Failed to update settings: \(error)")
        }
    }
}
