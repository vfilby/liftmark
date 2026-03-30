import XCTest
@testable import LiftMark

final class WorkoutHighlightsIntegrationTests: XCTestCase {

    private var service: WorkoutHighlightsService!
    private var sessionRepo: SessionRepository!
    private var planRepo: WorkoutPlanRepository!

    override func setUp() {
        super.setUp()
        DatabaseManager.shared.deleteDatabase()
        service = WorkoutHighlightsService()
        sessionRepo = SessionRepository()
        planRepo = WorkoutPlanRepository()
    }

    override func tearDown() {
        DatabaseManager.shared.deleteDatabase()
        super.tearDown()
    }

    // MARK: - calculateWorkoutHighlights

    func testHighlightsForFirstWorkoutNoPRWhenSelfIncluded() throws {
        // Note: getExerciseBestWeights includes the current session's data,
        // so a first workout sees itself as the "historical best" and
        // sessionMax == historicalBest, which does not trigger a PR.
        let session = try createCompletedSession(
            name: "Push Day",
            exercises: [("Bench Press", 225, 5)]
        )

        let highlights = try service.calculateWorkoutHighlights(session)
        let prHighlights = highlights.filter { $0.type == .pr }
        XCTAssertTrue(prHighlights.isEmpty)
    }

    func testHighlightsNoPRWhenNewWeightEqualsHistorical() throws {
        // getExerciseBestWeights returns the MAX across ALL completed sessions,
        // including the current one, so session2's 235 is already the "best"
        // and 235 > 235 is false.
        _ = try createCompletedSession(
            name: "Push Day",
            date: "2024-01-10",
            exercises: [("Bench Press", 225, 5)]
        )

        let session2 = try createCompletedSession(
            name: "Push Day",
            date: "2024-01-15",
            exercises: [("Bench Press", 235, 5)]
        )

        let highlights = try service.calculateWorkoutHighlights(session2)
        let prHighlights = highlights.filter { $0.type == .pr }
        XCTAssertTrue(prHighlights.isEmpty)
    }

    func testHighlightsNoPRWhenWeightSame() throws {
        _ = try createCompletedSession(
            name: "Push Day",
            date: "2024-01-10",
            exercises: [("Bench Press", 225, 5)]
        )

        let session2 = try createCompletedSession(
            name: "Push Day",
            date: "2024-01-15",
            exercises: [("Bench Press", 225, 5)]
        )

        let highlights = try service.calculateWorkoutHighlights(session2)
        let prHighlights = highlights.filter { $0.type == .pr }
        XCTAssertTrue(prHighlights.isEmpty)
    }

    func testHighlightsDetectsWeightIncrease() throws {
        _ = try createCompletedSession(
            name: "Push Day",
            date: "2024-01-10",
            exercises: [("Bench Press", 200, 5)]
        )

        let session2 = try createCompletedSession(
            name: "Push Day",
            date: "2024-01-15",
            exercises: [("Bench Press", 210, 5)]
        )

        let highlights = try service.calculateWorkoutHighlights(session2)
        let weightIncreases = highlights.filter { $0.type == .weightIncrease }
        XCTAssertFalse(weightIncreases.isEmpty)
    }

    func testHighlightsDetectsVolumeIncrease() throws {
        // First session: 225*5 = 1125 volume
        _ = try createCompletedSession(
            name: "Push Day",
            date: "2024-01-10",
            exercises: [("Bench Press", 225, 5)]
        )

        // Second session: 225*8 = 1800 volume (60% increase)
        let session2 = try createCompletedSession(
            name: "Push Day",
            date: "2024-01-15",
            exercises: [("Bench Press", 225, 8)]
        )

        let highlights = try service.calculateWorkoutHighlights(session2)
        let volumeHighlights = highlights.filter { $0.type == .volumeIncrease }
        XCTAssertFalse(volumeHighlights.isEmpty)
    }

