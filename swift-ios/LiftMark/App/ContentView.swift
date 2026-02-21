import SwiftUI

struct ContentView: View {
    var body: some View {
        TabView {
            NavigationStack {
                HomeView()
            }
            .tabItem {
                Label("LiftMark", systemImage: "house")
            }
            .accessibilityIdentifier("tab-home")

            NavigationStack {
                WorkoutsView()
            }
            .tabItem {
                Label("Plans", systemImage: "doc.on.clipboard")
            }
            .accessibilityIdentifier("tab-workouts")

            NavigationStack {
                HistoryView()
            }
            .tabItem {
                Label("Workouts", systemImage: "dumbbell")
            }
            .accessibilityIdentifier("tab-history")

            NavigationStack {
                SettingsView()
            }
            .tabItem {
                Label("Settings", systemImage: "gearshape")
            }
            .accessibilityIdentifier("tab-settings")
        }
        .tint(LiftMarkTheme.tabIconSelected)
    }
}
