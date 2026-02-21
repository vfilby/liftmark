import SwiftUI

@main
struct LiftMarkApp: App {
    @State private var planStore = WorkoutPlanStore()
    @State private var sessionStore = SessionStore()
    @State private var settingsStore = SettingsStore()
    @State private var gymStore = GymStore()
    @State private var equipmentStore = EquipmentStore()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environment(planStore)
                .environment(sessionStore)
                .environment(settingsStore)
                .environment(gymStore)
                .environment(equipmentStore)
                .onAppear {
                    planStore.loadPlans()
                    sessionStore.loadSessions()
                    settingsStore.loadSettings()
                    gymStore.loadGyms()
                }
        }
    }
}
