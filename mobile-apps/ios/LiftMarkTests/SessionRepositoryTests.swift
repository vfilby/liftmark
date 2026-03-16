import XCTest
@testable import LiftMark

final class SessionRepositoryTests: XCTestCase {

    private var repo: SessionRepository!
    private var planRepo: WorkoutPlanRepository!

    override func setUp() {
        super.setUp()
        DatabaseManager.shared.deleteDatabase()
        repo = SessionRepository()
        planRepo = WorkoutPlanRepository()
    }

    override func tearDown() {
        DatabaseManager.shared.deleteDatabase()
        super.tearDown()
    }

    // MARK: - createFromPlan

    func testCreateFromPlanCreatesSession() throws {
        let plan = makePlan(exercises: [
            makePlannedExercise(name: "Bench Press", sets: [
                makePlannedSet(weight: 225, reps: 5),
                makePlannedSet(weight: 225, reps: 5)
            ])
        ])
        try planRepo.create(plan)

        let session = try repo.createFromPlan(plan)
        XCTAssertEqual(session.name, plan.name)
        XCTAssertEqual(session.status, .inProgress)
        XCTAssertEqual(session.exercises.count, 1)
        XCTAssertEqual(session.exercises[0].exerciseName, "Bench Press")
        XCTAssertEqual(session.exercises[0].sets.count, 2)
        XCTAssertEqual(session.exercises[0].sets[0].targetWeight, 225)
        XCTAssertEqual(session.exercises[0].sets[0].targetReps, 5)
        XCTAssertEqual(session.exercises[0].sets[0].status, .pending)
    }

    func testCreateFromPlanSetsWorkoutPlanId() throws {
        let plan = makePlan()
        try planRepo.create(plan)

        let session = try repo.createFromPlan(plan)
        XCTAssertEqual(session.workoutPlanId, plan.id)
    }

    // MARK: - getAll & getById

    func testGetAllReturnsCreatedSessions() throws {
        let plan = makePlan()
        try planRepo.create(plan)
        _ = try repo.createFromPlan(plan)
        _ = try repo.createFromPlan(plan)

        let all = try repo.getAll()
        XCTAssertEqual(all.count, 2)
    }

    func testGetByIdReturnsSession() throws {
        let plan = makePlan(exercises: [
            makePlannedExercise(name: "Squat", sets: [makePlannedSet(weight: 315, reps: 3)])
        ])
        try planRepo.create(plan)
        let session = try repo.createFromPlan(plan)

        let fetched = try repo.getById(session.id)
        XCTAssertNotNil(fetched)
        XCTAssertEqual(fetched?.id, session.id)
        XCTAssertEqual(fetched?.exercises.count, 1)
    }

    func testGetByIdReturnsNilForMissing() throws {
        XCTAssertNil(try repo.getById("nonexistent"))
    }

    // MARK: - getActiveSession

    func testGetActiveSessionReturnsInProgressSession() throws {
        let plan = makePlan()
        try planRepo.create(plan)
        let session = try repo.createFromPlan(plan)

        let active = try repo.getActiveSession()
        XCTAssertNotNil(active)
        XCTAssertEqual(active?.id, session.id)
    }

    func testGetActiveSessionReturnsNilWhenNoActive() throws {
        let plan = makePlan()
        try planRepo.create(plan)
        let session = try repo.createFromPlan(plan)
        try repo.complete(session.id)

        let active = try repo.getActiveSession()
        XCTAssertNil(active)
    }

    // MARK: - complete & cancel

    func testCompleteSession() throws {
        let plan = makePlan()
        try planRepo.create(plan)
        let session = try repo.createFromPlan(plan)

        try repo.complete(session.id)

        let fetched = try repo.getById(session.id)
        XCTAssertEqual(fetched?.status, .completed)
        XCTAssertNotNil(fetched?.endTime)
    }

    func testCancelSession() throws {
        let plan = makePlan()
        try planRepo.create(plan)
        let session = try repo.createFromPlan(plan)

        try repo.cancel(session.id)

        let fetched = try repo.getById(session.id)
        XCTAssertEqual(fetched?.status, .canceled)
    }

    func testCancelAllInProgressCancelsStaleSession() throws {
        let plan = makePlan()
        try planRepo.create(plan)
        let s1 = try repo.createFromPlan(plan)
        let s2 = try repo.createFromPlan(plan)

        try repo.cancelAllInProgress()

        let fetched1 = try repo.getById(s1.id)
        let fetched2 = try repo.getById(s2.id)
        XCTAssertEqual(fetched1?.status, .canceled)
        XCTAssertEqual(fetched2?.status, .canceled)
        XCTAssertNil(try repo.getActiveSession())
    }

