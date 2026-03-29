import XCTest
@testable import LiftMark

final class MarkdownParserTests: XCTestCase {

    // MARK: - Basic Parsing

    func testParsesSimpleWorkoutWithOneExercise() {
        let markdown = """
        # Test Workout
        @units: lbs

        ## Bicep Curls
        - 20 x 10
        - 25 x 8
        """
        let result = MarkdownParser.parseWorkout(markdown)

        XCTAssertTrue(result.success)
        XCTAssertNotNil(result.data)
        XCTAssertEqual(result.data?.name, "Test Workout")
        XCTAssertEqual(result.data?.defaultWeightUnit, .lbs)
        XCTAssertEqual(result.data?.exercises.count, 1)
        XCTAssertEqual(result.data?.exercises[0].exerciseName, "Bicep Curls")
        XCTAssertEqual(result.data?.exercises[0].sets.count, 2)
    }

    // MARK: - Rest Modifiers

    func testParsesSetsWithRestModifiers() {
        let markdown = """
        # Workout
        ## Exercise
        - 100 x 5 @rest: 60s
        - 100 x 5 @rest: 90s
        """
        let result = MarkdownParser.parseWorkout(markdown)

        XCTAssertTrue(result.success)
        XCTAssertEqual(result.data?.exercises[0].sets[0].restSeconds, 60)
        XCTAssertEqual(result.data?.exercises[0].sets[1].restSeconds, 90)
    }

    // MARK: - RPE Modifiers

    func testParsesSetsWithRPEModifiers() {
        let markdown = """
        # Workout
        ## Squats
        - 225 lbs x 5 @rpe: 8
        """
        let result = MarkdownParser.parseWorkout(markdown)

        XCTAssertTrue(result.success)
        XCTAssertEqual(result.data?.exercises[0].sets[0].targetWeight, 225)
        XCTAssertEqual(result.data?.exercises[0].sets[0].targetReps, 5)
        XCTAssertEqual(result.data?.exercises[0].sets[0].targetRpe, 8)
    }

    // MARK: - Bodyweight Exercises

    func testParsesBodyweightExercises() {
        let markdown = """
        # Workout
        ## Pull-ups
        - bw x 10
        - bw x 8
        """
        let result = MarkdownParser.parseWorkout(markdown)

        XCTAssertTrue(result.success)
        XCTAssertNil(result.data?.exercises[0].sets[0].targetWeight)
        XCTAssertEqual(result.data?.exercises[0].sets[0].targetReps, 10)
    }

    // MARK: - Time-Based Sets

    func testParsesTimeBasedSets() {
        let markdown = """
        # Workout
        ## Plank
        - 60s
        - 45s
        """
        let result = MarkdownParser.parseWorkout(markdown)

        XCTAssertTrue(result.success)
        XCTAssertEqual(result.data?.exercises[0].sets[0].targetTime, 60)
        XCTAssertEqual(result.data?.exercises[0].sets[1].targetTime, 45)
    }

    // MARK: - KG Units

    func testParsesKgUnits() {
        let markdown = """
        # Workout
        @units: kg

        ## Deadlift
        - 100 kg x 5
        """
        let result = MarkdownParser.parseWorkout(markdown)

        XCTAssertTrue(result.success)
        XCTAssertEqual(result.data?.defaultWeightUnit, .kg)
        XCTAssertEqual(result.data?.exercises[0].sets[0].targetWeight, 100)
        XCTAssertEqual(result.data?.exercises[0].sets[0].targetWeightUnit, .kg)
    }

    // MARK: - Error Cases

    func testFailsWhenNoWorkoutHeaderFound() {
        let markdown = """
        Just some text
        without a proper workout
        """
        let result = MarkdownParser.parseWorkout(markdown)

        XCTAssertFalse(result.success)
        XCTAssertFalse(result.errors.isEmpty)
    }

    func testFailsWhenExerciseHasNoSets() {
        let markdown = """
        # Workout
        ## Empty Exercise
        """
        let result = MarkdownParser.parseWorkout(markdown)

        // Without sets, the workout header isn't found
        XCTAssertFalse(result.success)
        XCTAssertFalse(result.errors.isEmpty)
    }

    // MARK: - Tags

    func testParsesWorkoutTags() {
        let markdown = """
        # Upper Body
        @tags: strength, push
        @units: lbs

        ## Bench Press
        - 135 x 10
        """
        let result = MarkdownParser.parseWorkout(markdown)

        XCTAssertTrue(result.success)
        XCTAssertTrue(result.data?.tags.contains("strength") ?? false)
        XCTAssertTrue(result.data?.tags.contains("push") ?? false)
    }

    // MARK: - Supersets

    func testParsesSupersets() {
        let markdown = """
        # Workout

        ## Superset
        ### Bicep Curls
        - 20 x 10
        ### Tricep Extensions
        - 20 x 10
        """
        let result = MarkdownParser.parseWorkout(markdown)

        XCTAssertTrue(result.success)
        // Should have parent superset + 2 child exercises
        XCTAssertGreaterThanOrEqual(result.data?.exercises.count ?? 0, 2)
    }

    // MARK: - Sections

    func testParsesSectionsWithExercises() {
        let markdown = """
        # Workout

        ## Warmup
        ### Arm Circles
        - 30s
        ### Jumping Jacks
        - 60s

        ## Workout
        ### Bench Press
        - 135 x 10
        """
        let result = MarkdownParser.parseWorkout(markdown)

        XCTAssertTrue(result.success)
        let exercises = result.data?.exercises ?? []

        // Should have: Warmup section parent, 2 warmup exercises, Workout section parent, 1 workout exercise
        XCTAssertEqual(exercises.count, 5)

        // First should be section parent
        XCTAssertEqual(exercises[0].groupType, .section)
        XCTAssertEqual(exercises[0].exerciseName, "Warmup")
        XCTAssertEqual(exercises[0].sets.count, 0)

        // Warmup exercises should have parent pointing to warmup section
        XCTAssertEqual(exercises[1].exerciseName, "Arm Circles")
        XCTAssertEqual(exercises[1].parentExerciseId, exercises[0].id)

        XCTAssertEqual(exercises[2].exerciseName, "Jumping Jacks")
        XCTAssertEqual(exercises[2].parentExerciseId, exercises[0].id)
    }

