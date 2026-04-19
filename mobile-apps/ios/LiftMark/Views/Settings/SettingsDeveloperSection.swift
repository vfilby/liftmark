import SwiftUI

struct SettingsDeveloperSection: View {
    @State private var showExportError = false
    @State private var exportErrorMessage = ""
    @State private var exportFile: ExportFile?

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
        .sheet(item: $exportFile) { file in
            ShareSheet(items: [file.url])
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
            exportFile = ExportFile(url: url)
        } catch {
            exportErrorMessage = error.localizedDescription
            showExportError = true
        }
    }
}