    func testCancelAllInProgressDoesNotAffectCompletedSessions() throws {
        let plan = makePlan()
        try planRepo.create(plan)
        let s1 = try repo.createFromPlan(plan)
        try repo.complete(s1.id)

        try repo.cancelAllInProgress()

        let fetched = try repo.getById(s1.id)
        XCTAssertEqual(fetched?.status, .completed)
    }

    // MARK: - getCompleted

    func testGetCompletedReturnsOnlyCompletedSessions() throws {
        let plan = makePlan()
        try planRepo.create(plan)
        let s1 = try repo.createFromPlan(plan)
        let s2 = try repo.createFromPlan(plan)
        try repo.complete(s1.id)
        // s2 stays in_progress

        let completed = try repo.getCompleted()
        XCTAssertEqual(completed.count, 1)
        XCTAssertEqual(completed[0].id, s1.id)
    }

    // MARK: - delete

    func testDeleteSession() throws {
        let plan = makePlan()
        try planRepo.create(plan)
        let session = try repo.createFromPlan(plan)

        try repo.delete(session.id)
        XCTAssertNil(try repo.getById(session.id))
    }

    // MARK: - getRecentSessions

    func testGetRecentSessionsRespectsLimit() throws {
        let plan = makePlan()
        try planRepo.create(plan)
        for _ in 0..<5 {
            let s = try repo.createFromPlan(plan)
            try repo.complete(s.id)
        }

        let recent = try repo.getRecentSessions(3)
        XCTAssertEqual(recent.count, 3)
    }

    // MARK: - updateSessionSet

    func testUpdateSessionSetActuals() throws {
        let plan = makePlan(exercises: [
            makePlannedExercise(name: "Bench", sets: [makePlannedSet(weight: 225, reps: 5)])
        ])
        try planRepo.create(plan)
        let session = try repo.createFromPlan(plan)
        let setId = session.exercises[0].sets[0].id

        try repo.updateSessionSet(
            setId,
            actualWeight: 230,
            actualWeightUnit: .lbs,
            actualReps: 4,
            actualTime: nil,
            actualRpe: 9,
            status: .completed
        )

        let fetched = try repo.getById(session.id)
        let updatedSet = fetched?.exercises[0].sets[0]
        XCTAssertEqual(updatedSet?.actualWeight, 230)
        XCTAssertEqual(updatedSet?.actualWeightUnit, .lbs)
        XCTAssertEqual(updatedSet?.actualReps, 4)
        XCTAssertEqual(updatedSet?.actualRpe, 9)
        XCTAssertEqual(updatedSet?.status, .completed)
        XCTAssertNotNil(updatedSet?.completedAt)
    }

    func testUpdateSessionSetTargets() throws {
        let plan = makePlan(exercises: [
            makePlannedExercise(name: "Bench", sets: [makePlannedSet(weight: 225, reps: 5)])
        ])
        try planRepo.create(plan)
        let session = try repo.createFromPlan(plan)
        let setId = session.exercises[0].sets[0].id

        try repo.updateSessionSetTarget(setId, targetWeight: 235, targetReps: 3, targetTime: nil)

        let fetched = try repo.getById(session.id)
        let updatedSet = fetched?.exercises[0].sets[0]
        XCTAssertEqual(updatedSet?.targetWeight, 235)
        XCTAssertEqual(updatedSet?.targetReps, 3)
    }

    func testSkipSet() throws {
        let plan = makePlan(exercises: [
            makePlannedExercise(name: "Bench", sets: [makePlannedSet(weight: 225, reps: 5)])
        ])
        try planRepo.create(plan)
        let session = try repo.createFromPlan(plan)
        let setId = session.exercises[0].sets[0].id

        try repo.skipSet(setId)

        let fetched = try repo.getById(session.id)
        XCTAssertEqual(fetched?.exercises[0].sets[0].status, .skipped)
    }

    // MARK: - insertSessionExercise & insertSessionSet

    func testInsertSessionExercise() throws {
        let plan = makePlan()
        try planRepo.create(plan)
        let session = try repo.createFromPlan(plan)

        let exerciseId = try repo.insertSessionExercise(
            sessionId: session.id,
            exerciseName: "Overhead Press",
            orderIndex: 0,
            notes: "Strict form"
        )

        let fetched = try repo.getById(session.id)
        let newExercise = fetched?.exercises.first { $0.id == exerciseId }
        XCTAssertNotNil(newExercise)
        XCTAssertEqual(newExercise?.exerciseName, "Overhead Press")
        XCTAssertEqual(newExercise?.notes, "Strict form")
    }