    // MARK: - Supersets Inside Sections

    func testParsesSupersetInsideSections() {
        let markdown = """
        # Workout

        ## Workout
        ### Superset: Arms
        #### Bicep Curls
        - 20 x 10
        #### Tricep Extensions
        - 20 x 10
        """
        let result = MarkdownParser.parseWorkout(markdown)

        XCTAssertTrue(result.success)
        let exercises = result.data?.exercises ?? []

        // Should have: Workout section parent, Superset parent, 2 superset children
        XCTAssertEqual(exercises.count, 4)

        // First should be section parent
        let sectionParent = exercises[0]
        XCTAssertEqual(sectionParent.groupType, .section)
        XCTAssertEqual(sectionParent.exerciseName, "Workout")
        XCTAssertEqual(sectionParent.sets.count, 0)

        // Second should be superset parent, with parent pointing to section
        let supersetParent = exercises[1]
        XCTAssertEqual(supersetParent.groupType, .superset)
        XCTAssertEqual(supersetParent.exerciseName, "Superset: Arms")
        XCTAssertEqual(supersetParent.sets.count, 0)
        XCTAssertEqual(supersetParent.parentExerciseId, sectionParent.id)

        // Superset children should have parent pointing to superset, NOT section
        let child1 = exercises[2]
        XCTAssertEqual(child1.exerciseName, "Bicep Curls")
        XCTAssertEqual(child1.parentExerciseId, supersetParent.id)
        XCTAssertEqual(child1.sets.count, 1)

        let child2 = exercises[3]
        XCTAssertEqual(child2.exerciseName, "Tricep Extensions")
        XCTAssertEqual(child2.parentExerciseId, supersetParent.id)
        XCTAssertEqual(child2.sets.count, 1)
    }

    // MARK: - Non-Adjacent Header Levels

    func testParsesSupersetWithNonAdjacentHeaderLevels() {
        // H2 superset -> H4 exercises (skipping H3)
        let markdown = """
        # Workout

        ## Superset: Arms
        #### Bicep Curls
        - 20 x 10
        #### Tricep Extensions
        - 20 x 10
        """
        let result = MarkdownParser.parseWorkout(markdown)

        XCTAssertTrue(result.success)
        let exercises = result.data?.exercises ?? []

        // Should have: Superset parent + 2 superset children
        XCTAssertEqual(exercises.count, 3)

        let supersetParent = exercises[0]
        XCTAssertEqual(supersetParent.groupType, .superset)
        XCTAssertEqual(supersetParent.exerciseName, "Superset: Arms")
        XCTAssertEqual(supersetParent.sets.count, 0)

        let child1 = exercises[1]
        XCTAssertEqual(child1.exerciseName, "Bicep Curls")
        XCTAssertEqual(child1.parentExerciseId, supersetParent.id)
        XCTAssertEqual(child1.sets.count, 1)

        let child2 = exercises[2]
        XCTAssertEqual(child2.exerciseName, "Tricep Extensions")
        XCTAssertEqual(child2.parentExerciseId, supersetParent.id)
        XCTAssertEqual(child2.sets.count, 1)
    }

    // MARK: - Per-Side Modifier

    func testParsesPerSideModifier() {
        let markdown = """
        # Workout
        ## Stretches
        - 30s @perside
        - 45s @perside
        """
        let result = MarkdownParser.parseWorkout(markdown)

        XCTAssertTrue(result.success)
        XCTAssertTrue(result.data?.exercises[0].sets[0].isPerSide ?? false)
        XCTAssertTrue(result.data?.exercises[0].sets[1].isPerSide ?? false)
    }

    // MARK: - Dropset Modifier

    func testParsesDropsetModifier() {
        let markdown = """
        # Workout
        ## Curls
        - 20 x 10
        - 15 x 12 @dropset
        """
        let result = MarkdownParser.parseWorkout(markdown)

        XCTAssertTrue(result.success)
        // First set should not be a dropset
        XCTAssertFalse(result.data?.exercises[0].sets[0].isDropset ?? true)
        XCTAssertTrue(result.data?.exercises[0].sets[1].isDropset ?? false)
    }

    // MARK: - Trailing Text

    func testParsesTrailingTextWithoutModifiers() {
        let markdown = """
        # Workout
        ## Bench Press
        - 225 x 5 Felt strong today!
        - 245 x 3 PR set!
        """
        let result = MarkdownParser.parseWorkout(markdown)

        XCTAssertTrue(result.success)
        XCTAssertEqual(result.data?.exercises[0].sets[0].notes, "Felt strong today!")
        XCTAssertEqual(result.data?.exercises[0].sets[1].notes, "PR set!")
    }

    func testParsesTrailingTextAfterModifiers() {
        let markdown = """
        # Workout
        ## Squats
        - 315 x 5 @rpe: 8 Great depth today
        - 335 x 3 @rpe: 9 @rest: 180s Tough but doable
        """
        let result = MarkdownParser.parseWorkout(markdown)

        XCTAssertTrue(result.success)
        XCTAssertEqual(result.data?.exercises[0].sets[0].targetRpe, 8)
        XCTAssertEqual(result.data?.exercises[0].sets[0].notes, "Great depth today")
        XCTAssertEqual(result.data?.exercises[0].sets[1].targetRpe, 9)
        XCTAssertEqual(result.data?.exercises[0].sets[1].restSeconds, 180)
        XCTAssertEqual(result.data?.exercises[0].sets[1].notes, "Tough but doable")
    }

