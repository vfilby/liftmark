import SwiftUI

/// Coordinates navigation state across the app.
/// Allows deep views (like WorkoutSummaryView) to pop back to the root,
/// and cross-tab navigation (e.g., opening a plan from the Home tab).
@Observable
class NavigationCoordinator {
    var homeNavPath = NavigationPath()
    var selectedTab: AppTab = .home

    /// Set this to navigate to a specific plan in the Plans tab.
    var pendingPlanId: String?

    func popToRoot() {
        homeNavPath = NavigationPath()
    }

    func navigateToPlan(id: String) {
        pendingPlanId = id
        selectedTab = .plans
    }
}

enum AppTab: Hashable {
    case home
    case plans
    case workouts
    case settings
}
