import XCTest
@testable import LiftMark

final class EnumTests: XCTestCase {

    // MARK: - WeightUnit

    func testWeightUnitRawValues() {
        XCTAssertEqual(WeightUnit.lbs.rawValue, "lbs")
        XCTAssertEqual(WeightUnit.kg.rawValue, "kg")
    }

    func testWeightUnitCodable() throws {
        let encoder = JSONEncoder()
        let decoder = JSONDecoder()

        let data = try encoder.encode(WeightUnit.kg)
        let decoded = try decoder.decode(WeightUnit.self, from: data)
        XCTAssertEqual(decoded, .kg)
    }

    // MARK: - SetStatus

    func testSetStatusRawValues() {
        XCTAssertEqual(SetStatus.pending.rawValue, "pending")
        XCTAssertEqual(SetStatus.completed.rawValue, "completed")
        XCTAssertEqual(SetStatus.skipped.rawValue, "skipped")
        XCTAssertEqual(SetStatus.failed.rawValue, "failed")
    }

    // MARK: - SessionStatus

    func testSessionStatusRawValues() {
        XCTAssertEqual(SessionStatus.inProgress.rawValue, "in_progress")
        XCTAssertEqual(SessionStatus.completed.rawValue, "completed")
        XCTAssertEqual(SessionStatus.canceled.rawValue, "canceled")
    }

    // MARK: - GroupType

    func testGroupTypeRawValues() {
        XCTAssertEqual(GroupType.superset.rawValue, "superset")
        XCTAssertEqual(GroupType.section.rawValue, "section")
    }

    // MARK: - AppTheme

    func testAppThemeRawValues() {
        XCTAssertEqual(AppTheme.light.rawValue, "light")
        XCTAssertEqual(AppTheme.dark.rawValue, "dark")
        XCTAssertEqual(AppTheme.auto.rawValue, "auto")
    }

    // MARK: - WorkoutDuration

    func testWorkoutDurationRawValues() {
        XCTAssertEqual(WorkoutDuration.short.rawValue, "short")
        XCTAssertEqual(WorkoutDuration.medium.rawValue, "medium")
        XCTAssertEqual(WorkoutDuration.long.rawValue, "long")
    }

    // MARK: - WorkoutDifficulty

    func testWorkoutDifficultyRawValues() {
        XCTAssertEqual(WorkoutDifficulty.beginner.rawValue, "beginner")
        XCTAssertEqual(WorkoutDifficulty.intermediate.rawValue, "intermediate")
        XCTAssertEqual(WorkoutDifficulty.advanced.rawValue, "advanced")
    }

    // MARK: - Model Init

    func testWorkoutSessionDefaultInit() {
        let session = WorkoutSession(name: "Test", date: "2024-01-15")
        XCTAssertEqual(session.name, "Test")
        XCTAssertEqual(session.date, "2024-01-15")
        XCTAssertEqual(session.status, .inProgress)
        XCTAssertTrue(session.exercises.isEmpty)
        XCTAssertFalse(session.id.isEmpty)
    }

    func testSessionExerciseDefaultInit() {
        let exercise = SessionExercise(
            workoutSessionId: "s1",
            exerciseName: "Bench Press",
            orderIndex: 0
        )
        XCTAssertEqual(exercise.exerciseName, "Bench Press")
        XCTAssertEqual(exercise.status, .pending)
        XCTAssertTrue(exercise.sets.isEmpty)
    }

    func testSessionSetDefaultInit() {
        let set = SessionSet(
            sessionExerciseId: "e1",
            orderIndex: 0,
            targetWeight: 225,
            targetWeightUnit: .lbs,
            targetReps: 5
        )
        XCTAssertEqual(set.targetWeight, 225)
        XCTAssertEqual(set.targetWeightUnit, .lbs)
        XCTAssertEqual(set.targetReps, 5)
        XCTAssertEqual(set.status, .pending)
        XCTAssertFalse(set.isDropset)
        XCTAssertFalse(set.isPerSide)
    }

    func testWorkoutPlanDefaultInit() {
        let plan = WorkoutPlan(name: "Push Day")
        XCTAssertEqual(plan.name, "Push Day")
        XCTAssertTrue(plan.tags.isEmpty)
        XCTAssertNil(plan.defaultWeightUnit)
        XCTAssertFalse(plan.isFavorite)
        XCTAssertTrue(plan.exercises.isEmpty)
    }

