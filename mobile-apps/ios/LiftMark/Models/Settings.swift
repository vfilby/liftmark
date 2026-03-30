import Foundation

// MARK: - UserSettings

struct UserSettings: Identifiable, Codable, Hashable {
    var id: String
    var defaultWeightUnit: WeightUnit
    var enableWorkoutTimer: Bool
    var autoStartRestTimer: Bool
    var theme: AppTheme
    var notificationsEnabled: Bool
    var customPromptAddition: String?
    var anthropicApiKey: String? // Stored in Keychain, NOT in DB
    var anthropicApiKeyStatus: ApiKeyStatus?
    var healthKitEnabled: Bool
    var liveActivitiesEnabled: Bool
    var keepScreenAwake: Bool
    var showOpenInClaudeButton: Bool
    var developerModeEnabled: Bool
    var countdownSoundsEnabled: Bool
    var hasAcceptedDisclaimer: Bool
    var homeTiles: [String]?
    var createdAt: String
    var updatedAt: String

    init(
        id: String = UUID().uuidString,
        defaultWeightUnit: WeightUnit = .lbs,
        enableWorkoutTimer: Bool = true,
        autoStartRestTimer: Bool = true,
        theme: AppTheme = .auto,
        notificationsEnabled: Bool = true,
        customPromptAddition: String? = nil,
        anthropicApiKey: String? = nil,
        anthropicApiKeyStatus: ApiKeyStatus? = .notSet,
        healthKitEnabled: Bool = false,
        liveActivitiesEnabled: Bool = true,
        keepScreenAwake: Bool = true,
        showOpenInClaudeButton: Bool = false,
        developerModeEnabled: Bool = false,
        countdownSoundsEnabled: Bool = true,
        hasAcceptedDisclaimer: Bool = false,
        homeTiles: [String]? = ["Back Squat", "Deadlift", "Bench Press", "Overhead Press"],
        createdAt: String = ISO8601DateFormatter().string(from: Date()),
        updatedAt: String = ISO8601DateFormatter().string(from: Date())
    ) {
        self.id = id
        self.defaultWeightUnit = defaultWeightUnit
        self.enableWorkoutTimer = enableWorkoutTimer
        self.autoStartRestTimer = autoStartRestTimer
        self.theme = theme
        self.notificationsEnabled = notificationsEnabled
        self.customPromptAddition = customPromptAddition
        self.anthropicApiKey = anthropicApiKey
        self.anthropicApiKeyStatus = anthropicApiKeyStatus
        self.healthKitEnabled = healthKitEnabled
        self.liveActivitiesEnabled = liveActivitiesEnabled
        self.keepScreenAwake = keepScreenAwake
        self.showOpenInClaudeButton = showOpenInClaudeButton
        self.developerModeEnabled = developerModeEnabled
        self.countdownSoundsEnabled = countdownSoundsEnabled
        self.hasAcceptedDisclaimer = hasAcceptedDisclaimer
        self.homeTiles = homeTiles
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }
    /// Returns true if any syncable field differs from another settings instance.
    /// Local-only fields (hasAcceptedDisclaimer, developerModeEnabled, anthropicApiKey/Status) are excluded.
    func hasSyncableChanges(from other: UserSettings) -> Bool {
        defaultWeightUnit != other.defaultWeightUnit ||
        enableWorkoutTimer != other.enableWorkoutTimer ||
        autoStartRestTimer != other.autoStartRestTimer ||
        theme != other.theme ||
        notificationsEnabled != other.notificationsEnabled ||
        customPromptAddition != other.customPromptAddition ||
        healthKitEnabled != other.healthKitEnabled ||
        liveActivitiesEnabled != other.liveActivitiesEnabled ||
        keepScreenAwake != other.keepScreenAwake ||
        showOpenInClaudeButton != other.showOpenInClaudeButton ||
        countdownSoundsEnabled != other.countdownSoundsEnabled ||
        homeTiles != other.homeTiles
    }
}
