import SwiftUI

/// Identifiable wrapper for a file URL, used with `sheet(item:)` to ensure
/// the share sheet only opens when the URL is fully ready.
struct ExportFile: Identifiable {
    let id = UUID()
    let url: URL
}

#if os(iOS)
struct ShareSheet: UIViewControllerRepresentable {
    let items: [Any]

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: items, applicationActivities: nil)
    }

    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}
#endif