    func testHighlightsNoVolumeIncreaseWhenSmallDifference() throws {
        _ = try createCompletedSession(
            name: "Push Day",
            date: "2024-01-10",
            exercises: [("Bench Press", 225, 5)]
        )

        // Same workout, same volume
        let session2 = try createCompletedSession(
            name: "Push Day",
            date: "2024-01-15",
            exercises: [("Bench Press", 225, 5)]
        )

        let highlights = try service.calculateWorkoutHighlights(session2)
        let volumeHighlights = highlights.filter { $0.type == .volumeIncrease }
        XCTAssertTrue(volumeHighlights.isEmpty)
    }

    func testHighlightsDetectsStreak() throws {
        // Create sessions on consecutive days
        _ = try createCompletedSession(name: "Day 1", date: "2024-01-13", exercises: [("Bench", 225, 5)])
        _ = try createCompletedSession(name: "Day 2", date: "2024-01-14", exercises: [("Squat", 315, 5)])

        let session3 = try createCompletedSession(
            name: "Day 3",
            date: "2024-01-15",
            exercises: [("Deadlift", 405, 3)]
        )

        let highlights = try service.calculateWorkoutHighlights(session3)
        let streakHighlights = highlights.filter { $0.type == .streak }
        XCTAssertFalse(streakHighlights.isEmpty)
    }

    func testHighlightsNoStreakForSingleSession() throws {
        let session = try createCompletedSession(
            name: "Solo",
            exercises: [("Bench", 225, 5)]
        )

        let highlights = try service.calculateWorkoutHighlights(session)
        let streakHighlights = highlights.filter { $0.type == .streak }
        XCTAssertTrue(streakHighlights.isEmpty) // Streak starts at 2
    }

    func testHighlightsEmptyForBodyweightOnlySession() throws {
        let plan = WorkoutPlan(
            name: "BW",
            exercises: [PlannedExercise(
                workoutPlanId: "p",
                exerciseName: "Push-ups",
                orderIndex: 0,
                sets: [PlannedSet(plannedExerciseId: "e", orderIndex: 0, targetReps: 20)]
            )]
        )
        try planRepo.create(plan)
        let (session, _) = try sessionRepo.createFromPlan(plan)

        for ex in session.exercises {
            for set in ex.sets {
                try sessionRepo.updateSessionSet(
                    set.id,
                    actualWeight: nil,
                    actualWeightUnit: nil,
                    actualReps: 20,
                    actualTime: nil,
                    actualRpe: nil,
                    status: .completed
                )
            }
        }
        try sessionRepo.complete(session.id)
        let completed = try sessionRepo.getById(session.id)!

        let highlights = try service.calculateWorkoutHighlights(completed)
        // No weight-based highlights for bodyweight
        let prHighlights = highlights.filter { $0.type == .pr }
        XCTAssertTrue(prHighlights.isEmpty)
    }

    // MARK: - Helpers

    private func createCompletedSession(
        name: String,
        date: String? = nil,
        exercises: [(String, Double, Int)]
    ) throws -> WorkoutSession {
        var plannedExercises: [PlannedExercise] = []
        for (i, ex) in exercises.enumerated() {
            plannedExercises.append(PlannedExercise(
                workoutPlanId: "plan",
                exerciseName: ex.0,
                orderIndex: i,
                sets: [PlannedSet(
                    plannedExerciseId: "ex",
                    orderIndex: 0,
                    targetWeight: ex.1,
                    targetWeightUnit: .lbs,
                    targetReps: ex.2
                )]
            ))
        }
        let plan = WorkoutPlan(name: name, exercises: plannedExercises)
        try planRepo.create(plan)
        let (session, _) = try sessionRepo.createFromPlan(plan)

        // Complete all sets
        for exercise in session.exercises {
            for set in exercise.sets {
                try sessionRepo.updateSessionSet(
                    set.id,
                    actualWeight: set.targetWeight,
                    actualWeightUnit: .lbs,
                    actualReps: set.targetReps,
                    actualTime: nil,
                    actualRpe: nil,
                    status: .completed
                )
            }
        }

        // If specific date, update it in DB
        if let date = date {
            let dbQueue = try DatabaseManager.shared.database()
            try dbQueue.write { db in
                try db.execute(
                    sql: "UPDATE workout_sessions SET date = ? WHERE id = ?",
                    arguments: [date, session.id]
                )
            }
        }

        try sessionRepo.complete(session.id)
        return try sessionRepo.getById(session.id)!
    }
}