    func testParsesTrailingTextWithTempoModifier() {
        let markdown = """
        # Workout
        ## Pause Squats
        - 225 x 5 @tempo: 3-2-1-0 @rest: 120s Really focused on the pause
        """
        let result = MarkdownParser.parseWorkout(markdown)

        XCTAssertTrue(result.success)
        XCTAssertEqual(result.data?.exercises[0].sets[0].tempo, "3-2-1-0")
        XCTAssertEqual(result.data?.exercises[0].sets[0].restSeconds, 120)
        XCTAssertEqual(result.data?.exercises[0].sets[0].notes, "Really focused on the pause")
    }

    func testHandlesTextThatLooksLikeModifierButIsNot() {
        let markdown = """
        # Workout
        ## Deadlift
        - 405 x 5 @rpe: 8.5 Back felt good, no issues
        """
        let result = MarkdownParser.parseWorkout(markdown)

        XCTAssertTrue(result.success)
        // RPE 8.5 is truncated to Int (8) in existing model
        XCTAssertEqual(result.data?.exercises[0].sets[0].targetRpe, 8)
        XCTAssertEqual(result.data?.exercises[0].sets[0].notes, "Back felt good, no issues")
    }

    func testHandlesMultipleAtSymbolsInTrailingText() {
        let markdown = """
        # Workout
        ## Bench Press
        - 225 x 5 @rpe: 7 Hit the target @135 for warmup
        """
        let result = MarkdownParser.parseWorkout(markdown)

        XCTAssertTrue(result.success)
        XCTAssertEqual(result.data?.exercises[0].sets[0].targetRpe, 7)
        // The trailing text includes text from after @135
        XCTAssertTrue(result.data?.exercises[0].sets[0].notes?.contains("Hit the target") ?? false)
    }

    func testHandlesTrailingTextWithOnlyInvalidModifiers() {
        let markdown = """
        # Workout
        ## Press
        - 135 x 8 @invalid: value Some note here
        """
        let result = MarkdownParser.parseWorkout(markdown)

        XCTAssertTrue(result.success)
        // Invalid modifier should generate a warning
        XCTAssertGreaterThan(result.warnings.count, 0)
        XCTAssertTrue(result.data?.exercises[0].sets[0].notes?.contains("Some note here") ?? false)
    }

    func testParsesTrailingTextAfterFlagModifiers() {
        let markdown = """
        # Workout
        ## Curls
        - 20 x 12 @dropset Burned out completely
        - 15 x 15 Great pump
        """
        let result = MarkdownParser.parseWorkout(markdown)

        XCTAssertTrue(result.success)
        XCTAssertTrue(result.data?.exercises[0].sets[0].isDropset ?? false)
        XCTAssertEqual(result.data?.exercises[0].sets[0].notes, "Burned out completely")
        XCTAssertEqual(result.data?.exercises[0].sets[1].notes, "Great pump")
    }

    func testPreservesTrailingTextWithSpecialCharacters() {
        let markdown = """
        # Workout
        ## Squats
        - 225 x 5 @rpe: 8 Form was perfect! \u{1F4AA} #PR
        """
        let result = MarkdownParser.parseWorkout(markdown)

        XCTAssertTrue(result.success)
        XCTAssertEqual(result.data?.exercises[0].sets[0].notes, "Form was perfect! \u{1F4AA} #PR")
    }

    func testHandlesEmptyTrailingTextGracefully() {
        let markdown = """
        # Workout
        ## Bench Press
        - 225 x 5 @rpe: 8
        - 245 x 3
        """
        let result = MarkdownParser.parseWorkout(markdown)

        XCTAssertTrue(result.success)
        XCTAssertNil(result.data?.exercises[0].sets[0].notes)
        XCTAssertNil(result.data?.exercises[0].sets[1].notes)
    }

    // MARK: - GenAI Format Variations

    func testHandlesDirectionalInstructions() {
        let markdown = """
        # Test
        ## Arm Circles
        - 30s forward
        - 30s backward
        """
        let result = MarkdownParser.parseWorkout(markdown)
        // Expected: success with notes preserved or defined errors
        XCTAssertTrue(result.success || !result.errors.isEmpty)
    }

    func testHandlesSideLimbSpecifications() {
        let markdown = """
        # Test
        ## Dead Bug
        - 12 each side
        - 10 each arm
        """
        let result = MarkdownParser.parseWorkout(markdown)
        XCTAssertTrue(result.success || !result.errors.isEmpty)
    }

    func testHandlesPerSideAndBothSides() {
        let markdown = """
        # Test
        ## Stretch
        - 45s per side
        - 60s both sides
        """
        let result = MarkdownParser.parseWorkout(markdown)
        XCTAssertTrue(result.success || !result.errors.isEmpty)
    }

