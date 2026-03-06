import Foundation
import GRDB

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
        self.homeTiles = homeTiles
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }
}

// MARK: - UserSettingsRow (GRDB Record)

struct UserSettingsRow: Codable, FetchableRecord, PersistableRecord, Hashable {
    static let databaseTableName = "user_settings"

    var id: String
    var defaultWeightUnit: String
    var enableWorkoutTimer: Int // SQLite boolean
    var autoStartRestTimer: Int // SQLite boolean
    var theme: String
    var notificationsEnabled: Int // SQLite boolean
    var customPromptAddition: String?
    var anthropicApiKey: String?
    var anthropicApiKeyStatus: String?
    var healthkitEnabled: Int // SQLite boolean
    var liveActivitiesEnabled: Int // SQLite boolean
    var keepScreenAwake: Int // SQLite boolean
    var showOpenInClaudeButton: Int // SQLite boolean
    var developerModeEnabled: Int // SQLite boolean
    var homeTiles: String? // JSON array
    var createdAt: String
    var updatedAt: String

    enum CodingKeys: String, CodingKey {
        case id
        case defaultWeightUnit = "default_weight_unit"
        case enableWorkoutTimer = "enable_workout_timer"
        case autoStartRestTimer = "auto_start_rest_timer"
        case theme
        case notificationsEnabled = "notifications_enabled"
        case customPromptAddition = "custom_prompt_addition"
        case anthropicApiKey = "anthropic_api_key"
        case anthropicApiKeyStatus = "anthropic_api_key_status"
        case healthkitEnabled = "healthkit_enabled"
        case liveActivitiesEnabled = "live_activities_enabled"
        case keepScreenAwake = "keep_screen_awake"
        case showOpenInClaudeButton = "show_open_in_claude_button"
        case developerModeEnabled = "developer_mode_enabled"
        case homeTiles = "home_tiles"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}
