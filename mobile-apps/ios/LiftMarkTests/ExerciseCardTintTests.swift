import XCTest
@testable import LiftMark

/// Tests for the pure mapping from `[SetStatus]` to `ExerciseCardTint`.
///
/// The rule: the card is only color-coded once every set is *finalized*
/// (either `.completed` or `.skipped`). Any `.pending` (or `.failed`)
/// set keeps the card neutral. See `spec/screens/active-workout.md`
/// → "Exercise Card Tinting".
final class ExerciseCardTintTests: XCTestCase {

    // MARK: - Neutral states

    func testEmptyStatusesIsNeutral() {
        XCTAssertEqual(ExerciseCardTint.from(statuses: []), .neutral)
    }

    func testAllPendingIsNeutral() {
        XCTAssertEqual(
            ExerciseCardTint.from(statuses: [.pending, .pending, .pending]),
            .neutral
        )
    }

    func testSomeCompletedSomePendingIsNeutral() {
        // In-progress exercise: the rule only applies to fully finalized ones.
        XCTAssertEqual(
            ExerciseCardTint.from(statuses: [.completed, .completed, .pending]),
            .neutral
        )
    }

    func testSomeSkippedSomePendingIsNeutral() {
        XCTAssertEqual(
            ExerciseCardTint.from(statuses: [.skipped, .pending]),
            .neutral
        )
    }

    func testCompletedAndSkippedWithTrailingPendingIsNeutral() {
        // Even with both completed and skipped present, any pending set
        // keeps the card neutral — it's still in progress.
        XCTAssertEqual(
            ExerciseCardTint.from(statuses: [.completed, .skipped, .pending]),
            .neutral
        )
    }

    func testFailedTreatedAsNonTerminalIsNeutral() {
        // `.failed` is not one of the two finalized terminal states used
        // by the tinting rule, so it keeps the card neutral.
        XCTAssertEqual(
            ExerciseCardTint.from(statuses: [.completed, .failed]),
            .neutral
        )
    }

    // MARK: - Green (all completed)

    func testAllCompletedIsCompleted() {
        XCTAssertEqual(
            ExerciseCardTint.from(statuses: [.completed, .completed, .completed]),
            .completed
        )
    }

    func testSingleCompletedIsCompleted() {
        XCTAssertEqual(
            ExerciseCardTint.from(statuses: [.completed]),
            .completed
        )
    }

    // MARK: - Amber (all skipped)

    func testAllSkippedIsSkipped() {
        XCTAssertEqual(
            ExerciseCardTint.from(statuses: [.skipped, .skipped]),
            .skipped
        )
    }

    func testSingleSkippedIsSkipped() {
        XCTAssertEqual(
            ExerciseCardTint.from(statuses: [.skipped]),
            .skipped
        )
    }

    // MARK: - Mixed (completed + skipped, all finalized)

    func testCompletedAndSkippedOnlyIsMixed() {
        XCTAssertEqual(
            ExerciseCardTint.from(statuses: [.completed, .skipped]),
            .mixed
        )
    }

    func testMixedOrderIndependent() {
        XCTAssertEqual(
            ExerciseCardTint.from(statuses: [.skipped, .completed, .skipped, .completed]),
            .mixed
        )
        XCTAssertEqual(
            ExerciseCardTint.from(statuses: [.completed, .completed, .skipped]),
            .mixed
        )
    }
}