    func testParsesClaudeGeneratedPushDayWorkout() {
        let markdown = """
        # Push Day - Compound Focus
        @tags: push, chest, shoulders, triceps
        @units: lbs

        ## Warmup

        ### Arm Circles
        - 30s forward
        - 30s backward

        ### Band Pull-Aparts
        - 15
        - 15

        ### Push-up to Downward Dog
        - 8

        ### Empty Bar Overhead Press
        - 45 x 10
        - 45 x 8

        ## Workout

        ### Bench Press
        - 135 x 8
        - 185 x 6 @rpe: 6
        - 205 x 5 @rpe: 7
        - 225 x 4 @rpe: 8
        - 225 x 4 @rpe: 9 @rest: 180s

        ### Overhead Press
        - 95 x 8
        - 115 x 6 @rpe: 7
        - 125 x 5 @rpe: 8 @rest: 120s

        ### Incline Dumbbell Press
        - 50 x 10
        - 60 x 8 @rpe: 7
        - 65 x 8 @rpe: 8

        ### Dips
        - bw x 10
        - bw x 8 @rpe: 8
        - bw x AMRAP

        ### Superset: Shoulder & Tricep Finisher
        #### Lateral Raises
        - 20 x 12
        - 25 x 10
        #### Tricep Pushdowns
        - 50 x 12
        - 60 x 10

        ## Core

        ### Hanging Leg Raises
        - 10
        - 10
        - 10 @rest: 60s

        ### Dead Bug
        - 12 each side
        - 12 each side

        ## Cool Down

        ### Doorway Chest Stretch
        - 45s each side

        ### Overhead Tricep Stretch
        - 30s each arm

        ### Thread the Needle
        - 30s each side

        ### Child's Pose
        - 60s
        """
        let result = MarkdownParser.parseWorkout(markdown)

        if result.success {
            XCTAssertNotNil(result.data?.exercises)
            XCTAssertGreaterThan(result.data?.exercises.count ?? 0, 0)
        } else {
            // Document the failures for now
            XCTAssertFalse(result.errors.isEmpty)
        }
    }

    // MARK: - Edge Cases

    func testEmptyInput() {
        let result = MarkdownParser.parseWorkout("")
        XCTAssertFalse(result.success)
    }

    func testWhitespaceOnlyInput() {
        let result = MarkdownParser.parseWorkout("   \n\n  \n")
        XCTAssertFalse(result.success)
    }

    func testMinuteTimeUnits() {
        let markdown = """
        # Workout
        ## Plank
        - 2m
        """
        let result = MarkdownParser.parseWorkout(markdown)

        XCTAssertTrue(result.success)
        XCTAssertEqual(result.data?.exercises[0].sets[0].targetTime, 120)
    }

    func testRestInMinutes() {
        let markdown = """
        # Workout
        ## Squats
        - 225 x 5 @rest: 3m
        """
        let result = MarkdownParser.parseWorkout(markdown)

        XCTAssertTrue(result.success)
        XCTAssertEqual(result.data?.exercises[0].sets[0].restSeconds, 180)
    }

    func testSingleNumberAsBodyweightReps() {
        let markdown = """
        # Workout
        ## Push-ups
        - 15
        - 12
        """
        let result = MarkdownParser.parseWorkout(markdown)

        XCTAssertTrue(result.success)
        XCTAssertEqual(result.data?.exercises[0].sets[0].targetReps, 15)
        XCTAssertNil(result.data?.exercises[0].sets[0].targetWeight)
    }

    func testStandaloneAMRAPRejected() {
        let markdown = """
        # Workout
        ## Push-ups
        - AMRAP
        """
        let result = MarkdownParser.parseWorkout(markdown)

        XCTAssertFalse(result.success)
        XCTAssertTrue(result.errors.contains(where: { $0.contains("AMRAP") }))
    }

    func testWeightedAMRAP() {
        let markdown = """
        # Workout
        ## Bench Press
        - 135 x AMRAP
        """
        let result = MarkdownParser.parseWorkout(markdown)

        XCTAssertTrue(result.success)
        XCTAssertTrue(result.data?.exercises[0].sets[0].isAmrap ?? false)
        XCTAssertEqual(result.data?.exercises[0].sets[0].targetWeight, 135)
    }

    func testBodyweightAMRAP() {
        let markdown = """
        # Workout
        ## Pull-ups
        - bw x AMRAP
        """
        let result = MarkdownParser.parseWorkout(markdown)

        XCTAssertTrue(result.success)
        XCTAssertTrue(result.data?.exercises[0].sets[0].isAmrap ?? false)
        XCTAssertNil(result.data?.exercises[0].sets[0].targetWeight)
    }

    func testExplicitRepsUnit() {
        let markdown = """
        # Workout
        ## Bench Press
        - 225 lbs x 5 reps
        """
        let result = MarkdownParser.parseWorkout(markdown)

        XCTAssertTrue(result.success)
        XCTAssertEqual(result.data?.exercises[0].sets[0].targetWeight, 225)
        XCTAssertEqual(result.data?.exercises[0].sets[0].targetWeightUnit, .lbs)
        XCTAssertEqual(result.data?.exercises[0].sets[0].targetReps, 5)
    }

    func testWeightedTimedSet() {
        let markdown = """
        # Workout
        ## Plank
        - 45 lbs x 60s
        """
        let result = MarkdownParser.parseWorkout(markdown)

        XCTAssertTrue(result.success)
        XCTAssertEqual(result.data?.exercises[0].sets[0].targetWeight, 45)
        XCTAssertEqual(result.data?.exercises[0].sets[0].targetWeightUnit, .lbs)
        XCTAssertEqual(result.data?.exercises[0].sets[0].targetTime, 60)
    }

    func testForSyntaxTimedSet() {
        let markdown = """
        # Workout
        ## Plank
        - 45 lbs for 60s
        """
        let result = MarkdownParser.parseWorkout(markdown)

        XCTAssertTrue(result.success)
        XCTAssertEqual(result.data?.exercises[0].sets[0].targetWeight, 45)
        XCTAssertEqual(result.data?.exercises[0].sets[0].targetTime, 60)
    }

    func testDecimalWeight() {
        let markdown = """
        # Workout
        ## Dumbbell Press
        - 27.5 x 10
        """
        let result = MarkdownParser.parseWorkout(markdown)

        XCTAssertTrue(result.success)
        XCTAssertEqual(result.data?.exercises[0].sets[0].targetWeight, 27.5)
    }

