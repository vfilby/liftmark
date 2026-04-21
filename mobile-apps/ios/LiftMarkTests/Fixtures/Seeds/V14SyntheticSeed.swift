import Foundation

extension DatabaseSeeds {

    // MARK: - Synthetic future (v14) — used to verify early-return behavior

    static let v14SyntheticDDL: String = v13DDL  // same shape

    static let v14SyntheticData: String = #"""
    INSERT INTO user_settings
      (id, default_weight_unit, enable_workout_timer, auto_start_rest_timer, theme, notifications_enabled,
       anthropic_api_key_status, healthkit_enabled, live_activities_enabled, keep_screen_awake,
       show_open_in_claude_button, created_at, updated_at,
       developer_mode_enabled, countdown_sounds_enabled, has_accepted_disclaimer, default_timer_countdown)
    VALUES
      ('\#(userSettingsId)', 'lbs', 1, 1, 'auto', 1,
       'not_set', 0, 1, 1,
       0, '\#(ts1)', '\#(ts1)',
       0, 1, 0, 0);

    INSERT INTO gyms (id, name, is_default, created_at, updated_at, deleted_at) VALUES
      ('\#(gymHome)', 'Home Gym', 1, '\#(ts1)', '\#(ts1)', NULL);

    INSERT INTO schema_version (version) VALUES (14);
    """#
}
