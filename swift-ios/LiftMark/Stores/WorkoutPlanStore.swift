import Foundation

@Observable
final class WorkoutPlanStore {
    private(set) var plans: [WorkoutPlan] = []
    private(set) var isLoading = false
    private let repository = WorkoutPlanRepository()

    func loadPlans() {
        isLoading = true
        defer { isLoading = false }
        do {
            plans = try repository.getAll()
        } catch {
            print("Failed to load plans: \(error)")
        }
    }

    func getPlan(id: String) -> WorkoutPlan? {
        plans.first { $0.id == id }
    }

    func createPlan(_ plan: WorkoutPlan) {
        do {
            try repository.create(plan)
            loadPlans()
        } catch {
            print("Failed to create plan: \(error)")
        }
    }

    func updatePlan(_ plan: WorkoutPlan) {
        do {
            try repository.update(plan)
            loadPlans()
        } catch {
            print("Failed to update plan: \(error)")
        }
    }

    func deletePlan(id: String) {
        do {
            try repository.delete(id)
            loadPlans()
        } catch {
            print("Failed to delete plan: \(error)")
        }
    }

    func toggleFavorite(id: String) {
        do {
            try repository.toggleFavorite(id)
            loadPlans()
        } catch {
            print("Failed to toggle favorite: \(error)")
        }
    }
}