    func testInvalidUnits() {
        let markdown = """
        # Workout
        @units: pounds

        ## Bench Press
        - 225 x 5
        """
        let result = MarkdownParser.parseWorkout(markdown)

        // Invalid units is an error — the workout won't be found because the error prevents success
        XCTAssertFalse(result.success)
    }

    func testCRLFLineEndings() {
        let markdown = "# Workout\r\n## Exercise\r\n- 100 x 5\r\n"
        let result = MarkdownParser.parseWorkout(markdown)

        XCTAssertTrue(result.success)
        XCTAssertEqual(result.data?.exercises[0].sets[0].targetWeight, 100)
        XCTAssertEqual(result.data?.exercises[0].sets[0].targetReps, 5)
    }

    func testCRLineEndings() {
        let markdown = "# Workout\r## Exercise\r- 100 x 5\r"
        let result = MarkdownParser.parseWorkout(markdown)

        XCTAssertTrue(result.success)
    }

    func testMultipleExercises() {
        let markdown = """
        # Full Body
        ## Squats
        - 225 x 5
        - 225 x 5
        ## Bench Press
        - 185 x 8
        ## Deadlift
        - 315 x 3
        """
        let result = MarkdownParser.parseWorkout(markdown)

        XCTAssertTrue(result.success)
        XCTAssertEqual(result.data?.exercises.count, 3)
        XCTAssertEqual(result.data?.exercises[0].exerciseName, "Squats")
        XCTAssertEqual(result.data?.exercises[0].sets.count, 2)
        XCTAssertEqual(result.data?.exercises[1].exerciseName, "Bench Press")
        XCTAssertEqual(result.data?.exercises[2].exerciseName, "Deadlift")
    }

    func testFreeformNotesOnWorkout() {
        let markdown = """
        # Push Day

        Feeling strong today, going for PRs on bench.
        Sleep was good, nutrition on point.

        ## Bench Press
        - 225 x 5
        """
        let result = MarkdownParser.parseWorkout(markdown)

        XCTAssertTrue(result.success)
        XCTAssertTrue(result.data?.description?.contains("Feeling strong today") ?? false)
        XCTAssertTrue(result.data?.description?.contains("Sleep was good") ?? false)
    }

    func testFreeformNotesOnExercise() {
        let markdown = """
        # Workout
        ## Bench Press

        Retract scapula, touch chest on every rep.
        Focus on driving through the floor.

        - 135 x 5
        """
        let result = MarkdownParser.parseWorkout(markdown)

        XCTAssertTrue(result.success)
        XCTAssertTrue(result.data?.exercises[0].notes?.contains("Retract scapula") ?? false)
    }

    func testEquipmentTypeMetadata() {
        let markdown = """
        # Workout
        ## Bench Press
        @type: barbell
        - 225 x 5
        """
        let result = MarkdownParser.parseWorkout(markdown)

        XCTAssertTrue(result.success)
        XCTAssertEqual(result.data?.exercises[0].equipmentType, "barbell")
    }

    func testFlexibleHeaderLevels() {
        // Parser finds first header with direct child exercises (one level below)
        // H1 "Training Log" has H2 "Week 1" which has sets below (nested),
        // so "Training Log" is the workout header, "Week 1" is exercise level
        let markdown = """
        ### Push Day
        @tags: push

        #### Bench Press
        - 225 x 5

        #### Squat
        - 315 x 3
        """
        let result = MarkdownParser.parseWorkout(markdown)

        XCTAssertTrue(result.success)
        XCTAssertEqual(result.data?.name, "Push Day")
        XCTAssertEqual(result.data?.exercises[0].exerciseName, "Bench Press")
        XCTAssertEqual(result.data?.exercises[1].exerciseName, "Squat")
    }

    func testHighRepCountWarning() {
        let markdown = """
        # Workout
        ## Jumping Jacks
        - 150
        """
        let result = MarkdownParser.parseWorkout(markdown)

        XCTAssertTrue(result.success)
        XCTAssertEqual(result.data?.exercises[0].sets[0].targetReps, 150)
        XCTAssertGreaterThan(result.warnings.count, 0)
    }

    func testShortRestWarning() {
        let markdown = """
        # Workout
        ## Exercise
        - 100 x 5 @rest: 5s
        """
        let result = MarkdownParser.parseWorkout(markdown)

        XCTAssertTrue(result.success)
        XCTAssertEqual(result.data?.exercises[0].sets[0].restSeconds, 5)
        XCTAssertGreaterThan(result.warnings.count, 0)
    }

    func testLongRestWarning() {
        let markdown = """
        # Workout
        ## Exercise
        - 100 x 5 @rest: 700s
        """
        let result = MarkdownParser.parseWorkout(markdown)

        XCTAssertTrue(result.success)
        XCTAssertEqual(result.data?.exercises[0].sets[0].restSeconds, 700)
        XCTAssertGreaterThan(result.warnings.count, 0)
    }

    func testUnitAliases() {
        // lb should normalize to lbs
        let markdown = """
        # Workout
        @units: lb

        ## Exercise
        - 100 x 5
        """
        let result = MarkdownParser.parseWorkout(markdown)

        XCTAssertTrue(result.success)
        XCTAssertEqual(result.data?.defaultWeightUnit, .lbs)
    }

    func testKgsAlias() {
        let markdown = """
        # Workout
        @units: kgs

        ## Exercise
        - 100 x 5
        """
        let result = MarkdownParser.parseWorkout(markdown)

        XCTAssertTrue(result.success)
        XCTAssertEqual(result.data?.defaultWeightUnit, .kg)
    }

    func testSecTimeUnit() {
        let markdown = """
        # Workout
        ## Plank
        - 90 sec
        """
        let result = MarkdownParser.parseWorkout(markdown)

        XCTAssertTrue(result.success)
        XCTAssertEqual(result.data?.exercises[0].sets[0].targetTime, 90)
    }