    func testPlannedExerciseDefaultInit() {
        let exercise = PlannedExercise(
            workoutPlanId: "p1",
            exerciseName: "Squat",
            orderIndex: 0
        )
        XCTAssertEqual(exercise.exerciseName, "Squat")
        XCTAssertTrue(exercise.sets.isEmpty)
        XCTAssertNil(exercise.groupType)
    }

    func testPlannedSetDefaultInit() {
        let set = PlannedSet(
            plannedExerciseId: "e1",
            orderIndex: 0,
            targetWeight: 135,
            targetWeightUnit: .lbs,
            targetReps: 10
        )
        XCTAssertEqual(set.targetWeight, 135)
        XCTAssertEqual(set.targetReps, 10)
        XCTAssertFalse(set.isDropset)
        XCTAssertFalse(set.isPerSide)
        XCTAssertFalse(set.isAmrap)
    }

    // MARK: - Highlight Types

    func testHighlightTypeExists() {
        let highlight = WorkoutHighlight(type: .pr, emoji: "🎉", title: "PR!", message: "New record")
        XCTAssertEqual(highlight.type, .pr)
        XCTAssertEqual(highlight.emoji, "🎉")
        XCTAssertFalse(highlight.id.isEmpty)
    }

    func testAllHighlightTypes() {
        _ = WorkoutHighlight(type: .pr, emoji: "🎉", title: "t", message: "m")
        _ = WorkoutHighlight(type: .weightIncrease, emoji: "💪", title: "t", message: "m")
        _ = WorkoutHighlight(type: .volumeIncrease, emoji: "📈", title: "t", message: "m")
        _ = WorkoutHighlight(type: .streak, emoji: "🔥", title: "t", message: "m")
    }

    // MARK: - CloudKit Account Status

    func testCloudKitAccountStatusRawValues() {
        XCTAssertEqual(CloudKitAccountStatus.available.rawValue, "available")
        XCTAssertEqual(CloudKitAccountStatus.noAccount.rawValue, "noAccount")
        XCTAssertEqual(CloudKitAccountStatus.restricted.rawValue, "restricted")
        XCTAssertEqual(CloudKitAccountStatus.couldNotDetermine.rawValue, "couldNotDetermine")
        XCTAssertEqual(CloudKitAccountStatus.error.rawValue, "error")
    }

    // MARK: - FileImportResult

    func testFileImportResultSuccess() {
        let result = FileImportResult(success: true, markdown: "# Test", fileName: "test.md", error: nil)
        XCTAssertTrue(result.success)
        XCTAssertEqual(result.markdown, "# Test")
        XCTAssertNil(result.error)
    }

    func testFileImportResultFailure() {
        let result = FileImportResult(success: false, markdown: nil, fileName: nil, error: "Bad file")
        XCTAssertFalse(result.success)
        XCTAssertEqual(result.error, "Bad file")
    }

    // MARK: - ExportError

    func testExportErrorDescriptions() {
        let noWorkouts = ExportError.noCompletedWorkouts
        XCTAssertTrue(noWorkouts.localizedDescription.contains("No completed workouts"))

        let writeFail = ExportError.fileWriteFailed("disk full")
        XCTAssertTrue(writeFail.localizedDescription.contains("disk full"))
    }

    // MARK: - WorkoutGenerationError

    func testWorkoutGenerationErrorDescription() {
        let error = WorkoutGenerationError.parseFailed("invalid format")
        XCTAssertTrue(error.localizedDescription.contains("invalid format"))
    }

    // MARK: - VolumeComparison

    func testVolumeComparisonInit() {
        let comparison = VolumeComparison(currentVolume: 10000, previousVolume: 8000, percentageIncrease: 25)
        XCTAssertEqual(comparison.currentVolume, 10000)
        XCTAssertEqual(comparison.previousVolume, 8000)
        XCTAssertEqual(comparison.percentageIncrease, 25)
    }

    // MARK: - ExercisePR

    func testExercisePRInit() {
        let pr = ExercisePR(exerciseName: "Bench", newWeight: 225, newReps: 5, oldWeight: 215, oldReps: 5, unit: "lbs")
        XCTAssertEqual(pr.exerciseName, "Bench")
        XCTAssertEqual(pr.newWeight, 225)
        XCTAssertEqual(pr.oldWeight, 215)
    }
}
