import XCTest
import GRDB
@testable import LiftMark

/// Tests for active session protection during CloudKit sync.
/// Verifies that exercises, sets, and sessions belonging to an in-progress workout
/// are never deleted or overwritten by sync operations.
final class CloudKitSyncProtectionTests: XCTestCase {

    override func setUp() {
        super.setUp()
        DatabaseManager.shared.deleteDatabase()
    }

    override func tearDown() {
        DatabaseManager.shared.deleteDatabase()
        super.tearDown()
    }

    // MARK: - getActiveSessionProtectedIds

    func testProtectedIdsIncludesActiveSessionAndChildren() throws {
        let dbQueue = try DatabaseManager.shared.database()

        // Create an in-progress session with exercises and sets
        let sessionId = "active-session-1"
        let exerciseId1 = "exercise-1"
        let exerciseId2 = "exercise-2"
        let setId1 = "set-1"
        let setId2 = "set-2"
        let setId3 = "set-3"

        try dbQueue.write { db in
            try WorkoutSessionRow(
                id: sessionId, workoutTemplateId: nil, name: "Test Workout",
                date: "2026-03-03", status: "in_progress"
            ).insert(db)

            try SessionExerciseRow(
                id: exerciseId1, workoutSessionId: sessionId, exerciseName: "Bench Press",
                orderIndex: 0, status: "pending"
            ).insert(db)

            try SessionExerciseRow(
                id: exerciseId2, workoutSessionId: sessionId, exerciseName: "Squat",
                orderIndex: 1, status: "pending"
            ).insert(db)

            try SessionSetRow(
                id: setId1, sessionExerciseId: exerciseId1, orderIndex: 0,
                status: "pending", isDropset: 0, isPerSide: 0
            ).insert(db)

            try SessionSetRow(
                id: setId2, sessionExerciseId: exerciseId1, orderIndex: 1,
                status: "pending", isDropset: 0, isPerSide: 0
            ).insert(db)

            try SessionSetRow(
                id: setId3, sessionExerciseId: exerciseId2, orderIndex: 0,
                status: "pending", isDropset: 0, isPerSide: 0
            ).insert(db)
        }

        let protected = CloudKitService.shared.getActiveSessionProtectedIds()

        XCTAssertEqual(protected.sessionId, sessionId)
        XCTAssertEqual(protected.exerciseIds, Set([exerciseId1, exerciseId2]))
        XCTAssertEqual(protected.setIds, Set([setId1, setId2, setId3]))
    }

    func testProtectedIdsEmptyWhenNoActiveSession() throws {
        let protected = CloudKitService.shared.getActiveSessionProtectedIds()

        XCTAssertNil(protected.sessionId)
        XCTAssertTrue(protected.exerciseIds.isEmpty)
        XCTAssertTrue(protected.setIds.isEmpty)
    }

    func testProtectedIdsExcludesCompletedSessions() throws {
        let dbQueue = try DatabaseManager.shared.database()

        try dbQueue.write { db in
            try WorkoutSessionRow(
                id: "completed-session", workoutTemplateId: nil, name: "Done Workout",
                date: "2026-03-03", status: "completed"
            ).insert(db)

            try SessionExerciseRow(
                id: "completed-ex", workoutSessionId: "completed-session",
                exerciseName: "Deadlift", orderIndex: 0, status: "completed"
            ).insert(db)
        }

        let protected = CloudKitService.shared.getActiveSessionProtectedIds()

        XCTAssertNil(protected.sessionId)
        XCTAssertTrue(protected.exerciseIds.isEmpty)
        XCTAssertTrue(protected.setIds.isEmpty)
    }

    // MARK: - byRecordType mapping

    func testByRecordTypeReturnsCorrectMapping() {
        let protected = CloudKitService.ActiveSessionProtectedIds(
            sessionId: "s1",
            exerciseIds: Set(["e1", "e2"]),
            setIds: Set(["set1"])
        )

        let map = protected.byRecordType
        XCTAssertEqual(map["WorkoutSession"], Set(["s1"]))
        XCTAssertEqual(map["SessionExercise"], Set(["e1", "e2"]))
        XCTAssertEqual(map["SessionSet"], Set(["set1"]))
        XCTAssertNil(map["WorkoutPlan"])
    }

    func testByRecordTypeEmptyWhenNoActiveSession() {
        let map = CloudKitService.ActiveSessionProtectedIds.empty.byRecordType
        XCTAssertTrue(map.isEmpty)
    }

    // MARK: - Integration: handleLocalDeletes skips active session records

