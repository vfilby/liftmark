import SwiftUI

/// Coordinates navigation state across the app.
/// Allows deep views (like WorkoutSummaryView) to pop back to the root.
@Observable
class NavigationCoordinator {
    var homeNavPath = NavigationPath()

    func popToRoot() {
        homeNavPath = NavigationPath()
    }
}
