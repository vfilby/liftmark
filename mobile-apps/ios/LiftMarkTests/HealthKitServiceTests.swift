import XCTest
@testable import LiftMark

final class HealthKitServiceTests: XCTestCase {

    // MARK: - calculateWorkoutVolume

    func testVolumeWithMultipleCompletedSets() {
        let session = makeSession(exercises: [
            makeExercise(sets: [
                makeSet(actualWeight: 135, actualReps: 10, status: .completed),
                makeSet(actualWeight: 185, actualReps: 8, status: .completed),
                makeSet(actualWeight: 225, actualReps: 5, status: .completed)
            ])
        ])
        // 135*10 + 185*8 + 225*5 = 1350 + 1480 + 1125 = 3955
        XCTAssertEqual(HealthKitService.calculateWorkoutVolume(session), 3955)
    }

    func testVolumeIgnoresSkippedSets() {
        let session = makeSession(exercises: [
            makeExercise(sets: [
                makeSet(actualWeight: 135, actualReps: 10, status: .completed),
                makeSet(actualWeight: 225, actualReps: 5, status: .skipped)
            ])
        ])
        XCTAssertEqual(HealthKitService.calculateWorkoutVolume(session), 1350)
    }

    func testVolumeIgnoresPendingSets() {
        let session = makeSession(exercises: [
            makeExercise(sets: [
                makeSet(actualWeight: 100, actualReps: 10, status: .completed),
                makeSet(actualWeight: 100, actualReps: 10, status: .pending)
            ])
        ])
        XCTAssertEqual(HealthKitService.calculateWorkoutVolume(session), 1000)
    }

    func testVolumeIgnoresFailedSets() {
        let session = makeSession(exercises: [
            makeExercise(sets: [
                makeSet(actualWeight: 100, actualReps: 10, status: .completed),
                makeSet(actualWeight: 100, actualReps: 10, status: .failed)
            ])
        ])
        XCTAssertEqual(HealthKitService.calculateWorkoutVolume(session), 1000)
    }

    func testVolumeIsZeroForBodyweightOnly() {
        let session = makeSession(exercises: [
            makeExercise(sets: [
                makeSet(actualWeight: nil, actualReps: 20, status: .completed),
                makeSet(actualWeight: nil, actualReps: 15, status: .completed)
            ])
        ])
        XCTAssertEqual(HealthKitService.calculateWorkoutVolume(session), 0)
    }

    func testVolumeIsZeroForEmptySession() {
        let session = makeSession(exercises: [])
        XCTAssertEqual(HealthKitService.calculateWorkoutVolume(session), 0)
    }

    func testVolumeIsZeroWhenNoReps() {
        let session = makeSession(exercises: [
            makeExercise(sets: [
                makeSet(actualWeight: 225, actualReps: nil, status: .completed)
            ])
        ])
        XCTAssertEqual(HealthKitService.calculateWorkoutVolume(session), 0)
    }

    func testVolumeAcrossMultipleExercises() {
        let session = makeSession(exercises: [
            makeExercise(name: "Bench Press", sets: [
                makeSet(actualWeight: 135, actualReps: 10, status: .completed)
            ]),
            makeExercise(name: "Squat", sets: [
                makeSet(actualWeight: 225, actualReps: 5, status: .completed)
            ])
        ])
        // 135*10 + 225*5 = 1350 + 1125 = 2475
        XCTAssertEqual(HealthKitService.calculateWorkoutVolume(session), 2475)
    }

    func testVolumeWithMixedCompletedAndSkipped() {
        let session = makeSession(exercises: [
            makeExercise(sets: [
                makeSet(actualWeight: 100, actualReps: 10, status: .completed),
                makeSet(actualWeight: 100, actualReps: 10, status: .skipped),
                makeSet(actualWeight: 100, actualReps: 8, status: .completed),
                makeSet(actualWeight: 100, actualReps: 6, status: .failed)
            ])
        ])
        // Only completed: 100*10 + 100*8 = 1800
        XCTAssertEqual(HealthKitService.calculateWorkoutVolume(session), 1800)
    }

    // MARK: - HealthKit availability on simulator

    // Note: a previous `testSaveWorkoutFailsGracefullyOnSimulator` test was deleted in
    // GH #107. It exercised an async test method whose body did no real async work on
    // simulator (`HealthKitService.saveWorkout` returns immediately from its
    // `isHealthDataAvailable` guard). On macos-26 / Xcode 26 it intermittently tripped
    // an XCTest-internal crash (`XCTActivityRecordStack finishedPlaying:`, see
    // actions/runner-images #13853) — flaky framework bug, not our code. The behavior
    // it covered (a 4-line guard returning a failure result) was redundant with
    // `testIsHealthKitAvailableDoesNotCrash` + inspection of the guard, and
    // simulator-side coverage of `saveWorkout` had no real signal.

    func testIsHealthKitAvailableDoesNotCrash() {
        // Should return a boolean without crashing, regardless of platform
        _ = HealthKitService.isHealthKitAvailable()
    }

    func testIsAuthorizedReturnsFalseWhenUnavailable() {
        if !HealthKitService.isHealthKitAvailable() {
            XCTAssertFalse(HealthKitService.isAuthorized())
        }
    }

    func testRequestAuthorizationReturnsFalseWhenUnavailable() async {
        if !HealthKitService.isHealthKitAvailable() {
            let result = await HealthKitService.requestAuthorization()
            XCTAssertFalse(result)
        }
    }

    // MARK: - Helpers

    private func makeSession(
        exercises: [SessionExercise] = []
    ) -> WorkoutSession {
        WorkoutSession(
            name: "Test Workout",
            date: "2024-06-15",
            startTime: "2024-06-15T10:00:00Z",
            endTime: "2024-06-15T11:00:00Z",
            duration: 3600,
            exercises: exercises,
            status: .completed
        )
    }

    private func makeExercise(
        name: String = "Exercise",
        sets: [SessionSet] = []
    ) -> SessionExercise {
        SessionExercise(
            workoutSessionId: "s1",
            exerciseName: name,
            orderIndex: 0,
            sets: sets,
            status: .completed
        )
    }

    private func makeSet(
        actualWeight: Double? = nil,
        actualReps: Int? = nil,
        status: SetStatus = .completed
    ) -> SessionSet {
        SessionSet(
            sessionExerciseId: "e1",
            orderIndex: 0,
            actualWeight: actualWeight,
            actualWeightUnit: actualWeight != nil ? .lbs : nil,
            actualReps: actualReps,
            status: status
        )
    }
}
