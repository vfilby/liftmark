import SwiftUI

/// A reusable layout component that shows a sidebar/detail split on iPad
/// and a completely independent compact layout on iPhone.
///
/// The sidebar width is capped at 40% of available space to prevent
/// it from dominating on smaller iPads or in multitasking.
struct AdaptiveSplitView<Sidebar: View, Detail: View, Compact: View>: View {
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass

    let sidebarWidth: CGFloat
    let sidebar: Sidebar
    let detail: Detail
    let compact: Compact

    init(
        sidebarWidth: CGFloat = 320,
        @ViewBuilder sidebar: () -> Sidebar,
        @ViewBuilder detail: () -> Detail,
        @ViewBuilder compact: () -> Compact
    ) {
        self.sidebarWidth = sidebarWidth
        self.sidebar = sidebar()
        self.detail = detail()
        self.compact = compact()
    }

    var body: some View {
        if horizontalSizeClass == .regular {
            GeometryReader { geometry in
                let effectiveWidth = min(sidebarWidth, geometry.size.width * 0.4)
                HStack(spacing: 0) {
                    sidebar
                        .frame(width: effectiveWidth)
                    Divider()
                    detail
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                }
            }
        } else {
            compact
        }
    }
}
