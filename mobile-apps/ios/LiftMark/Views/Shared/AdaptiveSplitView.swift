import SwiftUI

/// A reusable layout component that shows a sidebar/detail split on iPad
/// and a completely independent compact layout on iPhone.
///
/// The sidebar takes 1/3 of available width on iPad.
struct AdaptiveSplitView<Sidebar: View, Detail: View, Compact: View>: View {
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass

    let sidebar: Sidebar
    let detail: Detail
    let compact: Compact

    init(
        @ViewBuilder sidebar: () -> Sidebar,
        @ViewBuilder detail: () -> Detail,
        @ViewBuilder compact: () -> Compact
    ) {
        self.sidebar = sidebar()
        self.detail = detail()
        self.compact = compact()
    }

    /// Minimum width required to show the split layout.
    /// Below this threshold, the compact layout is used even on iPad
    /// (e.g., iPad split-screen at 1/3 width, iPad mini portrait).
    private static var splitMinWidth: CGFloat { 500 }

    var body: some View {
        GeometryReader { geometry in
            if horizontalSizeClass == .regular && geometry.size.width >= Self.splitMinWidth {
                HStack(spacing: 0) {
                    sidebar
                        .frame(width: geometry.size.width * 0.4)
                    Divider()
                    detail
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                }
            } else {
                compact
            }
        }
    }
}
