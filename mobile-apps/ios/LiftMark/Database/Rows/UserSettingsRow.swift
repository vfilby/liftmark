import Foundation
import GRDB

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
    var anthropicApiKeyStatus: String?
    var healthkitEnabled: Int // SQLite boolean
    var liveActivitiesEnabled: Int // SQLite boolean
    var keepScreenAwake: Int // SQLite boolean
    var showOpenInClaudeButton: Int // SQLite boolean
    var developerModeEnabled: Int // SQLite boolean
    var countdownSoundsEnabled: Int // SQLite boolean
    var hasAcceptedDisclaimer: Int // SQLite boolean
    var defaultTimerCountdown: Int // SQLite boolean
    var defaultWeightStepLbs: Double
    var aiPromptIncludeFormatPointer: Int // SQLite boolean
    var aiPromptIncludeRecentWorkouts: Int // SQLite boolean
    var aiPromptIncludeProgression: Int // SQLite boolean
    var aiPromptIncludeEquipment: Int // SQLite boolean
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
        case anthropicApiKeyStatus = "anthropic_api_key_status"
        case healthkitEnabled = "healthkit_enabled"
        case liveActivitiesEnabled = "live_activities_enabled"
        case keepScreenAwake = "keep_screen_awake"
        case showOpenInClaudeButton = "show_open_in_claude_button"
        case developerModeEnabled = "developer_mode_enabled"
        case countdownSoundsEnabled = "countdown_sounds_enabled"
        case hasAcceptedDisclaimer = "has_accepted_disclaimer"
        case defaultTimerCountdown = "default_timer_countdown"
        case defaultWeightStepLbs = "default_weight_step_lbs"
        case aiPromptIncludeFormatPointer = "ai_prompt_include_format_pointer"
        case aiPromptIncludeRecentWorkouts = "ai_prompt_include_recent_workouts"
        case aiPromptIncludeProgression = "ai_prompt_include_progression"
        case aiPromptIncludeEquipment = "ai_prompt_include_equipment"
        case homeTiles = "home_tiles"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}
