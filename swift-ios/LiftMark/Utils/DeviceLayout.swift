import SwiftUI
import UIKit

/// Provides iPad detection and orientation info for adaptive layouts.
enum DeviceLayout {
    /// Whether the current device is an iPad.
    static var isTablet: Bool {
        UIDevice.current.userInterfaceIdiom == .pad
    }
}

/// View modifier that injects horizontal size class for adaptive layouts.
struct AdaptiveLayout: ViewModifier {
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass

    var isCompact: Bool {
        horizontalSizeClass == .compact
    }

    var isRegular: Bool {
        horizontalSizeClass == .regular
    }

    func body(content: Content) -> some View {
        content
    }
}
