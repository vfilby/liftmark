import SwiftUI
#if canImport(UIKit)
import UIKit
#endif

/// Identifiable wrapper for a file URL, used with `shareSheet(item:)` to ensure
/// the share sheet only opens when the URL is fully ready.
struct ExportFile: Identifiable {
    let id = UUID()
    let url: URL
}

#if os(iOS)

// MARK: - Direct UIKit Presentation

/// Presents `UIActivityViewController` directly on the key window's root view
/// controller instead of wrapping it in a SwiftUI `.sheet`.
///
/// Why not `.sheet(item:) { ShareSheet(...) }`? Wrapping `UIActivityViewController`
/// inside a `UIHostingController` via `UIViewControllerRepresentable` causes a
/// well-known blank-sheet bug on first presentation: the activity VC queries the
/// presenting controller's view hierarchy and extension services during its first
/// layout pass, and the hosting controller's transition timing can race with that
/// query. The symptom is a share sheet that renders with no items on first tap
/// but works on second tap (the extension cache is then warm).
///
/// Presenting directly on the UIKit window root avoids the hosting-controller
/// indirection entirely and matches the platform-recommended pattern.
///
/// Also defers presentation to the next runloop turn so any pending file-system
/// writes flush and the cached file URL is fully materialized before iOS
/// introspects it.
///
/// See GH #70.
struct ShareSheetPresenter: ViewModifier {
    @Binding var item: ExportFile?

    func body(content: Content) -> some View {
        content.onChange(of: item?.id) { _, newId in
            guard newId != nil, let file = item else { return }
            present(url: file.url) { [item = $item] in
                // Clear the binding once the activity sheet is dismissed so the
                // caller sees symmetric state (mirrors SwiftUI `.sheet(item:)`).
                item.wrappedValue = nil
            }
        }
    }

    private func present(url: URL, onDismiss: @escaping () -> Void) {
        // Defer one runloop tick so any `.write(to:)` / `copyItem(at:to:)` the
        // caller just executed is fully flushed before `UIActivityViewController`
        // introspects the file for type/preview information.
        DispatchQueue.main.async {
            guard let rootVC = Self.topMostViewController() else {
                onDismiss()
                return
            }

            let activityVC = UIActivityViewController(
                activityItems: [url],
                applicationActivities: nil
            )
            activityVC.completionWithItemsHandler = { _, _, _, _ in
                onDismiss()
            }

            // iPad: anchor the popover to the presenting VC's view so UIKit
            // doesn't assert. Centering matches share-button default placement
            // since we don't have a specific source frame from SwiftUI.
            if let popover = activityVC.popoverPresentationController {
                popover.sourceView = rootVC.view
                popover.sourceRect = CGRect(
                    x: rootVC.view.bounds.midX,
                    y: rootVC.view.bounds.midY,
                    width: 0,
                    height: 0
                )
                popover.permittedArrowDirections = []
            }

            rootVC.present(activityVC, animated: true)
        }
    }

    /// Walks the scene graph to find the top-most presented controller so we
    /// present over any currently-visible sheet or modal.
    static func topMostViewController() -> UIViewController? {
        let scenes = UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .filter { $0.activationState == .foregroundActive }

        let keyWindow = scenes
            .flatMap(\.windows)
            .first(where: \.isKeyWindow)
            ?? scenes.flatMap(\.windows).first

        var top = keyWindow?.rootViewController
        while let presented = top?.presentedViewController {
            top = presented
        }
        return top
    }
}

extension View {
    /// Present an iOS share sheet (`UIActivityViewController`) when `item` becomes
    /// non-nil. Use instead of `.sheet(item:) { ShareSheet(...) }` — the direct-
    /// presentation path avoids the blank-sheet race on first tap (GH #70).
    func shareSheet(item: Binding<ExportFile?>) -> some View {
        modifier(ShareSheetPresenter(item: item))
    }
}

#endif
