import SwiftUI

@main
struct LiftMarkApp: App {
    @State private var planStore = WorkoutPlanStore()
    @State private var sessionStore = SessionStore()
    @State private var settingsStore = SettingsStore()
    @State private var gymStore = GymStore()
    @State private var equipmentStore = EquipmentStore()
    @State private var pendingImportContent: String?

    init() {
        // Reset data before any views load (for test isolation)
        if ProcessInfo.processInfo.arguments.contains("--reset-data") {
            DatabaseManager.shared.deleteDatabase()
            // Clear SwiftUI navigation state restoration so stale navigation
            // paths (e.g., WorkoutDetailView for a deleted plan) don't persist
            if let bundleId = Bundle.main.bundleIdentifier {
                UserDefaults.standard.removePersistentDomain(forName: bundleId)
            }
        }
    }

    var body: some Scene {
        WindowGroup {
            ContentView(pendingImportContent: $pendingImportContent)
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
                    handleLaunchArguments()
                }
                .onOpenURL { url in
                    handleIncomingURL(url)
                }
        }
    }

    private func handleLaunchArguments() {
        let args = ProcessInfo.processInfo.arguments

        if let urlIndex = args.firstIndex(of: "-url"),
           urlIndex + 1 < args.count {
            let urlString = args[urlIndex + 1]
            if let url = URL(string: urlString) {
                handleIncomingURL(url)
            }
        }
    }

    private func handleIncomingURL(_ url: URL) {
        // Handle liftmark:// deep links
        // URL format: liftmark:///path/to/file or liftmark://path/to/file
        guard url.scheme == "liftmark" else { return }

        var filePath: String
        if let host = url.host, !host.isEmpty {
            filePath = "/" + host + url.path
        } else {
            filePath = url.path
        }

        if FileManager.default.fileExists(atPath: filePath),
           let content = try? String(contentsOfFile: filePath, encoding: .utf8) {
            pendingImportContent = content
        }
    }
}