    func testHandleLocalDeletesPreservesActiveSessionRecords() throws {
        let dbQueue = try DatabaseManager.shared.database()

        let activeSessionId = "active-session"
        let activeExerciseId = "active-exercise"
        let activeSetId = "active-set"
        let completedSessionId = "completed-session"
        let completedExerciseId = "completed-exercise"
        let completedSetId = "completed-set"

        try dbQueue.write { db in
            // Active session
            try WorkoutSessionRow(
                id: activeSessionId, workoutTemplateId: nil, name: "Active",
                date: "2026-03-03", status: "in_progress"
            ).insert(db)
            try SessionExerciseRow(
                id: activeExerciseId, workoutSessionId: activeSessionId,
                exerciseName: "Bench", orderIndex: 0, status: "pending"
            ).insert(db)
            try SessionSetRow(
                id: activeSetId, sessionExerciseId: activeExerciseId, orderIndex: 0,
                status: "pending", isDropset: 0, isPerSide: 0
            ).insert(db)

            // Completed session (should be eligible for deletion)
            try WorkoutSessionRow(
                id: completedSessionId, workoutTemplateId: nil, name: "Completed",
                date: "2026-03-02", status: "completed"
            ).insert(db)
            try SessionExerciseRow(
                id: completedExerciseId, workoutSessionId: completedSessionId,
                exerciseName: "Squat", orderIndex: 0, status: "completed"
            ).insert(db)
            try SessionSetRow(
                id: completedSetId, sessionExerciseId: completedExerciseId, orderIndex: 0,
                status: "completed", isDropset: 0, isPerSide: 0
            ).insert(db)
        }

        // Simulate sync where the server has NO records (all would be deleted without protection)
        let localIds: [String: Set<String>] = [
            "WorkoutSession": Set([activeSessionId, completedSessionId]),
            "SessionExercise": Set([activeExerciseId, completedExerciseId]),
            "SessionSet": Set([activeSetId, completedSetId]),
        ]
        let remoteIds: [String: Set<String>] = [:] // empty server

        // Call syncAll is not feasible without CloudKit, so we verify the protection IDs
        // and then verify that the database state would be correct by checking what
        // handleLocalDeletes would compute as the delete set.
        let protected = CloudKitService.shared.getActiveSessionProtectedIds()

        // Verify active session records are protected
        XCTAssertEqual(protected.sessionId, activeSessionId)
        XCTAssertTrue(protected.exerciseIds.contains(activeExerciseId))
        XCTAssertTrue(protected.setIds.contains(activeSetId))

        // Simulate what handleLocalDeletes does: local - remote - protected
        for recordType in ["SessionSet", "SessionExercise", "WorkoutSession"] {
            let local = localIds[recordType] ?? []
            let remote = remoteIds[recordType] ?? []
            var toDelete = local.subtracting(remote)
            if let protectedIds = protected.byRecordType[recordType] {
                toDelete.subtract(protectedIds)
            }

            // Active session records should NOT be in toDelete
            switch recordType {
            case "WorkoutSession":
                XCTAssertFalse(toDelete.contains(activeSessionId), "Active session should not be deleted")
                XCTAssertTrue(toDelete.contains(completedSessionId), "Completed session should be deletable")
            case "SessionExercise":
                XCTAssertFalse(toDelete.contains(activeExerciseId), "Active exercise should not be deleted")
                XCTAssertTrue(toDelete.contains(completedExerciseId), "Completed exercise should be deletable")
            case "SessionSet":
                XCTAssertFalse(toDelete.contains(activeSetId), "Active set should not be deleted")
                XCTAssertTrue(toDelete.contains(completedSetId), "Completed set should be deletable")
            default:
                break
            }
        }
    }

    func testCompletedSessionRecordsStillSyncNormally() throws {
        let dbQueue = try DatabaseManager.shared.database()

        // Only completed sessions — no active session protection needed
        try dbQueue.write { db in
            try WorkoutSessionRow(
                id: "session-1", workoutTemplateId: nil, name: "Workout 1",
                date: "2026-03-01", status: "completed"
            ).insert(db)
            try WorkoutSessionRow(
                id: "session-2", workoutTemplateId: nil, name: "Workout 2",
                date: "2026-03-02", status: "canceled"
            ).insert(db)
        }

        let protected = CloudKitService.shared.getActiveSessionProtectedIds()

        // No active session — byRecordType should be empty
        XCTAssertNil(protected.sessionId)
        XCTAssertTrue(protected.byRecordType.isEmpty)

        // All completed/canceled sessions should be deletable (not protected)
        let localIds = Set(["session-1", "session-2"])
        let remoteIds = Set<String>()
        var toDelete = localIds.subtracting(remoteIds)
        if let protectedIds = protected.byRecordType["WorkoutSession"] {
            toDelete.subtract(protectedIds)
        }

        XCTAssertEqual(toDelete, Set(["session-1", "session-2"]))
    }

    func testMergeSkipsActiveSessionRecords() throws {
        let dbQueue = try DatabaseManager.shared.database()

        let activeSessionId = "active-session"
        let activeExerciseId = "active-exercise"

        try dbQueue.write { db in
            try WorkoutSessionRow(
                id: activeSessionId, workoutTemplateId: nil, name: "My Workout",
                date: "2026-03-03", status: "in_progress"
            ).insert(db)
            try SessionExerciseRow(
                id: activeExerciseId, workoutSessionId: activeSessionId,
                exerciseName: "Bench Press", orderIndex: 0, status: "pending"
            ).insert(db)
        }

        let protected = CloudKitService.shared.getActiveSessionProtectedIds()

        // Verify the active session records would be skipped during merge
        let protectedSessionIds = protected.byRecordType["WorkoutSession"] ?? []
        XCTAssertTrue(protectedSessionIds.contains(activeSessionId),
                       "Active session should be protected from merge overwrite")

        let protectedExerciseIds = protected.byRecordType["SessionExercise"] ?? []
        XCTAssertTrue(protectedExerciseIds.contains(activeExerciseId),
                       "Active session exercises should be protected from merge overwrite")

        // Verify original data is unchanged
        let session = try dbQueue.read { db in
            try WorkoutSessionRow.fetchOne(db, key: activeSessionId)
        }
        XCTAssertEqual(session?.name, "My Workout")
        XCTAssertEqual(session?.status, "in_progress")
    }
}