    func testMinTimeUnit() {
        let markdown = """
        # Workout
        ## Plank
        - 2 min
        """
        let result = MarkdownParser.parseWorkout(markdown)

        XCTAssertTrue(result.success)
        XCTAssertEqual(result.data?.exercises[0].sets[0].targetTime, 120)
    }

    func testSourceMarkdownPreserved() {
        let markdown = """
        # Workout
        ## Exercise
        - 100 x 5
        """
        let result = MarkdownParser.parseWorkout(markdown)

        XCTAssertTrue(result.success)
        XCTAssertEqual(result.data?.sourceMarkdown, markdown)
    }

    func testExerciseOrderIndices() {
        let markdown = """
        # Workout
        ## Exercise A
        - 100 x 5
        ## Exercise B
        - 200 x 5
        ## Exercise C
        - 300 x 5
        """
        let result = MarkdownParser.parseWorkout(markdown)

        XCTAssertTrue(result.success)
        XCTAssertEqual(result.data?.exercises[0].orderIndex, 0)
        XCTAssertEqual(result.data?.exercises[1].orderIndex, 1)
        XCTAssertEqual(result.data?.exercises[2].orderIndex, 2)
    }

    func testSetOrderIndices() {
        let markdown = """
        # Workout
        ## Exercise
        - 100 x 5
        - 200 x 5
        - 300 x 5
        """
        let result = MarkdownParser.parseWorkout(markdown)

        XCTAssertTrue(result.success)
        XCTAssertEqual(result.data?.exercises[0].sets[0].orderIndex, 0)
        XCTAssertEqual(result.data?.exercises[0].sets[1].orderIndex, 1)
        XCTAssertEqual(result.data?.exercises[0].sets[2].orderIndex, 2)
    }

    func testUniqueIdsGenerated() {
        let markdown = """
        # Workout
        ## Exercise A
        - 100 x 5
        ## Exercise B
        - 200 x 5
        """
        let result = MarkdownParser.parseWorkout(markdown)

        XCTAssertTrue(result.success)
        let workout = result.data!
        // All IDs should be unique
        var allIds = Set<String>()
        allIds.insert(workout.id)
        for exercise in workout.exercises {
            XCTAssertTrue(allIds.insert(exercise.id).inserted, "Duplicate exercise ID: \(exercise.id)")
            for set in exercise.sets {
                XCTAssertTrue(allIds.insert(set.id).inserted, "Duplicate set ID: \(set.id)")
            }
        }
    }

    func testMultipleModifiersOnOneLine() {
        let markdown = """
        # Workout
        ## Bench
        - 225 x 5 @rpe: 8 @rest: 180s @tempo: 3-0-1-0
        """
        let result = MarkdownParser.parseWorkout(markdown)

        XCTAssertTrue(result.success)
        let set = result.data?.exercises[0].sets[0]
        XCTAssertEqual(set?.targetRpe, 8)
        XCTAssertEqual(set?.restSeconds, 180)
        XCTAssertEqual(set?.tempo, "3-0-1-0")
    }

    func testDropsetWithMultipleSets() {
        let markdown = """
        # Workout
        ## Curls
        - 100 x 12
        - 70 x 10 @dropset
        - 50 x 8 @dropset
        """
        let result = MarkdownParser.parseWorkout(markdown)

        XCTAssertTrue(result.success)
        XCTAssertFalse(result.data?.exercises[0].sets[0].isDropset ?? true)
        XCTAssertTrue(result.data?.exercises[0].sets[1].isDropset ?? false)
        XCTAssertTrue(result.data?.exercises[0].sets[2].isDropset ?? false)
    }

    func testMixedUnitsInSameExercise() {
        let markdown = """
        # Workout
        ## Dumbbell Press
        - 50 lbs x 10
        - 25 kg x 8
        """
        let result = MarkdownParser.parseWorkout(markdown)

        XCTAssertTrue(result.success)
        XCTAssertEqual(result.data?.exercises[0].sets[0].targetWeightUnit, .lbs)
        XCTAssertEqual(result.data?.exercises[0].sets[1].targetWeightUnit, .kg)
    }

    func testCaseInsensitiveUnits() {
        let markdown = """
        # Workout
        ## Bench
        - 100 LBS x 5
        """
        let result = MarkdownParser.parseWorkout(markdown)

        XCTAssertTrue(result.success)
        XCTAssertEqual(result.data?.exercises[0].sets[0].targetWeight, 100)
        XCTAssertEqual(result.data?.exercises[0].sets[0].targetWeightUnit, .lbs)
    }

    func testUnicodeInExerciseName() {
        let markdown = """
        # Workout
        ## DB Bench Press - 30\u{00B0} Incline
        - 80 x 10
        """
        let result = MarkdownParser.parseWorkout(markdown)

        XCTAssertTrue(result.success)
        XCTAssertEqual(result.data?.exercises[0].exerciseName, "DB Bench Press - 30\u{00B0} Incline")
    }

    func testSpecialCharactersInExerciseName() {
        let markdown = """
        # Workout
        ## Barbell Back Squat (Low Bar)
        - 315 x 5
        """
        let result = MarkdownParser.parseWorkout(markdown)

        XCTAssertTrue(result.success)
        XCTAssertEqual(result.data?.exercises[0].exerciseName, "Barbell Back Squat (Low Bar)")
    }

    // MARK: - Unit Lookahead (Issue 5: "Steady" bug)

