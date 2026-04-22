import Foundation

@MainActor
@Observable
final class SessionStore {
    private(set) var sessions: [WorkoutSession] = []
    private(set) var activeSession: WorkoutSession?
    private(set) var isLoading = false
    private(set) var lastError: Error?
    private(set) var bestWeights: [String: (weight: Double, reps: Int, unit: String)] = [:]
    private let repository = SessionRepository()

    func clearError() {
        lastError = nil
    }

    func loadSessions() {
        isLoading = true
        defer { isLoading = false }
        do {
            sessions = try repository.getCompleted()
            activeSession = try repository.getActiveSession()
            lastError = nil
            loadBestWeights()
        } catch {
            lastError = error
            Logger.shared.error(.database, "Failed to load sessions", error: error)
        }
    }

    func loadBestWeights() {
        do {
            bestWeights = try repository.getExerciseBestWeightsNormalized()
        } catch {
            Logger.shared.error(.database, "Failed to load best weights", error: error)
        }
    }

    func startSession(from plan: WorkoutPlan) -> WorkoutSession? {
        do {
            // Cancel any stale in-progress sessions before starting a new one.
            // This prevents discarded or orphaned sessions from reappearing as resume candidates.
            let cancelChanges = try repository.cancelAllInProgress()
            SyncChange.notifyAll(cancelChanges)
            let (session, createChanges) = try repository.createFromPlan(plan)
            SyncChange.notifyAll(createChanges)
            activeSession = session
            lastError = nil
            return session
        } catch {
            lastError = error
            Logger.shared.error(.database, "Failed to start session", error: error)
            return nil
        }
    }

    func completeSession() {
        guard let session = activeSession else { return }
        do {
            let changes = try repository.complete(session.id)
            SyncChange.notifyAll(changes)
            // Reload completed sessions for highlights/PR comparison.
            // Keep activeSession non-nil to avoid disrupting navigation to the summary screen.
            sessions = try repository.getCompleted()
            lastError = nil
        } catch {
            lastError = error
            Logger.shared.error(.database, "Failed to complete session", error: error)
        }
    }

    func clearActiveSession() {
        activeSession = nil
    }

    func cancelSession() {
        guard let session = activeSession else { return }
        do {
            let changes = try repository.cancel(session.id)
            SyncChange.notifyAll(changes)
            activeSession = nil
            lastError = nil
        } catch {
            lastError = error
            Logger.shared.error(.database, "Failed to cancel session", error: error)
        }
    }

    func deleteSession(id: String) {
        do {
            let changes = try repository.delete(id)
            SyncChange.notifyAll(changes)
            loadSessions()
        } catch {
            lastError = error
            Logger.shared.error(.database, "Failed to delete session", error: error)
        }
    }

    // MARK: - Active Session Mutations

    func completeSet(setId: String, actualWeight: Double?, actualWeightUnit: WeightUnit?, actualReps: Int?, actualTime: Int?, actualRpe: Int?) {
        do {
            let changes = try repository.updateSessionSet(
                setId, actualWeight: actualWeight, actualWeightUnit: actualWeightUnit,
                actualReps: actualReps, actualTime: actualTime,
                actualRpe: actualRpe, status: .completed)
            SyncChange.notifyAll(changes)
            reloadActiveSession()
        } catch {
            lastError = error
            Logger.shared.error(.database, "Failed to complete set", error: error)
        }
    }

    func completeDropSet(setId: String, entries: [(weight: Double?, weightUnit: WeightUnit?, reps: Int?)]) {
        do {
            let changes = try repository.completeDropSet(setId, entries: entries)
            SyncChange.notifyAll(changes)
            reloadActiveSession()
        } catch {
            lastError = error
            Logger.shared.error(.database, "Failed to complete drop set", error: error)
        }
    }

    func skipSet(setId: String) {
        do {
            let changes = try repository.skipSet(setId)
            SyncChange.notifyAll(changes)
            reloadActiveSession()
        } catch {
            lastError = error
            Logger.shared.error(.database, "Failed to skip set", error: error)
        }
    }