    func testInsertSessionSet() throws {
        let plan = makePlan()
        try planRepo.create(plan)
        let session = try repo.createFromPlan(plan)
        let exerciseId = try repo.insertSessionExercise(
            sessionId: session.id,
            exerciseName: "Curls",
            orderIndex: 0
        )

        try repo.insertSessionSet(
            exerciseId: exerciseId,
            orderIndex: 0,
            targetWeight: 40,
            targetWeightUnit: .lbs,
            targetReps: 12
        )

        let fetched = try repo.getById(session.id)
        let exercise = fetched?.exercises.first { $0.id == exerciseId }
        XCTAssertEqual(exercise?.sets.count, 1)
        XCTAssertEqual(exercise?.sets[0].targetWeight, 40)
        XCTAssertEqual(exercise?.sets[0].targetReps, 12)
    }

    // MARK: - updateSessionExercise

    func testUpdateSessionExercise() throws {
        let plan = makePlan()
        try planRepo.create(plan)
        let session = try repo.createFromPlan(plan)
        let exerciseId = try repo.insertSessionExercise(
            sessionId: session.id,
            exerciseName: "Curls",
            orderIndex: 0
        )

        try repo.updateSessionExercise(exerciseId, name: "Hammer Curls", notes: "Slow eccentric", equipmentType: "dumbbell")

        let fetched = try repo.getById(session.id)
        let exercise = fetched?.exercises.first { $0.id == exerciseId }
        XCTAssertEqual(exercise?.exerciseName, "Hammer Curls")
        XCTAssertEqual(exercise?.notes, "Slow eccentric")
        XCTAssertEqual(exercise?.equipmentType, "dumbbell")
    }

    // MARK: - deleteSessionExercise & deleteSessionSet

    func testDeleteSessionExercise() throws {
        let plan = makePlan()
        try planRepo.create(plan)
        let session = try repo.createFromPlan(plan)
        let exerciseId = try repo.insertSessionExercise(
            sessionId: session.id,
            exerciseName: "Curls",
            orderIndex: 0
        )

        try repo.deleteSessionExercise(exerciseId)

        let fetched = try repo.getById(session.id)
        XCTAssertFalse(fetched?.exercises.contains { $0.id == exerciseId } ?? true)
    }

    func testDeleteSessionSet() throws {
        let plan = makePlan(exercises: [
            makePlannedExercise(name: "Bench", sets: [
                makePlannedSet(weight: 225, reps: 5),
                makePlannedSet(weight: 225, reps: 5)
            ])
        ])
        try planRepo.create(plan)
        let session = try repo.createFromPlan(plan)
        let setToDelete = session.exercises[0].sets[0].id

        try repo.deleteSessionSet(setToDelete)

        let fetched = try repo.getById(session.id)
        XCTAssertEqual(fetched?.exercises[0].sets.count, 1)
    }

    // MARK: - getExerciseBestWeights

    func testGetExerciseBestWeightsReturnsMaxWeightPerExercise() throws {
        let plan = makePlan(exercises: [
            makePlannedExercise(name: "Bench Press", sets: [
                makePlannedSet(weight: 225, reps: 5),
                makePlannedSet(weight: 185, reps: 8)
            ])
        ])
        try planRepo.create(plan)
        let session = try repo.createFromPlan(plan)

        // Complete sets with actual values
        for exerciseSet in session.exercises[0].sets {
            try repo.updateSessionSet(
                exerciseSet.id,
                actualWeight: exerciseSet.targetWeight,
                actualWeightUnit: .lbs,
                actualReps: exerciseSet.targetReps,
                actualTime: nil,
                actualRpe: nil,
                status: .completed
            )
        }
        try repo.complete(session.id)

        let bestWeights = try repo.getExerciseBestWeights()
        XCTAssertNotNil(bestWeights["Bench Press"])
        XCTAssertEqual(bestWeights["Bench Press"]?.weight, 225)
    }

    func testGetExerciseBestWeightsEmptyWhenNoCompletedSessions() throws {
        let bestWeights = try repo.getExerciseBestWeights()
        XCTAssertTrue(bestWeights.isEmpty)
    }

    // MARK: - Helpers

    private func makePlan(
        name: String = "Test Plan",
        exercises: [PlannedExercise] = []
    ) -> WorkoutPlan {
        WorkoutPlan(name: name, exercises: exercises)
    }

    private func makePlannedExercise(
        name: String,
        sets: [PlannedSet] = []
    ) -> PlannedExercise {
        PlannedExercise(
            workoutPlanId: "plan-1",
            exerciseName: name,
            orderIndex: 0,
            sets: sets
        )
    }

    private func makePlannedSet(
        weight: Double? = nil,
        reps: Int? = nil
    ) -> PlannedSet {
        PlannedSet(
            plannedExerciseId: "ex-1",
            orderIndex: 0,
            targetWeight: weight,
            targetWeightUnit: weight != nil ? .lbs : nil,
            targetReps: reps
        )
    }
}
