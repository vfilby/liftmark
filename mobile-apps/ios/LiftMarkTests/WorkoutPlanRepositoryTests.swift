import XCTest
@testable import LiftMark

final class WorkoutPlanRepositoryTests: XCTestCase {

    private var repo: WorkoutPlanRepository!

    override func setUp() {
        super.setUp()
        DatabaseManager.shared.deleteDatabase()
        repo = WorkoutPlanRepository()
    }

    override func tearDown() {
        DatabaseManager.shared.deleteDatabase()
        super.tearDown()
    }

    // MARK: - Create & Read

    func testCreateAndGetAll() throws {
        let plan = makePlan(name: "Push Day")
        try repo.create(plan)

        let all = try repo.getAll()
        XCTAssertEqual(all.count, 1)
        XCTAssertEqual(all[0].name, "Push Day")
        XCTAssertEqual(all[0].id, plan.id)
    }

    func testCreateWithExercisesAndSets() throws {
        let plan = makePlan(
            name: "Full Body",
            exercises: [
                makePlannedExercise(name: "Bench Press", sets: [
                    makePlannedSet(weight: 225, reps: 5),
                    makePlannedSet(weight: 225, reps: 5)
                ]),
                makePlannedExercise(name: "Squat", sets: [
                    makePlannedSet(weight: 315, reps: 3)
                ])
            ]
        )
        try repo.create(plan)

        let fetched = try repo.getById(plan.id)
        XCTAssertNotNil(fetched)
        XCTAssertEqual(fetched?.exercises.count, 2)
        XCTAssertEqual(fetched?.exercises[0].exerciseName, "Bench Press")
        XCTAssertEqual(fetched?.exercises[0].sets.count, 2)
        XCTAssertEqual(fetched?.exercises[0].sets[0].targetWeight, 225)
        XCTAssertEqual(fetched?.exercises[0].sets[0].targetReps, 5)
        XCTAssertEqual(fetched?.exercises[1].exerciseName, "Squat")
        XCTAssertEqual(fetched?.exercises[1].sets[0].targetWeight, 315)
    }

    func testGetByIdReturnsNilForMissingPlan() throws {
        let result = try repo.getById("nonexistent")
        XCTAssertNil(result)
    }

    // MARK: - Tags

    func testCreatePreservesTags() throws {
        let plan = makePlan(name: "Tagged", tags: ["strength", "upper"])
        try repo.create(plan)

        let fetched = try repo.getById(plan.id)
        XCTAssertEqual(fetched?.tags, ["strength", "upper"])
    }

    func testCreateEmptyTags() throws {
        let plan = makePlan(name: "No Tags", tags: [])
        try repo.create(plan)

        let fetched = try repo.getById(plan.id)
        XCTAssertEqual(fetched?.tags, [])
    }

    // MARK: - Favorites

    func testGetFavoritesReturnsOnlyFavorites() throws {
        let plan1 = makePlan(name: "Fav", isFavorite: true)
        let plan2 = makePlan(name: "Not Fav", isFavorite: false)
        try repo.create(plan1)
        try repo.create(plan2)

        let favorites = try repo.getFavorites()
        XCTAssertEqual(favorites.count, 1)
        XCTAssertEqual(favorites[0].name, "Fav")
    }

    func testToggleFavorite() throws {
        let plan = makePlan(name: "Test", isFavorite: false)
        try repo.create(plan)

        try repo.toggleFavorite(plan.id)
        var fetched = try repo.getById(plan.id)
        XCTAssertTrue(fetched?.isFavorite ?? false)

        try repo.toggleFavorite(plan.id)
        fetched = try repo.getById(plan.id)
        XCTAssertFalse(fetched?.isFavorite ?? true)
    }

    // MARK: - GetRecent

    func testGetRecentRespectsLimit() throws {
        for i in 0..<5 {
            let plan = makePlan(name: "Plan \(i)")
            try repo.create(plan)
        }

        let recent = try repo.getRecent(limit: 3)
        XCTAssertEqual(recent.count, 3)
    }

    func testGetRecentDefaultLimit() throws {
        for i in 0..<5 {
            let plan = makePlan(name: "Plan \(i)")
            try repo.create(plan)
        }

        let recent = try repo.getRecent()
        XCTAssertEqual(recent.count, 3)
    }

    // MARK: - Update

    func testUpdatePlanName() throws {
        let plan = makePlan(name: "Original")
        try repo.create(plan)

        var updated = plan
        updated.name = "Updated"
        try repo.update(updated)

        let fetched = try repo.getById(plan.id)
        XCTAssertEqual(fetched?.name, "Updated")
    }

    func testUpdateReplacesExercises() throws {
        let plan = makePlan(
            name: "Test",
            exercises: [makePlannedExercise(name: "Bench", sets: [makePlannedSet(weight: 225, reps: 5)])]
        )
        try repo.create(plan)

        var updated = plan
        updated.exercises = [makePlannedExercise(name: "Squat", sets: [makePlannedSet(weight: 315, reps: 3)])]
        try repo.update(updated)

        let fetched = try repo.getById(plan.id)
        XCTAssertEqual(fetched?.exercises.count, 1)
        XCTAssertEqual(fetched?.exercises[0].exerciseName, "Squat")
    }

