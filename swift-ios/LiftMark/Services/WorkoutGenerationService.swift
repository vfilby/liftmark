import Foundation

// MARK: - Types

struct WorkoutGenerationContext {
    var defaultWeightUnit: WeightUnit
    var customPromptAddition: String?
    var recentWorkouts: String
    var availableEquipment: [String]
    var currentGym: String?
}

struct WorkoutGenerationParams {
    var intent: String
    var duration: WorkoutDuration?
    var difficulty: WorkoutDifficulty?
    var focusAreas: [String]?
    var equipmentOverride: [String]?
}

enum WorkoutDuration: String {
    case short   // ~30 min
    case medium  // ~60 min
    case long    // ~90 min
}

enum WorkoutDifficulty: String {
    case beginner
    case intermediate
    case advanced
}

struct WorkoutValidationResult {
    var valid: Bool
    var issues: [String]
    var warnings: [String]
}

// MARK: - WorkoutGenerationService

enum WorkoutGenerationService {

    // MARK: - Prompt Building

    /// Build the complete prompt for Claude API workout generation.
    static func buildWorkoutGenerationPrompt(
        context: WorkoutGenerationContext,
        params: WorkoutGenerationParams
    ) -> String {
        let equipment = params.equipmentOverride ?? context.availableEquipment
        let equipmentList = equipment.isEmpty ? "full commercial gym equipment" : equipment.joined(separator: ", ")

        let durationGuidance: String
        switch params.duration ?? .medium {
        case .short:
            durationGuidance = "~30 minutes (4-5 exercises, 12-15 working sets total)"
        case .medium:
            durationGuidance = "~60 minutes (6-8 exercises, 18-24 working sets total)"
        case .long:
            durationGuidance = "~90 minutes (8-10 exercises, 25-30 working sets total)"
        }

        let difficultyGuidance = params.difficulty.map { "Target difficulty: \($0.rawValue). " } ?? ""
        let focusAreasText = (params.focusAreas?.isEmpty == false)
            ? "Focus areas: \(params.focusAreas!.joined(separator: ", ")). "
            : ""

        let customNotes = context.customPromptAddition.map { "- Custom notes: \($0)" } ?? ""

        return """
        You are a professional strength coach creating a personalized workout for an athlete.

        # USER CONTEXT

        ## Recent Training History
        \(context.recentWorkouts)

        ## Current Gym & Equipment
        Gym: \(context.currentGym ?? "Default gym")
        Available equipment: \(equipmentList)

        ## Preferences
        - Weight unit: \(context.defaultWeightUnit.rawValue)
        \(customNotes)

        # WORKOUT REQUEST

        Generate a workout for: \(params.intent)

        \(difficultyGuidance)\(focusAreasText)Target duration: \(durationGuidance)

        # REQUIREMENTS

        1. **Progression**: Base exercises and weights on the user's recent training history and PRs
        2. **Equipment**: Only use equipment from the available list above
        3. **Specificity**: Address the user's stated intent (\(params.intent))
        4. **Recovery**: Consider recency and volume of similar movements in recent workouts
        5. **Format**: Output ONLY in LiftMark Workout Format (LMWF) - see spec below

        # LIFTMARK WORKOUT FORMAT (LMWF) SPECIFICATION

        The output must be valid LMWF markdown that can be parsed automatically.

        ## Structure:
        ```markdown
        # Workout Name
        @tags: tag1, tag2, tag3
        @units: \(context.defaultWeightUnit.rawValue)

        Optional freeform description or notes here.

        ## Exercise Name
        Optional exercise notes here
        - weight x reps @modifier: value
        - weight x reps @modifier: value

        ## Another Exercise
        - weight x reps
        ```

        ## Supported Set Formats:
        - `135 x 5` - Weight and reps
        - `x 10` - Bodyweight for reps
        - `60s` or `1m 30s` - Time-based (planks, cardio)

        ## Supported Modifiers:
        - `@rest: 120s` - Rest period in seconds
        - `@rpe: 8` - Rate of perceived exertion (1-10)
        - `@tempo: 3-0-1-0` - Eccentric-pause-concentric-pause in seconds
        - `@dropset` - Indicates a drop set
        - `@per-side` - Weight/reps are per side
        - `@amrap` - As many reps as possible

        ## Supersets and Grouping:
        Use nested headers for supersets/circuits:
        ```markdown
        ## Superset: Upper Body

        ### Bench Press
        - 185 x 8 @rest: 30s

        ### Barbell Row
        - 155 x 8 @rest: 120s
        ```

        # OUTPUT INSTRUCTIONS

        Generate ONLY the workout in LMWF format above. Do not include any preamble, explanation, or additional text outside the markdown format. The output should be ready to parse and save directly.
        """
    }

