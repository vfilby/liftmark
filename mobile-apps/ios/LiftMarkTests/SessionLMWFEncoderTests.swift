import XCTest
@testable import LiftMark

/// Tests for `SessionLMWFEncoder` — ensures a completed `WorkoutSession`
/// encodes to valid LMWF and round-trips cleanly back through `MarkdownParser`.
///
/// Specifically verifies GH #91: workout-level notes are emitted as the LMWF
/// "freeform notes after workout header" block, and survive the round trip.
final class SessionLMWFEncoderTests: XCTestCase {

    // MARK: - Session Fixtures

    private func sessionWithNotes(_ notes: String?) -> WorkoutSession {
        let set = SessionSet(
            id: "s1",
            sessionExerciseId: "ex1",
            orderIndex: 0,
            targetWeight: 225, targetWeightUnit: .lbs, targetReps: 5,
            actualWeight: 225, actualWeightUnit: .lbs, actualReps: 5,
            status: .completed
        )
        let exercise = SessionExercise(
            id: "ex1",
            workoutSessionId: "sess1",
            exerciseName: "Bench Press",
            orderIndex: 0,
            sets: [set]
        )
        return WorkoutSession(
            id: "sess1",
            name: "Push Day",
            date: "2026-04-22",
            notes: notes,
            exercises: [exercise],
            status: .completed
        )
    }

    // MARK: - Encoder Smoke

    func testEncodeEmitsHeader() {
        let session = sessionWithNotes(nil)
        let out = SessionLMWFEncoder.encode(session)
        XCTAssertTrue(out.hasPrefix("# Push Day"))
    }

    func testEncodeEmitsExerciseAndSet() {
        let session = sessionWithNotes(nil)
        let out = SessionLMWFEncoder.encode(session)
        XCTAssertTrue(out.contains("## Bench Press"))
        XCTAssertTrue(out.contains("- 225 lbs x 5"))
    }

    func testEncodeOmitsNotesWhenAbsent() {
        let session = sessionWithNotes(nil)
        let out = SessionLMWFEncoder.encode(session)
        // Notes block would be a non-metadata, non-exercise line between header and exercise.
        let parsed = MarkdownParser.parseWorkout(out)
        XCTAssertTrue(parsed.success)
        XCTAssertNil(parsed.data?.description)
    }

    // MARK: - Workout Notes Round-Trip (GH #91)

    func testWorkoutNotesRoundTripSingleLine() {
        let session = sessionWithNotes("Felt strong on the top set.")
        let lmwf = SessionLMWFEncoder.encode(session)

        let parsed = MarkdownParser.parseWorkout(lmwf)
        XCTAssertTrue(parsed.success, "LMWF must parse: \(lmwf)")
        XCTAssertEqual(parsed.data?.description, "Felt strong on the top set.")
    }

    func testWorkoutNotesRoundTripMultiline() {
        let notes = "Started tired.\nBench felt solid.\nBack to 3 plates next week."
        let session = sessionWithNotes(notes)
        let lmwf = SessionLMWFEncoder.encode(session)

        let parsed = MarkdownParser.parseWorkout(lmwf)
        XCTAssertTrue(parsed.success)
        XCTAssertEqual(parsed.data?.description, notes)
    }

    func testEmptyNotesSkippedInOutput() {
        let session = sessionWithNotes("")
        let lmwf = SessionLMWFEncoder.encode(session)
        let parsed = MarkdownParser.parseWorkout(lmwf)
        XCTAssertTrue(parsed.success)
        XCTAssertNil(parsed.data?.description)
    }

    func testWhitespaceOnlyNotesSkipped() {
        let session = sessionWithNotes("   \n\n  ")
        let lmwf = SessionLMWFEncoder.encode(session)
        let parsed = MarkdownParser.parseWorkout(lmwf)
        XCTAssertTrue(parsed.success)
        XCTAssertNil(parsed.data?.description)
    }

    // MARK: - Exercise Structure Survives Round Trip

    func testExerciseRoundTripWithNotes() {
        let set = SessionSet(
            id: "s1",
            sessionExerciseId: "ex1",
            orderIndex: 0,
            targetWeight: 135, targetWeightUnit: .lbs, targetReps: 8,
            restSeconds: 90,
            actualWeight: 135, actualWeightUnit: .lbs, actualReps: 8,
            status: .completed
        )
        let exercise = SessionExercise(
            id: "ex1",
            workoutSessionId: "sess1",
            exerciseName: "Overhead Press",
            orderIndex: 0,
            equipmentType: "barbell",
            sets: [set]
        )
        let session = WorkoutSession(
            id: "sess1",
            name: "Shoulders",
            date: "2026-04-22",
            notes: "Shoulder warmup helped.",
            exercises: [exercise],
            status: .completed
        )

        let lmwf = SessionLMWFEncoder.encode(session)
        let parsed = MarkdownParser.parseWorkout(lmwf)

        XCTAssertTrue(parsed.success)
        XCTAssertEqual(parsed.data?.name, "Shoulders")
        XCTAssertEqual(parsed.data?.description, "Shoulder warmup helped.")
        XCTAssertEqual(parsed.data?.exercises.count, 1)
        let parsedExercise = parsed.data?.exercises[0]
        XCTAssertEqual(parsedExercise?.exerciseName, "Overhead Press")
        XCTAssertEqual(parsedExercise?.equipmentType, "barbell")
        XCTAssertEqual(parsedExercise?.sets.count, 1)
        XCTAssertEqual(parsedExercise?.sets[0].targetWeight, 135)
        XCTAssertEqual(parsedExercise?.sets[0].targetReps, 8)
        XCTAssertEqual(parsedExercise?.sets[0].restSeconds, 90)
    }

    func testBodyweightRepsRoundTrip() {
        let set = SessionSet(
            id: "s1",
            sessionExerciseId: "ex1",
            orderIndex: 0,
            targetReps: 10,
            actualReps: 10,
            status: .completed
        )
        let exercise = SessionExercise(
            id: "ex1",
            workoutSessionId: "sess1",
            exerciseName: "Pull-ups",
            orderIndex: 0,
            sets: [set]
        )
        let session = WorkoutSession(
            id: "sess1",
            name: "Pulling",
            date: "2026-04-22",
            exercises: [exercise],
            status: .completed
        )

        let lmwf = SessionLMWFEncoder.encode(session)
        let parsed = MarkdownParser.parseWorkout(lmwf)
        XCTAssertTrue(parsed.success)
        XCTAssertEqual(parsed.data?.exercises.first?.sets.first?.targetReps, 10)
    }

    func testTimeBasedSetRoundTrip() {
        let set = SessionSet(
            id: "s1",
            sessionExerciseId: "ex1",
            orderIndex: 0,
            targetTime: 60,
            actualTime: 60,
            status: .completed
        )
        let exercise = SessionExercise(
            id: "ex1",
            workoutSessionId: "sess1",
            exerciseName: "Plank",
            orderIndex: 0,
            sets: [set]
        )
        let session = WorkoutSession(
            id: "sess1",
            name: "Core",
            date: "2026-04-22",
            exercises: [exercise],
            status: .completed
        )

        let lmwf = SessionLMWFEncoder.encode(session)
        let parsed = MarkdownParser.parseWorkout(lmwf)
        XCTAssertTrue(parsed.success)
        XCTAssertEqual(parsed.data?.exercises.first?.sets.first?.targetTime, 60)
    }
}