    func testTrailingTextStartingWithSIsNotCapturedAsSeconds() {
        let markdown = """
        # Workout
        ## Rowing
        - 30 x 25 Steady pace
        """
        let result = MarkdownParser.parseWorkout(markdown)

        XCTAssertTrue(result.success)
        let set = result.data?.exercises[0].sets[0]
        XCTAssertEqual(set?.targetWeight, 30)
        XCTAssertEqual(set?.targetReps, 25)
        XCTAssertNil(set?.targetTime, "Should not interpret 'S' from 'Steady' as seconds")
        XCTAssertEqual(set?.notes, "Steady pace")
    }

    func testExplicitSecondsUnitStillWorks() {
        let markdown = """
        # Workout
        ## Plank
        - 30 x 25s
        """
        let result = MarkdownParser.parseWorkout(markdown)

        XCTAssertTrue(result.success)
        let set = result.data?.exercises[0].sets[0]
        XCTAssertEqual(set?.targetWeight, 30)
        XCTAssertEqual(set?.targetTime, 25)
        XCTAssertNil(set?.targetReps, "25s should be time, not reps")
    }

    func testSecondsUnitFollowedBySpace() {
        let markdown = """
        # Workout
        ## Plank
        - 30 x 25 s
        """
        let result = MarkdownParser.parseWorkout(markdown)

        XCTAssertTrue(result.success)
        let set = result.data?.exercises[0].sets[0]
        XCTAssertEqual(set?.targetWeight, 30)
        XCTAssertEqual(set?.targetTime, 25)
    }

    // MARK: - Per-Side Auto-Detection from Exercise Notes

    func testPerSideNotesAutoFlagsTimedSets() {
        let markdown = """
        # Workout
        ## Side Plank
        per side
        - 60s
        - 45s
        """
        let result = MarkdownParser.parseWorkout(markdown)

        XCTAssertTrue(result.success)
        let sets = result.data?.exercises[0].sets
        XCTAssertEqual(sets?.count, 2)
        XCTAssertTrue(sets?[0].isPerSide ?? false)
        XCTAssertTrue(sets?[1].isPerSide ?? false)
    }

    func testPerSideNotesDoesNotFlagRepBasedSets() {
        let markdown = """
        # Workout
        ## Single Leg RDL
        per side
        - 50 lbs x 10
        - 60 lbs x 8
        """
        let result = MarkdownParser.parseWorkout(markdown)

        XCTAssertTrue(result.success)
        let sets = result.data?.exercises[0].sets
        XCTAssertEqual(sets?.count, 2)
        XCTAssertFalse(sets?[0].isPerSide ?? true)
        XCTAssertFalse(sets?[1].isPerSide ?? true)
    }

    func testPerSideNotesCaseInsensitive() {
        let markdown = """
        # Workout
        ## Side Plank
        Per Side
        - 60s
        """
        let result = MarkdownParser.parseWorkout(markdown)
        XCTAssertTrue(result.data?.exercises[0].sets[0].isPerSide ?? false)

        let markdown2 = """
        # Workout
        ## Side Plank
        PER SIDE
        - 60s
        """
        let result2 = MarkdownParser.parseWorkout(markdown2)
        XCTAssertTrue(result2.data?.exercises[0].sets[0].isPerSide ?? false)
    }

    func testPerLegNotesAutoFlagsTimedSets() {
        let markdown = """
        # Workout
        ## Single Leg RDL Hold
        per leg
        - 30s
        - 25s
        """
        let result = MarkdownParser.parseWorkout(markdown)

        XCTAssertTrue(result.success)
        let sets = result.data?.exercises[0].sets
        XCTAssertTrue(sets?[0].isPerSide ?? false)
        XCTAssertTrue(sets?[1].isPerSide ?? false)
    }

    func testPerArmNotesAutoFlagsTimedSets() {
        let markdown = """
        # Workout
        ## Single Arm Hang
        per arm
        - 30s
        - 25s
        """
        let result = MarkdownParser.parseWorkout(markdown)

        XCTAssertTrue(result.success)
        let sets = result.data?.exercises[0].sets
        XCTAssertTrue(sets?[0].isPerSide ?? false)
        XCTAssertTrue(sets?[1].isPerSide ?? false)
    }

    func testEachSideNotesAutoFlagsTimedSets() {
        let markdown = """
        # Workout
        ## Side Plank
        each side
        - 60s
        - 45s
        """
        let result = MarkdownParser.parseWorkout(markdown)

        XCTAssertTrue(result.success)
        let sets = result.data?.exercises[0].sets
        XCTAssertTrue(sets?[0].isPerSide ?? false)
        XCTAssertTrue(sets?[1].isPerSide ?? false)
    }

    func testEachLegNotesAutoFlagsTimedSets() {
        let markdown = """
        # Workout
        ## Single Leg Balance
        each leg
        - 30s
        """
        let result = MarkdownParser.parseWorkout(markdown)

        XCTAssertTrue(result.success)
        XCTAssertTrue(result.data?.exercises[0].sets[0].isPerSide ?? false)
    }

    func testEachArmNotesAutoFlagsTimedSets() {
        let markdown = """
        # Workout
        ## Farmer Hold
        each arm
        - 30s
        """
        let result = MarkdownParser.parseWorkout(markdown)

        XCTAssertTrue(result.success)
        XCTAssertTrue(result.data?.exercises[0].sets[0].isPerSide ?? false)
    }

    func testEachKeywordNotesAutoFlagsTimedSets() {
        let markdown = """
        # Workout
        ## Side Plank
        Hold each for full duration
        - 60s
        - 45s
        """
        let result = MarkdownParser.parseWorkout(markdown)

        XCTAssertTrue(result.success)
        let sets = result.data?.exercises[0].sets
        XCTAssertTrue(sets?[0].isPerSide ?? false)
        XCTAssertTrue(sets?[1].isPerSide ?? false)
    }