    // MARK: - AI Response Parsing

    /// Parse the AI's markdown response into a WorkoutPlan using the LMWF parser.
    static func parseAIWorkoutResponse(markdown: String, defaultWeightUnit: WeightUnit) throws -> WorkoutPlan {
        let result = MarkdownParser.parseWorkout(markdown)

        guard result.success, var workout = result.data else {
            let errorMessages = result.errors.joined(separator: "; ")
            throw WorkoutGenerationError.parseFailed(errorMessages.isEmpty ? "Unknown parse error" : errorMessages)
        }

        guard !workout.name.isEmpty, !workout.exercises.isEmpty else {
            throw WorkoutGenerationError.parseFailed("Invalid workout: missing name or exercises")
        }

        if workout.defaultWeightUnit == nil {
            workout.defaultWeightUnit = defaultWeightUnit
        }

        workout.sourceMarkdown = markdown

        return workout
    }

    // MARK: - Validation

    /// Validate that a generated workout meets quality standards.
    static func validateGeneratedWorkout(_ workout: WorkoutPlan) -> WorkoutValidationResult {
        var issues: [String] = []
        var warnings: [String] = []

        // Required fields
        if workout.name.trimmingCharacters(in: .whitespaces).isEmpty {
            issues.append("Workout name is required")
        }

        if workout.exercises.isEmpty {
            issues.append("Workout must have at least one exercise")
        }

        // Exercise validation
        for (idx, exercise) in workout.exercises.enumerated() {
            if exercise.exerciseName.trimmingCharacters(in: .whitespaces).isEmpty {
                issues.append("Exercise \(idx + 1) is missing a name")
            }

            if exercise.sets.isEmpty {
                warnings.append("Exercise \"\(exercise.exerciseName)\" has no sets")
            }

            // Set validation
            for (setIdx, set) in exercise.sets.enumerated() {
                let hasWeight = set.targetWeight != nil
                let hasReps = set.targetReps != nil
                let hasTime = set.targetTime != nil

                if !hasWeight && !hasReps && !hasTime {
                    issues.append("Exercise \"\(exercise.exerciseName)\", set \(setIdx + 1): must specify weight, reps, or time")
                }

                if hasWeight && set.targetWeightUnit == nil {
                    warnings.append("Exercise \"\(exercise.exerciseName)\", set \(setIdx + 1): weight specified without unit")
                }

                if let rpe = set.targetRpe, (rpe < 1 || rpe > 10) {
                    issues.append("Exercise \"\(exercise.exerciseName)\", set \(setIdx + 1): RPE must be between 1 and 10")
                }
            }
        }

        // Quality warnings
        let totalWorkingSets = workout.exercises.reduce(0) { $0 + $1.sets.count }
        if totalWorkingSets < 8 {
            warnings.append("Low total volume: only \(totalWorkingSets) working sets")
        }
        if totalWorkingSets > 40 {
            warnings.append("Very high volume: \(totalWorkingSets) working sets may be too much")
        }

        return WorkoutValidationResult(
            valid: issues.isEmpty,
            issues: issues,
            warnings: warnings
        )
    }
}

// MARK: - Errors

enum WorkoutGenerationError: LocalizedError {
    case parseFailed(String)

    var errorDescription: String? {
        switch self {
        case .parseFailed(let reason):
            return "Failed to parse AI workout response: \(reason)"
        }
    }
}
