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

    var body: some View {
        if horizontalSizeClass == .regular {
            GeometryReader { geometry in
                HStack(spacing: 0) {
                    sidebar
                        .frame(width: geometry.size.width * 0.4)
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