    func updateSetTarget(setId: String, targetWeight: Double?, targetReps: Int?, targetTime: Int?) {
        do {
            let changes = try repository.updateSessionSetTarget(setId, targetWeight: targetWeight, targetReps: targetReps, targetTime: targetTime)
            SyncChange.notifyAll(changes)
            reloadActiveSession()
        } catch {
            lastError = error
            Logger.shared.error(.database, "Failed to update set target", error: error)
        }
    }

    func addExercise(exerciseName: String, sets: [(weight: Double?, unit: WeightUnit?, reps: Int?, time: Int?)]) {
        guard let session = activeSession else { return }
        do {
            var allChanges: [SyncChange] = []
            let orderIndex = session.exercises.count
            let (exerciseId, exerciseChanges) = try repository.insertSessionExercise(
                sessionId: session.id,
                exerciseName: exerciseName,
                orderIndex: orderIndex
            )
            allChanges.append(contentsOf: exerciseChanges)
            for (i, set) in sets.enumerated() {
                let setChanges = try repository.insertSessionSet(
                    exerciseId: exerciseId,
                    orderIndex: i,
                    targetWeight: set.weight,
                    targetWeightUnit: set.unit,
                    targetReps: set.reps,
                    targetTime: set.time
                )
                allChanges.append(contentsOf: setChanges)
            }
            SyncChange.notifyAll(allChanges)
            reloadActiveSession()
        } catch {
            lastError = error
            Logger.shared.error(.database, "Failed to add exercise", error: error)
        }
    }

    func addSetToExercise(exerciseId: String, targetWeight: Double?, targetWeightUnit: WeightUnit?, targetReps: Int?, targetTime: Int?) {
        guard let session = activeSession,
              let exercise = session.exercises.first(where: { $0.id == exerciseId }) else { return }
        do {
            let orderIndex = exercise.sets.count
            let changes = try repository.insertSessionSet(
                exerciseId: exerciseId,
                orderIndex: orderIndex,
                targetWeight: targetWeight,
                targetWeightUnit: targetWeightUnit,
                targetReps: targetReps,
                targetTime: targetTime
            )
            SyncChange.notifyAll(changes)
            reloadActiveSession()
        } catch {
            lastError = error
            Logger.shared.error(.database, "Failed to add set", error: error)
        }
    }

    func deleteSet(setId: String) {
        do {
            let changes = try repository.deleteSessionSet(setId)
            SyncChange.notifyAll(changes)
            reloadActiveSession()
        } catch {
            lastError = error
            Logger.shared.error(.database, "Failed to delete set", error: error)
        }
    }

    /// Update notes on the currently active session. Reaches the DB layer so the
    /// notes survive backgrounding/termination mid-session. Empty strings are
    /// normalized to nil by the repository.
    func updateActiveSessionNotes(_ notes: String?) {
        guard let session = activeSession else { return }
        do {
            let changes = try repository.updateSessionNotes(session.id, notes: notes)
            SyncChange.notifyAll(changes)
            reloadActiveSession()
        } catch {
            lastError = error
            Logger.shared.error(.database, "Failed to update active session notes", error: error)
        }
    }

    /// Update notes on any session (typically a completed one from the history list).
    func updateSessionNotes(sessionId: String, notes: String?) {
        do {
            let changes = try repository.updateSessionNotes(sessionId, notes: notes)
            SyncChange.notifyAll(changes)
            // Refresh the completed-sessions list so UIs bound to `sessions` see the update.
            sessions = try repository.getCompleted()
            lastError = nil
        } catch {
            lastError = error
            Logger.shared.error(.database, "Failed to update session notes", error: error)
        }
    }

    func updateExercise(exerciseId: String, name: String, notes: String?, equipmentType: String?) {
        do {
            let changes = try repository.updateSessionExercise(exerciseId, name: name, notes: notes, equipmentType: equipmentType)
            SyncChange.notifyAll(changes)
            reloadActiveSession()
        } catch {
            lastError = error
            Logger.shared.error(.database, "Failed to update exercise", error: error)
        }
    }

    private func reloadActiveSession() {
        do {
            activeSession = try repository.getActiveSession()
            lastError = nil
        } catch {
            lastError = error
            Logger.shared.error(.database, "Failed to reload active session", error: error)
        }
    }
}
