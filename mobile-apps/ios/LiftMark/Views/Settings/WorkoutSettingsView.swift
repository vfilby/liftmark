import SwiftUI

struct WorkoutSettingsView: View {
    @Environment(SettingsStore.self) private var settingsStore

    var body: some View {
        List {
            if let settings = settingsStore.settings {
                Section("Units") {
                    HStack {
                        Text("Default Weight Unit")
                        Spacer()
                        Picker("Unit", selection: Binding(
                            get: { settings.defaultWeightUnit },
                            set: { newUnit in
                                var updated = settings
                                updated.defaultWeightUnit = newUnit
                                settingsStore.updateSettings(updated)
                            }
                        )) {
                            Text("lbs").tag(WeightUnit.lbs)
                                .accessibilityIdentifier("button-unit-lbs")
                            Text("kg").tag(WeightUnit.kg)
                                .accessibilityIdentifier("button-unit-kg")
                        }
                        .pickerStyle(.segmented)
                        .frame(width: 120)
                    }

                    HStack {
                        Text("Weight Step")
                        Spacer()
                        Picker("Weight Step", selection: Binding(
                            get: { settings.defaultWeightStepLbs },
                            set: { newStep in
                                var updated = settings
                                updated.defaultWeightStepLbs = newStep
                                settingsStore.updateSettings(updated)
                            }
                        )) {
                            Text(settings.defaultWeightUnit == .kg ? "1.25 kg" : "2.5 lbs").tag(2.5)
                                .accessibilityIdentifier("button-step-fine")
                            Text(settings.defaultWeightUnit == .kg ? "2.5 kg" : "5 lbs").tag(5.0)
                                .accessibilityIdentifier("button-step-coarse")
                        }
                        .pickerStyle(.segmented)
                        .frame(width: 160)
                    }
                }

                Section("Rest Timer") {
                    Toggle("Workout Timer", isOn: Binding(
                        get: { settings.enableWorkoutTimer },
                        set: { newValue in
                            var updated = settings
                            updated.enableWorkoutTimer = newValue
                            settingsStore.updateSettings(updated)
                        }
                    ))
                    .accessibilityIdentifier("switch-workout-timer")

                    Toggle("Auto-Start Rest Timer", isOn: Binding(
                        get: { settings.autoStartRestTimer },
                        set: { newValue in
                            var updated = settings
                            updated.autoStartRestTimer = newValue
                            settingsStore.updateSettings(updated)
                        }
                    ))
                    .accessibilityIdentifier("switch-auto-start-rest")

                    Toggle("Countdown Sounds", isOn: Binding(
                        get: { settings.countdownSoundsEnabled },
                        set: { newValue in
                            var updated = settings
                            updated.countdownSoundsEnabled = newValue
                            settingsStore.updateSettings(updated)
                        }
                    ))
                    .accessibilityIdentifier("switch-countdown-sounds")

                    Toggle("Start Timer in Countdown Mode", isOn: Binding(
                        get: { settings.defaultTimerCountdown },
                        set: { newValue in
                            var updated = settings
                            updated.defaultTimerCountdown = newValue
                            settingsStore.updateSettings(updated)
                        }
                    ))
                    .accessibilityIdentifier("switch-default-timer-countdown")
                }

                Section("Screen") {
                    Toggle("Keep Screen Awake", isOn: Binding(
                        get: { settings.keepScreenAwake },
                        set: { newValue in
                            var updated = settings
                            updated.keepScreenAwake = newValue
                            settingsStore.updateSettings(updated)
                        }
                    ))
                    .accessibilityIdentifier("switch-keep-screen-awake")
                }
            }
        }
        .accessibilityIdentifier("workout-settings-screen")
        .navigationTitle("Workout Settings")
    }
}
