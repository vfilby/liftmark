import SwiftUI

struct SettingsDeveloperSection: View {
    @State private var showExportError = false
    @State private var exportErrorMessage = ""
    @State private var exportURL: URL?
    @State private var showShareSheet = false

    var body: some View {
        Group {
            NavigationLink(value: AppDestination.debugLogs) {
                Label("Debug Logs", systemImage: "doc.text")
            }
            .accessibilityIdentifier("debug-logs-button")

            Button {
                exportDatabase()
            } label: {
                Label("Export Database", systemImage: "cylinder.split.1x2")
            }
            .accessibilityIdentifier("export-database-button")
        }
        .sheet(isPresented: $showShareSheet) {
            if let exportURL {
                ShareSheet(items: [exportURL])
            }
        }
        .alert("Export Error", isPresented: $showExportError) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(exportErrorMessage)
        }
    }

    // MARK: - Database Export

    private func exportDatabase() {
        do {
            let url = try DatabaseBackupService.exportDatabase()
            exportURL = url
            showShareSheet = true
        } catch {
            exportErrorMessage = error.localizedDescription
            showExportError = true
        }
    }
}
