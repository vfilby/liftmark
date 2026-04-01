import Foundation

@MainActor
@Observable
final class WorkoutPlanStore {
    private(set) var plans: [WorkoutPlan] = []
    private(set) var isLoading = false
    private(set) var lastError: Error?
    private let repository = WorkoutPlanRepository()

    func clearError() {
        lastError = nil
    }

    func loadPlans() {
        isLoading = true
        defer { isLoading = false }
        do {
            plans = try repository.getAll()
            lastError = nil
        } catch {
            lastError = error
            Logger.shared.error(.database, "Failed to load plans", error: error)
        }
    }

    func getPlan(id: String) -> WorkoutPlan? {
        plans.first { $0.id == id }
    }

    func createPlan(_ plan: WorkoutPlan) {
        do {
            let changes = try repository.create(plan)
            SyncChange.notifyAll(changes)
            plans.insert(plan, at: 0)
            lastError = nil
        } catch {
            lastError = error
            Logger.shared.error(.database, "Failed to create plan", error: error)
        }
    }

    func updatePlan(_ plan: WorkoutPlan) {
        do {
            let changes = try repository.update(plan)
            SyncChange.notifyAll(changes)
            if let index = plans.firstIndex(where: { $0.id == plan.id }) {
                plans[index] = plan
            }
            lastError = nil
        } catch {
            lastError = error
            Logger.shared.error(.database, "Failed to update plan", error: error)
        }
    }

    func deletePlan(id: String) {
        do {
            let changes = try repository.delete(id)
            SyncChange.notifyAll(changes)
            plans.removeAll { $0.id == id }
            lastError = nil
        } catch {
            lastError = error
            Logger.shared.error(.database, "Failed to delete plan", error: error)
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
            if let index = plans.firstIndex(where: { $0.id == id }) {
                plans[index].isFavorite.toggle()
            }
            lastError = nil
        } catch {
            lastError = error
            Logger.shared.error(.database, "Failed to toggle favorite", error: error)
        }
    }
}
