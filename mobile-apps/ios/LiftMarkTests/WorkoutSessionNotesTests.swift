import XCTest
@testable import LiftMark

/// Tests for workout-level notes on the completed-session record.
/// Issue GH #91 — free-text notes editable mid-session, promptable at finish,
/// editable later from history, and round-tripped through LMWF.
final class WorkoutSessionNotesTests: XCTestCase {

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

    // MARK: - Fixtures

    private func makeSession() throws -> WorkoutSession {
        let set = PlannedSet(
            plannedExerciseId: "ex-1",
            orderIndex: 0,
            targetWeight: 225,
            targetWeightUnit: .lbs,
            targetReps: 5
        )
        let exercise = PlannedExercise(
            workoutPlanId: "plan-1",
            exerciseName: "Bench Press",
            orderIndex: 0,
            sets: [set]
        )
        let plan = WorkoutPlan(name: "Push Day", exercises: [exercise])
        try planRepo.create(plan)
        let (session, _) = try repo.createFromPlan(plan)
        return session
    }

    // MARK: - Repository

    func testNewSessionHasNoNotes() throws {
        let session = try makeSession()
        XCTAssertNil(session.notes)
    }

    func testUpdateSessionNotesPersists() throws {
        let session = try makeSession()
        try repo.updateSessionNotes(session.id, notes: "Felt strong on the top set.")

        let reloaded = try repo.getById(session.id)
        XCTAssertEqual(reloaded?.notes, "Felt strong on the top set.")
    }

    func testUpdateSessionNotesOverwrites() throws {
        let session = try makeSession()
        try repo.updateSessionNotes(session.id, notes: "First pass")
        try repo.updateSessionNotes(session.id, notes: "Second pass")

        let reloaded = try repo.getById(session.id)
        XCTAssertEqual(reloaded?.notes, "Second pass")
    }

    func testUpdateSessionNotesTrimsAndNormalizesEmptyToNil() throws {
        let session = try makeSession()
        try repo.updateSessionNotes(session.id, notes: "   \n  \t ")

        let reloaded = try repo.getById(session.id)
        XCTAssertNil(reloaded?.notes, "Whitespace-only notes should be normalized to nil")
    }

    func testUpdateSessionNotesNilClears() throws {
        let session = try makeSession()
        try repo.updateSessionNotes(session.id, notes: "Something")
        try repo.updateSessionNotes(session.id, notes: nil)

        let reloaded = try repo.getById(session.id)
        XCTAssertNil(reloaded?.notes)
    }

    func testUpdateSessionNotesTrimsLeadingTrailingWhitespace() throws {
        let session = try makeSession()
        try repo.updateSessionNotes(session.id, notes: "\n  Great session.  \n")

        let reloaded = try repo.getById(session.id)
        XCTAssertEqual(reloaded?.notes, "Great session.")
    }

    func testUpdateSessionNotesReturnsSyncChange() throws {
        let session = try makeSession()
        let changes = try repo.updateSessionNotes(session.id, notes: "Hi")
        XCTAssertEqual(changes.count, 1)
        switch changes[0] {
        case .save(let recordType, let recordID):
            XCTAssertEqual(recordType, "WorkoutSession")
            XCTAssertEqual(recordID, session.id)
        default:
            XCTFail("Expected save SyncChange")
        }
    }

    func testNotesSurviveCompletion() throws {
        let session = try makeSession()
        try repo.updateSessionNotes(session.id, notes: "Logged mid-session.")
        try repo.complete(session.id)

        let reloaded = try repo.getById(session.id)
        XCTAssertEqual(reloaded?.status, .completed)
        XCTAssertEqual(reloaded?.notes, "Logged mid-session.")
    }

    func testMultilineNotesPersist() throws {
        let session = try makeSession()
        let multiline = "Line 1\nLine 2\n\nLine 4"
        try repo.updateSessionNotes(session.id, notes: multiline)
        let reloaded = try repo.getById(session.id)
        XCTAssertEqual(reloaded?.notes, multiline)
    }
}
