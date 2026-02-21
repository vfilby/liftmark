import Foundation

@Observable
final class SessionStore {
    private(set) var sessions: [WorkoutSession] = []
    private(set) var activeSession: WorkoutSession?
    private(set) var isLoading = false
    private let repository = SessionRepository()

    func loadSessions() {
        isLoading = true
        defer { isLoading = false }
        do {
            sessions = try repository.getCompleted()
            activeSession = try repository.getActiveSession()
        } catch {
            print("Failed to load sessions: \(error)")
        }
    }

    func startSession(from plan: WorkoutPlan) -> WorkoutSession? {
        do {
            let session = try repository.createFromPlan(plan)
            activeSession = session
            return session
        } catch {
            print("Failed to start session: \(error)")
            return nil
        }
    }

    func completeSession() {
        guard let session = activeSession else { return }
        do {
            try repository.complete(session.id)
            activeSession = nil
            loadSessions()
        } catch {
            print("Failed to complete session: \(error)")
        }
    }

    func cancelSession() {
        guard let session = activeSession else { return }
        do {
            try repository.cancel(session.id)
            activeSession = nil
        } catch {
            print("Failed to cancel session: \(error)")
        }
    }

    func deleteSession(id: String) {
        do {
            try repository.delete(id)
            loadSessions()
        } catch {
            print("Failed to delete session: \(error)")
        }
    }

    // MARK: - Active Session Mutations

    func completeSet(setId: String, actualWeight: Double?, actualWeightUnit: WeightUnit?, actualReps: Int?, actualTime: Int?, actualRpe: Int?) {
        do {
            try repository.updateSessionSet(setId, actualWeight: actualWeight, actualWeightUnit: actualWeightUnit, actualReps: actualReps, actualTime: actualTime, actualRpe: actualRpe, status: .completed)
            reloadActiveSession()
        } catch {
            print("Failed to complete set: \(error)")
        }
    }

    func skipSet(setId: String) {
        do {
            try repository.skipSet(setId)
            reloadActiveSession()
        } catch {
            print("Failed to skip set: \(error)")
        }
    }

    func updateSetTarget(setId: String, targetWeight: Double?, targetReps: Int?, targetTime: Int?) {
        do {
            try repository.updateSessionSetTarget(setId, targetWeight: targetWeight, targetReps: targetReps, targetTime: targetTime)
            reloadActiveSession()
        } catch {
            print("Failed to update set target: \(error)")
        }
    }

    func addExercise(exerciseName: String, sets: [(weight: Double?, unit: WeightUnit?, reps: Int?, time: Int?)]) {
        guard let session = activeSession else { return }
        do {
            let orderIndex = session.exercises.count
            let exerciseId = try repository.insertSessionExercise(
                sessionId: session.id,
                exerciseName: exerciseName,
                orderIndex: orderIndex
            )
            for (i, set) in sets.enumerated() {
                try repository.insertSessionSet(
                    exerciseId: exerciseId,
                    orderIndex: i,
                    targetWeight: set.weight,
                    targetWeightUnit: set.unit,
                    targetReps: set.reps,
                    targetTime: set.time
                )
            }
            reloadActiveSession()
        } catch {
            print("Failed to add exercise: \(error)")
        }
    }

    func updateExercise(exerciseId: String, name: String, notes: String?, equipmentType: String?) {
        do {
            try repository.updateSessionExercise(exerciseId, name: name, notes: notes, equipmentType: equipmentType)
            reloadActiveSession()
        } catch {
            print("Failed to update exercise: \(error)")
        }
    }

    private func reloadActiveSession() {
        do {
            activeSession = try repository.getActiveSession()
        } catch {
            print("Failed to reload active session: \(error)")
        }
    }
}
