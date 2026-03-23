import SwiftUI

/// A reusable layout component that shows a sidebar/detail split on iPad
/// and a completely independent compact layout on iPhone.
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
        Group {
            if horizontalSizeClass == .regular {
                HStack(spacing: 0) {
                    sidebar
                        .frame(width: sidebarWidth)
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