    // MARK: - Delete

    func testDeletePlan() throws {
        let plan = makePlan(name: "To Delete")
        try repo.create(plan)
        XCTAssertNotNil(try repo.getById(plan.id))

        try repo.delete(plan.id)
        XCTAssertNil(try repo.getById(plan.id))
    }

    func testDeleteCascadesToExercisesAndSets() throws {
        let plan = makePlan(
            name: "Cascade Test",
            exercises: [makePlannedExercise(name: "Ex", sets: [makePlannedSet(weight: 100, reps: 10)])]
        )
        try repo.create(plan)
        try repo.delete(plan.id)

        let all = try repo.getAll()
        XCTAssertTrue(all.isEmpty)
    }

    // MARK: - Weight Unit & Markdown

    func testCreatePreservesWeightUnit() throws {
        let plan = makePlan(name: "Kg Plan", weightUnit: .kg)
        try repo.create(plan)

        let fetched = try repo.getById(plan.id)
        XCTAssertEqual(fetched?.defaultWeightUnit, .kg)
    }

    func testCreatePreservesSourceMarkdown() throws {
        let plan = makePlan(name: "MD Plan", sourceMarkdown: "# Push Day\n## Bench\n- 225 x 5")
        try repo.create(plan)

        let fetched = try repo.getById(plan.id)
        XCTAssertEqual(fetched?.sourceMarkdown, "# Push Day\n## Bench\n- 225 x 5")
    }

    // MARK: - Set Properties

    func testCreatePreservesSetProperties() throws {
        let set = PlannedSet(
            plannedExerciseId: "ex-1",
            orderIndex: 0,
            targetWeight: 225,
            targetWeightUnit: .lbs,
            targetReps: 5,
            targetRpe: 8,
            restSeconds: 180,
            tempo: "3-1-1-0",
            isDropset: true,
            isPerSide: true,
            isAmrap: true,
            notes: "Go heavy"
        )
        let exercise = PlannedExercise(
            id: set.plannedExerciseId,
            workoutPlanId: "plan-1",
            exerciseName: "Bench",
            orderIndex: 0,
            sets: [set]
        )
        let plan = WorkoutPlan(name: "Detailed", exercises: [exercise])
        try repo.create(plan)

        let fetched = try repo.getById(plan.id)
        let fetchedSet = fetched?.exercises[0].sets[0]
        XCTAssertEqual(fetchedSet?.targetWeight, 225)
        XCTAssertEqual(fetchedSet?.targetWeightUnit, .lbs)
        XCTAssertEqual(fetchedSet?.targetReps, 5)
        XCTAssertEqual(fetchedSet?.targetRpe, 8)
        XCTAssertEqual(fetchedSet?.restSeconds, 180)
        XCTAssertEqual(fetchedSet?.tempo, "3-1-1-0")
        XCTAssertTrue(fetchedSet?.isDropset ?? false)
        XCTAssertTrue(fetchedSet?.isPerSide ?? false)
        XCTAssertTrue(fetchedSet?.isAmrap ?? false)
        XCTAssertEqual(fetchedSet?.notes, "Go heavy")
    }

    // MARK: - Exercise Properties

    func testCreatePreservesExerciseProperties() throws {
        let exercise = PlannedExercise(
            workoutPlanId: "plan-1",
            exerciseName: "Superset A",
            orderIndex: 0,
            notes: "No rest between",
            equipmentType: "barbell",
            groupType: .superset,
            groupName: "Chest/Back"
        )
        let plan = WorkoutPlan(name: "Grouped", exercises: [exercise])
        try repo.create(plan)

        let fetched = try repo.getById(plan.id)
        let fetchedEx = fetched?.exercises[0]
        XCTAssertEqual(fetchedEx?.notes, "No rest between")
        XCTAssertEqual(fetchedEx?.equipmentType, "barbell")
        XCTAssertEqual(fetchedEx?.groupType, .superset)
        XCTAssertEqual(fetchedEx?.groupName, "Chest/Back")
    }

    // MARK: - Multiple Plans

    func testGetAllOrdersByUpdatedAtDescending() throws {
        let plan1 = WorkoutPlan(
            name: "Old",
            createdAt: "2024-01-01T00:00:00Z",
            updatedAt: "2024-01-01T00:00:00Z"
        )
        let plan2 = WorkoutPlan(
            name: "New",
            createdAt: "2024-01-15T00:00:00Z",
            updatedAt: "2024-01-15T00:00:00Z"
        )
        try repo.create(plan1)
        try repo.create(plan2)

        let all = try repo.getAll()
        XCTAssertEqual(all[0].name, "New")
        XCTAssertEqual(all[1].name, "Old")
    }

    // MARK: - Helpers

    private func makePlan(
        name: String,
        tags: [String] = [],
        isFavorite: Bool = false,
        weightUnit: WeightUnit? = nil,
        sourceMarkdown: String? = nil,
        exercises: [PlannedExercise] = []
    ) -> WorkoutPlan {
        WorkoutPlan(
            name: name,
            tags: tags,
            defaultWeightUnit: weightUnit,
            sourceMarkdown: sourceMarkdown,
            isFavorite: isFavorite,
            exercises: exercises
        )
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
