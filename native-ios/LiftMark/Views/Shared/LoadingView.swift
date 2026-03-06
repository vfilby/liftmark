import SwiftUI

struct LoadingView: View {
    let message: String

    init(_ message: String = "Loading...") {
        self.message = message
    }

    var body: some View {
        VStack(spacing: LiftMarkTheme.spacingMD) {
            ProgressView()
            Text(message)
                .foregroundStyle(.secondary)
        }
    }
}
