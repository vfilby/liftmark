import SwiftUI

@main
struct LiftMarkApp: App {
    @Environment(\.scenePhase) private var scenePhase
    @State private var planStore = WorkoutPlanStore()
    @State private var sessionStore = SessionStore()
    @State private var settingsStore = SettingsStore()
    @State private var gymStore = GymStore()
    @State private var equipmentStore = EquipmentStore()
    @State private var pendingImportContent: String? = Self.importContentFromLaunchArgs()

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

        Self.seedMigratorFailureFromLaunchArgs()

        if !Self.isRunningTests {
            CrashReporter.shared.start()
        }
    }

    /// Test seam: `--seed-migrator-failure <case>` lets UI tests pre-populate the
    /// migrator bridge's failure state so the boot-time alert/stall flow is exercisable
    /// without triggering a real failure. `<case>` is a `MigratorBridgeFailure` raw value.
    /// Optional companion args `--seed-required-bytes <Int>` and `--seed-from-version <Int>`
    /// set numeric context used by message substitution.
    private static func seedMigratorFailureFromLaunchArgs() {
        let args = ProcessInfo.processInfo.arguments
        guard let idx = args.firstIndex(of: "--seed-migrator-failure"),
              idx + 1 < args.count,
              let failure = MigratorBridgeFailure(rawValue: args[idx + 1]) else {
            return
        }
        var context = MigratorBridgeFailureContext()
        if let rIdx = args.firstIndex(of: "--seed-required-bytes"),
           rIdx + 1 < args.count,
           let bytes = Int64(args[rIdx + 1]) {
            context.requiredBytes = bytes
        }
        if let vIdx = args.firstIndex(of: "--seed-from-version"),
           vIdx + 1 < args.count,
           let version = Int(args[vIdx + 1]) {
            context.fromVersion = version
        }
        MigratorBridgeFailure.persist(failure, context: context)
        // Prevent the real bridge from running and clearing the seeded failure.
        // This arg is strictly for UI-test harness use.
        MigratorBridge.isEnabled = false
    }

    /// Parse --import-content launch argument at init time so the @State
    /// initial value is non-nil before any views appear. This ensures the
    /// import sheet presents immediately rather than relying on onChange.
    private static func importContentFromLaunchArgs() -> String? {
        let args = ProcessInfo.processInfo.arguments
        guard let idx = args.firstIndex(of: "--import-content"),
              idx + 1 < args.count else { return nil }
        let base64 = args[idx + 1]
        guard let data = Data(base64Encoded: base64) else { return nil }
        return String(data: data, encoding: .utf8)
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
                    LiveActivityService.shared.cleanupOrphanedActivities()
                    if !Self.isRunningTests {
                        Task {
                            await CKSyncEngineManager.shared.start()
                        }
                    }
                }
                .onChange(of: scenePhase) { _, newPhase in
                    switch newPhase {
                    case .active:
                        if !Self.isRunningTests {
                            Task {
                                await CKSyncEngineManager.shared.start()
                            }
                        }
                    default:
                        break
                    }
                }
                .onReceive(NotificationCenter.default.publisher(for: .syncCompleted)) { notification in
                    let changed = notification.userInfo?["changedRecordTypes"] as? Set<String> ?? []
                    // Only reload stores affected by the sync
                    if changed.isEmpty || !changed.isDisjoint(with: ["WorkoutPlan", "PlannedExercise", "PlannedSet"]) {
                        planStore.loadPlans()
                    }
                    if changed.isEmpty || !changed.isDisjoint(with: ["WorkoutSession", "SessionExercise", "SessionSet"]) {
                        sessionStore.loadSessions()
                    }
                    if changed.isEmpty || changed.contains("UserSettings") {
                        settingsStore.loadSettings()
                    }
                    if changed.isEmpty || !changed.isDisjoint(with: ["Gym", "GymEquipment"]) {
                        gymStore.loadGyms()
                    }
                }
                .onOpenURL { url in
                    handleIncomingURL(url)
                }
        }
    }

    private static let isRunningTests = NSClassFromString("XCTestCase") != nil

    private func handleLaunchArguments() {
        let args = ProcessInfo.processInfo.arguments

        // --import-content is handled at init time via importContentFromLaunchArgs()
        // to ensure the @State initial value is set before views appear.
        if args.contains("--import-content") { return }

        if let urlIndex = args.firstIndex(of: "-url"),
           urlIndex + 1 < args.count {
            let urlString = args[urlIndex + 1]
            if let url = URL(string: urlString) {
                handleIncomingURL(url)
            }
        }
    }

    private func handleIncomingURL(_ url: URL) {
        if url.scheme == "liftmark" {
            // Handle liftmark:// deep links
            // URL format: liftmark:///path/to/file or liftmark://path/to/file
            var filePath: String
            if let host = url.host, !host.isEmpty {
                filePath = "/" + host + url.path
            } else {
                filePath = url.path
            }

            // Validate the path is within allowed directories and has a valid extension
            guard let safePath = FileImportService.validateDeepLinkPath(filePath) else {
                return
            }

            if FileManager.default.fileExists(atPath: safePath),
               let content = try? String(contentsOfFile: safePath, encoding: .utf8) {
                pendingImportContent = content
            }
        } else if url.isFileURL {
            // Handle file:// URLs from share sheet / "Open In" / document types
            let accessing = url.startAccessingSecurityScopedResource()
            defer {
                if accessing { url.stopAccessingSecurityScopedResource() }
            }

            if let content = try? String(contentsOf: url, encoding: .utf8) {
                pendingImportContent = content
            }
        }
    }
}
