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
            let changes = try repository.create(plan)
            SyncChange.notifyAll(changes)
            loadPlans()
        } catch {
            print("Failed to create plan: \(error)")
        }
    }

    func updatePlan(_ plan: WorkoutPlan) {
        do {
            let changes = try repository.update(plan)
            SyncChange.notifyAll(changes)
            loadPlans()
        } catch {
            print("Failed to update plan: \(error)")
        }
    }

    func deletePlan(id: String) {
        do {
            let changes = try repository.delete(id)
            SyncChange.notifyAll(changes)
            loadPlans()
        } catch {
            print("Failed to delete plan: \(error)")
        }
    }

    func reprocessPlan(id: String, fromMarkdown markdown: String) {
        let result = MarkdownParser.parseWorkout(markdown)
        guard result.success, let parsed = result.data, var plan = getPlan(id: id) else { return }
        plan.exercises = parsed.exercises
        plan.name = parsed.name
        plan.tags = parsed.tags
        plan.defaultWeightUnit = parsed.defaultWeightUnit
        updatePlan(plan)
    }

    func updatePlanMarkdown(id: String, newMarkdown: String) {
        let result = MarkdownParser.parseWorkout(newMarkdown)
        guard result.success, let parsed = result.data, var plan = getPlan(id: id) else { return }
        plan.sourceMarkdown = newMarkdown
        plan.exercises = parsed.exercises
        plan.name = parsed.name
        plan.tags = parsed.tags
        plan.defaultWeightUnit = parsed.defaultWeightUnit
        updatePlan(plan)
    }

    func toggleFavorite(id: String) {
        do {
            let changes = try repository.toggleFavorite(id)
            SyncChange.notifyAll(changes)
            loadPlans()
        } catch {
            print("Failed to toggle favorite: \(error)")
        }
    }
}
