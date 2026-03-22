import SwiftUI

struct ContentView: View {
    @Binding var pendingImportContent: String?
    @Environment(SettingsStore.self) private var settingsStore
    @State private var showPendingImport = false
    @State private var showOnboarding = false
    @State private var navCoordinator = NavigationCoordinator()

    private var colorScheme: ColorScheme? {
        switch settingsStore.settings?.theme ?? .auto {
        case .light: return .light
        case .dark: return .dark
        case .auto: return nil
        }
    }

    var body: some View {
        TabView {
            NavigationStack(path: $navCoordinator.homeNavPath) {
                HomeView()
            }
            .environment(navCoordinator)
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
        .preferredColorScheme(colorScheme)
        .fullScreenCover(isPresented: $showOnboarding) {
            OnboardingView {
                guard var updated = settingsStore.settings else { return }
                updated.hasAcceptedDisclaimer = true
                settingsStore.updateSettings(updated)
                showOnboarding = false
            }
        }
        .onAppear {
            updateOnboardingState()
        }
        .onChange(of: settingsStore.settings?.hasAcceptedDisclaimer) {
            updateOnboardingState()
        }
        .sheet(isPresented: $showPendingImport) {
            ImportView(initialContent: pendingImportContent ?? "")
                .onDisappear {
                    pendingImportContent = nil
                }
        }
        .onChange(of: pendingImportContent) {
            if pendingImportContent != nil {
                showPendingImport = true
            }
        }
    }

    private func updateOnboardingState() {
        let needsOnboarding = settingsStore.settings != nil && !(settingsStore.settings?.hasAcceptedDisclaimer ?? false)
        if needsOnboarding != showOnboarding {
            showOnboarding = needsOnboarding
        }
    }
}