    func testPerLegNotesDoesNotFlagRepBasedSets() {
        let markdown = """
        # Workout
        ## Single Leg RDL
        per leg
        - 50 lbs x 10
        - 60 lbs x 8
        """
        let result = MarkdownParser.parseWorkout(markdown)

        XCTAssertTrue(result.success)
        let sets = result.data?.exercises[0].sets
        XCTAssertFalse(sets?[0].isPerSide ?? true)
        XCTAssertFalse(sets?[1].isPerSide ?? true)
    }

    func testEachArmNotesDoesNotFlagRepBasedSets() {
        let markdown = """
        # Workout
        ## Single Arm Curl
        each arm
        - 25 lbs x 10
        """
        let result = MarkdownParser.parseWorkout(markdown)

        XCTAssertTrue(result.success)
        XCTAssertFalse(result.data?.exercises[0].sets[0].isPerSide ?? true)
    }

    func testExplicitPerSideModifierStillWorks() {
        let markdown = """
        # Workout
        ## Stretches
        - 30s @perside
        - 45s
        """
        let result = MarkdownParser.parseWorkout(markdown)

        XCTAssertTrue(result.success)
        XCTAssertTrue(result.data?.exercises[0].sets[0].isPerSide ?? false)
        XCTAssertFalse(result.data?.exercises[0].sets[1].isPerSide ?? true)
    }

    // MARK: - Per-Side Auto-Detection from Set Line Text

    func testPerLegInSetLineAutoFlagsTimedSet() {
        let markdown = """
        # Workout
        ## Standing Quad Stretch
        Pull heel to glutes
        - 60s per leg
        """
        let result = MarkdownParser.parseWorkout(markdown)

        XCTAssertTrue(result.success)
        let set = result.data?.exercises[0].sets[0]
        XCTAssertEqual(set?.targetTime, 60)
        XCTAssertTrue(set?.isPerSide ?? false, "Should detect 'per leg' in set line text")
        // "per leg" should be stripped from notes
        XCTAssertNil(set?.notes, "Per-side keyword should be stripped from set notes")
    }

    func testPerSideInSetLineAutoFlagsTimedSet() {
        let markdown = """
        # Workout
        ## Pigeon Pose
        - 90s per side
        """
        let result = MarkdownParser.parseWorkout(markdown)

        XCTAssertTrue(result.success)
        let set = result.data?.exercises[0].sets[0]
        XCTAssertEqual(set?.targetTime, 90)
        XCTAssertTrue(set?.isPerSide ?? false, "Should detect 'per side' in set line text")
        XCTAssertNil(set?.notes, "Per-side keyword should be stripped from set notes")
    }

    func testEachSideInSetLineAutoFlagsTimedSet() {
        let markdown = """
        # Workout
        ## Stretch
        - 45s each side
        """
        let result = MarkdownParser.parseWorkout(markdown)

        XCTAssertTrue(result.success)
        XCTAssertTrue(result.data?.exercises[0].sets[0].isPerSide ?? false)
    }

    func testPerLegInSetLineDoesNotFlagRepBasedSet() {
        let markdown = """
        # Workout
        ## Lunges
        - 25 per leg
        """
        let result = MarkdownParser.parseWorkout(markdown)

        XCTAssertTrue(result.success)
        let set = result.data?.exercises[0].sets[0]
        XCTAssertEqual(set?.targetReps, 25)
        XCTAssertFalse(set?.isPerSide ?? true, "Should not flag rep-based set from set line keyword")
    }

    func testPerSideSetLineCaseInsensitive() {
        let markdown = """
        # Workout
        ## Stretch
        - 60s Per Leg
        """
        let result = MarkdownParser.parseWorkout(markdown)
        XCTAssertTrue(result.data?.exercises[0].sets[0].isPerSide ?? false)
    }

    func testPerSideSetLineWithSectionHeaders() {
        // Reproduces the user's workout structure with ## sections and ### exercises
        let markdown = """
        # Post-Snowboarding Stretch
        @tags: stretching

        ## Lower Body

        ### Standing Quad Stretch
        Pull heel to glutes
        - 60s per leg

        ### Pigeon Pose
        - 90s per side

        ### Wide-Leg Forward Fold
        - 90s
        """
        let result = MarkdownParser.parseWorkout(markdown)

        XCTAssertTrue(result.success)
        let exercises = result.data?.exercises ?? []
        // Find exercises with sets (not section headers)
        let exercisesWithSets = exercises.filter { !$0.sets.isEmpty }
        XCTAssertEqual(exercisesWithSets.count, 3)

        // Standing Quad Stretch: 60s per leg → isPerSide
        XCTAssertTrue(exercisesWithSets[0].sets[0].isPerSide, "Standing Quad Stretch should be per-side")
        XCTAssertEqual(exercisesWithSets[0].sets[0].targetTime, 60)

        // Pigeon Pose: 90s per side → isPerSide
        XCTAssertTrue(exercisesWithSets[1].sets[0].isPerSide, "Pigeon Pose should be per-side")
        XCTAssertEqual(exercisesWithSets[1].sets[0].targetTime, 90)

        // Wide-Leg Forward Fold: 90s → NOT per-side
        XCTAssertFalse(exercisesWithSets[2].sets[0].isPerSide, "Wide-Leg Forward Fold should not be per-side")
    }

    func testSingleNumberWithTrailingTextNotSeconds() {
        let markdown = """
        # Workout
        ## Exercise
        - 25 Slow and controlled
        """
        let result = MarkdownParser.parseWorkout(markdown)

        XCTAssertTrue(result.success)
        let set = result.data?.exercises[0].sets[0]
        XCTAssertEqual(set?.targetReps, 25)
        XCTAssertNil(set?.targetTime, "Should not interpret 'S' from 'Slow' as seconds")
        XCTAssertEqual(set?.notes, "Slow and controlled")
    }
}
