import XCTest
@testable import LiftMark

final class MarkdownParserEdgeCaseTests: XCTestCase {

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

    // MARK: - Distance Sets

    func testParsesDistanceInMeters() {
        let markdown = """
        # Cardio Workout
        ## Running
        - 200 meters
        """
        let result = MarkdownParser.parseWorkout(markdown)

        XCTAssertTrue(result.success)
        let set = result.data?.exercises[0].sets[0]
        XCTAssertEqual(set?.targetDistance, 200)
        XCTAssertEqual(set?.targetDistanceUnit, .meters)
        XCTAssertNil(set?.targetReps)
        XCTAssertNil(set?.targetTime)
        XCTAssertNil(set?.targetWeight)
    }

    func testParsesDistanceInKm() {
        let markdown = """
        # Cardio
        ## Running
        - 5 km
        """
        let result = MarkdownParser.parseWorkout(markdown)

        XCTAssertTrue(result.success)
        let set = result.data?.exercises[0].sets[0]
        XCTAssertEqual(set?.targetDistance, 5)
        XCTAssertEqual(set?.targetDistanceUnit, .km)
    }

    func testParsesDistanceInMiles() {
        let markdown = """
        # Cardio
        ## Running
        - 1 mile
        """
        let result = MarkdownParser.parseWorkout(markdown)

        XCTAssertTrue(result.success)
        let set = result.data?.exercises[0].sets[0]
        XCTAssertEqual(set?.targetDistance, 1)
        XCTAssertEqual(set?.targetDistanceUnit, .miles)
    }

    func testParsesDistanceInMilesPlural() {
        let markdown = """
        # Cardio
        ## Running
        - 3 miles
        """
        let result = MarkdownParser.parseWorkout(markdown)

        XCTAssertTrue(result.success)
        let set = result.data?.exercises[0].sets[0]
        XCTAssertEqual(set?.targetDistance, 3)
        XCTAssertEqual(set?.targetDistanceUnit, .miles)
    }

    func testParsesDistanceMiAbbreviation() {
        let markdown = """
        # Cardio
        ## Running
        - 3.1 mi
        """
        let result = MarkdownParser.parseWorkout(markdown)

        XCTAssertTrue(result.success)
        let set = result.data?.exercises[0].sets[0]
        XCTAssertEqual(set?.targetDistance, 3.1)
        XCTAssertEqual(set?.targetDistanceUnit, .miles)
    }

    func testParsesDistanceInFeet() {
        let markdown = """
        # Cardio
        ## Sled Push
        - 100 feet
        """
        let result = MarkdownParser.parseWorkout(markdown)

        XCTAssertTrue(result.success)
        let set = result.data?.exercises[0].sets[0]
        XCTAssertEqual(set?.targetDistance, 100)
        XCTAssertEqual(set?.targetDistanceUnit, .feet)
    }

    func testParsesDistanceFtAbbreviation() {
        let markdown = """
        # Cardio
        ## Sled Push
        - 50 ft
        """
        let result = MarkdownParser.parseWorkout(markdown)

        XCTAssertTrue(result.success)
        let set = result.data?.exercises[0].sets[0]
        XCTAssertEqual(set?.targetDistance, 50)
        XCTAssertEqual(set?.targetDistanceUnit, .feet)
    }

    func testParsesDistanceInYards() {
        let markdown = """
        # Cardio
        ## Sprints
        - 100 yards
        """
        let result = MarkdownParser.parseWorkout(markdown)

        XCTAssertTrue(result.success)
        let set = result.data?.exercises[0].sets[0]
        XCTAssertEqual(set?.targetDistance, 100)
        XCTAssertEqual(set?.targetDistanceUnit, .yards)
    }

    func testParsesDistanceYdAbbreviation() {
        let markdown = """
        # Cardio
        ## Sprints
        - 40 yd
        """
        let result = MarkdownParser.parseWorkout(markdown)

        XCTAssertTrue(result.success)
        let set = result.data?.exercises[0].sets[0]
        XCTAssertEqual(set?.targetDistance, 40)
        XCTAssertEqual(set?.targetDistanceUnit, .yards)
    }

    func testParsesDecimalDistance() {
        let markdown = """
        # Cardio
        ## Running
        - 0.5 km
        """
        let result = MarkdownParser.parseWorkout(markdown)

        XCTAssertTrue(result.success)
        let set = result.data?.exercises[0].sets[0]
        XCTAssertEqual(set?.targetDistance, 0.5)
        XCTAssertEqual(set?.targetDistanceUnit, .km)
    }

    func testMStillParsesAsMinutes() {
        let markdown = """
        # Workout
        ## Plank
        - 2m
        """
        let result = MarkdownParser.parseWorkout(markdown)

        XCTAssertTrue(result.success)
        let set = result.data?.exercises[0].sets[0]
        XCTAssertEqual(set?.targetTime, 120)
        XCTAssertNil(set?.targetDistance)
        XCTAssertNil(set?.targetDistanceUnit)
    }

    func testDistanceWithTrailingNotes() {
        let markdown = """
        # Cardio
        ## Running
        - 400 meters easy pace
        """
        let result = MarkdownParser.parseWorkout(markdown)

        XCTAssertTrue(result.success)
        let set = result.data?.exercises[0].sets[0]
        XCTAssertEqual(set?.targetDistance, 400)
        XCTAssertEqual(set?.targetDistanceUnit, .meters)
        XCTAssertEqual(set?.notes, "easy pace")
    }

    func testDistanceWithModifiers() {
        let markdown = """
        # Cardio
        ## Sprints
        - 200 meters @rest: 60s
        """
        let result = MarkdownParser.parseWorkout(markdown)

        XCTAssertTrue(result.success)
        let set = result.data?.exercises[0].sets[0]
        XCTAssertEqual(set?.targetDistance, 200)
        XCTAssertEqual(set?.targetDistanceUnit, .meters)
        XCTAssertEqual(set?.restSeconds, 60)
    }
}
