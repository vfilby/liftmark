import Foundation

// MARK: - Parse Result Types

struct LMWFParseResult {
    let success: Bool
    let data: WorkoutPlan?
    let errors: [String]
    let warnings: [String]
}

private struct ParseError {
    let line: Int
    let message: String
    let code: String
}

private struct ParseWarning {
    let line: Int
    let message: String
    let code: String
}

// MARK: - Internal Parse Types

private struct ParsedLine {
    let lineNumber: Int
    let raw: String
    let trimmed: String
    var headerLevel: Int?
    var headerText: String?
    var isList: Bool = false
    var listContent: String?
    var isMetadata: Bool = false
    var metadataKey: String?
    var metadataValue: String?
}

private class ParseContext {
    var lines: [ParsedLine]
    var currentIndex: Int = 0
    var workoutHeaderLevel: Int?
    var exerciseHeaderLevel: Int?
    var errors: [ParseError] = []
    var warnings: [ParseWarning] = []

    init(lines: [ParsedLine]) {
        self.lines = lines
    }
}

private struct ParsedSet {
    var weight: Double?
    var weightUnit: WeightUnit?
    var reps: Int?
    var time: Int? // seconds
    var isAmrap: Bool?
    var rpe: Double?
    var rest: Int? // seconds
    var tempo: String?
    var isDropset: Bool?
    var isPerSide: Bool?
    var notes: String?
}

private struct WorkoutSection {
    let name: String
    let tags: [String]
    let defaultWeightUnit: WeightUnit?
    let notes: String?
}

// MARK: - MarkdownParser

enum MarkdownParser {

    // MARK: - Static Regex Patterns (compiled once at first use)

    // Line preprocessing patterns
    private static let headerRegex = try! NSRegularExpression(pattern: #"^(#{1,6})\s+(.+)$"#)
    private static let listRegex = try! NSRegularExpression(pattern: #"^-\s+(.+)$"#)
    private static let metadataRegex = try! NSRegularExpression(pattern: #"^@(\w+):\s*(.+)$"#)

    // Set parsing patterns
    // Pattern 1: weight unit x reps/time (e.g., "225 lbs x 5", "45 lbs x 60s")
    private static let setPattern1 = try! NSRegularExpression(
        pattern: #"^(\d+(?:\.\d+)?)\s*(lbs?|kgs?|kg|bw)?\s*(?:x|for)\s*(\d+|amrap)\s*(reps?|s|sec|m|min)?(?=\s|$)\s*(.*)$"#,
        options: .caseInsensitive
    )
    // Pattern 2: bodyweight x|for reps/time (e.g., "x 10", "bw x 12", "bw for 60s")
    private static let setPattern2 = try! NSRegularExpression(
        pattern: #"^(?:(bw|x)\s*)?(?:x|for)\s*(\d+|amrap)\s*(reps?|s|sec|m|min)?(?=\s|$)\s*(.*)$"#,
        options: .caseInsensitive
    )
    // Pattern 3: single number (e.g., "10" = bodyweight reps, "60s" = time)
    private static let setPattern3 = try! NSRegularExpression(
        pattern: #"^(\d+)\s*(s|sec|m|min)?(?=\s|$)\s*(.*)$"#,
        options: .caseInsensitive
    )

    // Modifier parsing patterns
    private static let modifierPattern = try! NSRegularExpression(pattern: #"^(\w+):\s*(.+)$"#)
    private static let rpePattern = try! NSRegularExpression(pattern: #"^(\d+(?:\.\d+)?)\s*(.*)$"#)
    private static let restPattern = try! NSRegularExpression(
        pattern: #"^(\d+)\s*(s|sec|m|min)?\s*(.*)$"#,
        options: .caseInsensitive
    )
    private static let tempoPattern = try! NSRegularExpression(pattern: #"^(\d-\d-\d-\d)\s*(.*)$"#)
    private static let restTimePattern = try! NSRegularExpression(
        pattern: #"^(\d+)\s*(s|sec|m|min)?$"#,
        options: .caseInsensitive
    )

    // MARK: - Public API

    /// Parse markdown text into a WorkoutPlan
    static func parseWorkout(_ markdown: String) -> LMWFParseResult {
        let context = ParseContext(lines: preprocessLines(markdown))
        let workoutId = generateId()

        // Find workout header
        guard let workoutHeaderLine = findWorkoutHeader(context) else {
            return LMWFParseResult(
                success: false,
                data: nil,
                errors: ["No workout header found. Must have a header (# Workout Name) with exercises below it."],
                warnings: []
            )
        }

        // Parse workout metadata and notes
        let section = parseWorkoutSection(context, headerLine: workoutHeaderLine)

        // Parse exercises
        var exercises = parseExercises(context, workoutPlanId: workoutId)

        // Apply default weight unit to sets that have a weight but no explicit unit
        if let defaultUnit = section.defaultWeightUnit {
            for i in exercises.indices {
                for j in exercises[i].sets.indices {
                    if exercises[i].sets[j].targetWeight != nil && exercises[i].sets[j].targetWeightUnit == nil {
                        exercises[i].sets[j].targetWeightUnit = defaultUnit
                    }
                }
            }
        }

        if exercises.isEmpty {
            context.errors.append(ParseError(
                line: workoutHeaderLine.lineNumber,
                message: "Workout must contain at least one exercise",
                code: "NO_EXERCISES"
            ))
        }

        // Check for critical errors
        if !context.errors.isEmpty {
            return LMWFParseResult(
                success: false,
                data: nil,
                errors: context.errors.map { "Line \($0.line): \($0.message)" },
                warnings: context.warnings.map { "Line \($0.line): \($0.message)" }
            )
        }

        // Check for duplicate exercise names
        var seenExerciseNames: [String: Int] = [:]
        for exercise in exercises {
            let lowerName = exercise.exerciseName.lowercased()
            if let firstLine = seenExerciseNames[lowerName] {
                _ = firstLine // first occurrence tracked for reference
                context.warnings.append(ParseWarning(
                    line: 0,
                    message: "Duplicate exercise name: '\(exercise.exerciseName)'. Consider merging or renaming.",
                    code: "DUPLICATE_EXERCISE_NAME"
                ))
            } else {
                seenExerciseNames[lowerName] = 0
            }
        }

        let now = ISO8601DateFormatter().string(from: Date())
        let workout = WorkoutPlan(
            id: workoutId,
            name: section.name,
            description: section.notes,
            tags: section.tags,
            defaultWeightUnit: section.defaultWeightUnit,
            sourceMarkdown: markdown,
            createdAt: now,
            updatedAt: now,
            isFavorite: false,
            exercises: exercises
        )

        return LMWFParseResult(
            success: true,
            data: workout,
            errors: [],
            warnings: context.warnings.map { "Line \($0.line): \($0.message)" }
        )
    }

    // MARK: - ID Generation

    private static func generateId() -> String {
        UUID().uuidString.lowercased()
    }

    // MARK: - Line Preprocessing

    private static func preprocessLines(_ markdown: String) -> [ParsedLine] {
        // Normalize line endings (CRLF -> LF, CR -> LF)
        let normalized = markdown.replacingOccurrences(of: "\r\n", with: "\n")
            .replacingOccurrences(of: "\r", with: "\n")
        let rawLines = normalized.components(separatedBy: "\n")

        let headerRegex = Self.headerRegex
        let listRegex = Self.listRegex
        let metadataRegex = Self.metadataRegex

        return rawLines.enumerated().map { index, raw in
            let trimmed = raw.trimmingCharacters(in: .whitespaces)
            let lineNumber = index + 1
            let nsRange = NSRange(trimmed.startIndex..., in: trimmed)

            // Parse header (# Header Text)
            if let match = headerRegex.firstMatch(in: trimmed, range: nsRange),
               let hashRange = Range(match.range(at: 1), in: trimmed),
               let textRange = Range(match.range(at: 2), in: trimmed) {
                return ParsedLine(
                    lineNumber: lineNumber,
                    raw: raw,
                    trimmed: trimmed,
                    headerLevel: trimmed[hashRange].count,
                    headerText: String(trimmed[textRange]).trimmingCharacters(in: .whitespaces)
                )
            }

            // Parse list item (- Content)
            if let match = listRegex.firstMatch(in: trimmed, range: nsRange),
               let contentRange = Range(match.range(at: 1), in: trimmed) {
                return ParsedLine(
                    lineNumber: lineNumber,
                    raw: raw,
                    trimmed: trimmed,
                    isList: true,
                    listContent: String(trimmed[contentRange]).trimmingCharacters(in: .whitespaces)
                )
            }

            // Parse metadata (@key: value)
            if let match = metadataRegex.firstMatch(in: trimmed, range: nsRange),
               let keyRange = Range(match.range(at: 1), in: trimmed),
               let valueRange = Range(match.range(at: 2), in: trimmed) {
                return ParsedLine(
                    lineNumber: lineNumber,
                    raw: raw,
                    trimmed: trimmed,
                    isMetadata: true,
                    metadataKey: String(trimmed[keyRange]).lowercased(),
                    metadataValue: String(trimmed[valueRange]).trimmingCharacters(in: .whitespaces)
                )
            }

            // Regular text
            return ParsedLine(
                lineNumber: lineNumber,
                raw: raw,
                trimmed: trimmed
            )
        }
    }

    // MARK: - Workout Header Detection

    /// Find the workout header — first header that has child headers with sets
    private static func findWorkoutHeader(_ context: ParseContext) -> ParsedLine? {
        for i in 0..<context.lines.count {
            let line = context.lines[i]
            if let headerLevel = line.headerLevel, line.headerText != nil {
                if hasChildExercises(context, headerIndex: i, headerLevel: headerLevel) {
                    context.workoutHeaderLevel = headerLevel
                    context.exerciseHeaderLevel = headerLevel + 1
                    context.currentIndex = i
                    return line
                }
            }
        }
        return nil
    }

    /// Check if a header has child exercise headers (with sets)
    private static func hasChildExercises(_ context: ParseContext, headerIndex: Int, headerLevel: Int) -> Bool {
        let exerciseLevel = headerLevel + 1

        for i in (headerIndex + 1)..<context.lines.count {
            let line = context.lines[i]

            // Stop if we hit a header at same or higher level
            if let level = line.headerLevel, level <= headerLevel {
                break
            }

            // Check if this is an exercise header (one level below workout)
            if line.headerLevel == exerciseLevel {
                if hasSetsBelowHeader(context, headerIndex: i, headerLevel: exerciseLevel) {
                    return true
                }
            }
        }

        return false
    }

    /// Check if a header has sets below it (or nested headers with sets)
    private static func hasSetsBelowHeader(_ context: ParseContext, headerIndex: Int, headerLevel: Int) -> Bool {
        for i in (headerIndex + 1)..<context.lines.count {
            let line = context.lines[i]

            // Stop if we hit a header at same or higher level
            if let level = line.headerLevel, level <= headerLevel {
                break
            }

            // Found a set
            if line.isList {
                return true
            }

            // Check nested headers (for supersets/sections)
            if let level = line.headerLevel, level > headerLevel {
                if hasSetsBelowHeader(context, headerIndex: i, headerLevel: level) {
                    return true
                }
            }
        }

        return false
    }

    // MARK: - Workout Section Parsing

    private static func parseWorkoutSection(_ context: ParseContext, headerLine: ParsedLine) -> WorkoutSection {
        let name = headerLine.headerText ?? ""
        var tags: [String] = []
        var defaultWeightUnit: WeightUnit?
        var noteLines: [String] = []

        // Move past header
        context.currentIndex += 1

        // Collect metadata and notes until we hit an exercise header
        while context.currentIndex < context.lines.count {
            let line = context.lines[context.currentIndex]

            // Stop at exercise header
            if line.headerLevel == context.exerciseHeaderLevel {
                break
            }

            // Stop at headers higher than workout level
            if let level = line.headerLevel, let workoutLevel = context.workoutHeaderLevel, level <= workoutLevel {
                break
            }

            // Parse metadata
            if line.isMetadata {
                if line.metadataKey == "tags" {
                    tags = parseTagsMetadata(line.metadataValue ?? "")
                } else if line.metadataKey == "units" {
                    if let unit = parseUnitsMetadata(line.metadataValue ?? "", context: context, lineNumber: line.lineNumber) {
                        defaultWeightUnit = unit
                    }
                }
                // Ignore unknown metadata (forward compatible)
            } else if !line.trimmed.isEmpty {
                // Collect freeform notes (non-empty, non-metadata lines)
                noteLines.append(line.trimmed)
            }

            context.currentIndex += 1
        }

        return WorkoutSection(
            name: name,
            tags: tags,
            defaultWeightUnit: defaultWeightUnit,
            notes: noteLines.isEmpty ? nil : noteLines.joined(separator: "\n")
        )
    }

    /// Parse @tags metadata: "tag1, tag2, tag3" -> ["tag1", "tag2", "tag3"]
    private static func parseTagsMetadata(_ value: String) -> [String] {
        value.components(separatedBy: ",")
            .map { $0.trimmingCharacters(in: .whitespaces) }
            .filter { !$0.isEmpty }
    }

    /// Parse @units metadata: "lbs" or "kg"
    private static func parseUnitsMetadata(_ value: String, context: ParseContext, lineNumber: Int) -> WeightUnit? {
        let normalized = value.lowercased().trimmingCharacters(in: .whitespaces)
        switch normalized {
        case "lbs", "lb":
            return .lbs
        case "kg", "kgs":
            return .kg
        default:
            context.errors.append(ParseError(
                line: lineNumber,
                message: "Invalid @units value \"\(value)\". Must be \"lbs\" or \"kg\"",
                code: "INVALID_UNITS"
            ))
            return nil
        }
    }

    // MARK: - Exercise Parsing

    /// Parse all exercises in the workout
    private static func parseExercises(_ context: ParseContext, workoutPlanId: String) -> [PlannedExercise] {
        var exercises: [PlannedExercise] = []
        var orderIndex = 0

        while context.currentIndex < context.lines.count {
            let line = context.lines[context.currentIndex]

            // Stop at headers at or above workout level
            if let level = line.headerLevel, let workoutLevel = context.workoutHeaderLevel, level <= workoutLevel {
                break
            }

            // Parse exercise at expected level
            if line.headerLevel == context.exerciseHeaderLevel {
                let result = parseExerciseBlock(context, workoutPlanId: workoutPlanId, orderIndex: orderIndex)
                switch result {
                case .single(let exercise):
                    exercises.append(exercise)
                    orderIndex += 1
                case .group(let groupExercises):
                    exercises.append(contentsOf: groupExercises)
                    orderIndex += groupExercises.count
                case .none:
                    break
                }
            } else {
                context.currentIndex += 1
            }
        }

        return exercises
    }

    private enum ExerciseBlockResult {
        case single(PlannedExercise)
        case group([PlannedExercise])
        case none
    }

    /// Parse a single exercise block (header, metadata, notes, sets)
    private static func parseExerciseBlock(
        _ context: ParseContext,
        workoutPlanId: String,
        orderIndex: Int
    ) -> ExerciseBlockResult {
        let headerLine = context.lines[context.currentIndex]
        guard let headerLevel = headerLine.headerLevel, let exerciseName = headerLine.headerText else {
            context.currentIndex += 1
            return .none
        }

        let exerciseId = generateId()

        // Check if this is a superset or section (has nested headers)
        let isSuperset = exerciseName.lowercased().contains("superset")
        let hasNested = checkForNestedHeaders(context, headerIndex: context.currentIndex, headerLevel: headerLevel)

        // If it has nested headers, it's either a superset or section
        if hasNested {
            let grouped = parseGroupedExercises(
                context,
                workoutPlanId: workoutPlanId,
                orderIndex: orderIndex,
                groupName: exerciseName,
                isSuperset: isSuperset
            )
            return .group(grouped)
        }

        // Regular exercise (no nested headers)
        context.currentIndex += 1

        // Parse metadata and notes
        let (equipmentType, notes) = parseExerciseMetadata(context, exerciseHeaderLevel: headerLevel)

        // Parse sets
        var sets = parseSets(context, exerciseHeaderLevel: headerLevel, exerciseId: exerciseId)

        // Auto-detect per-side keywords in exercise notes → flag timed sets as isPerSide
        let perSideKeywords = ["per side", "per leg", "per arm", "each side", "each leg", "each arm", "each"]
        if let notes = notes, perSideKeywords.contains(where: { notes.range(of: $0, options: .caseInsensitive) != nil }) {
            sets = sets.map { set in
                guard set.targetTime != nil, !set.isPerSide else { return set }
                var modified = set
                modified.isPerSide = true
                return modified
            }
        }

        if sets.isEmpty {
            context.errors.append(ParseError(
                line: headerLine.lineNumber,
                message: "Exercise \"\(exerciseName)\" has no sets",
                code: "NO_SETS"
            ))
        }

        let exercise = PlannedExercise(
            id: exerciseId,
            workoutPlanId: workoutPlanId,
            exerciseName: exerciseName,
            orderIndex: orderIndex,
            notes: notes,
            equipmentType: equipmentType,
            sets: sets
        )
        return .single(exercise)
    }

    /// Check if there are nested headers below current header
    private static func checkForNestedHeaders(_ context: ParseContext, headerIndex: Int, headerLevel: Int) -> Bool {
        for i in (headerIndex + 1)..<context.lines.count {
            let line = context.lines[i]

            // Stop at same or higher level header
            if let level = line.headerLevel, level <= headerLevel {
                break
            }

            // Found nested header at any level below parent
            if let level = line.headerLevel, level > headerLevel {
                return true
            }
        }
        return false
    }

    /// Find the header level of child exercises within a group
    private static func findChildExerciseLevel(_ context: ParseContext, startIndex: Int, parentLevel: Int) -> Int? {
        for i in startIndex..<context.lines.count {
            let line = context.lines[i]

            // Stop at same or higher level header
            if let level = line.headerLevel, level <= parentLevel {
                break
            }

            // Check if this header has sets below it
            if let level = line.headerLevel, level > parentLevel {
                if hasSetsBelowHeader(context, headerIndex: i, headerLevel: level) {
                    return level
                }
            }
        }
        return nil
    }

    /// Parse grouped exercises (superset or section)
    private static func parseGroupedExercises(
        _ context: ParseContext,
        workoutPlanId: String,
        orderIndex: Int,
        groupName: String,
        isSuperset: Bool
    ) -> [PlannedExercise] {
        let headerLine = context.lines[context.currentIndex]
        let parentId = generateId()
        let groupType: GroupType = isSuperset ? .superset : .section

        // Create parent exercise (no sets, just a grouping container)
        let parentExercise = PlannedExercise(
            id: parentId,
            workoutPlanId: workoutPlanId,
            exerciseName: groupName,
            orderIndex: orderIndex,
            groupType: groupType,
            groupName: groupName,
            sets: []
        )

        context.currentIndex += 1

        // Find the first child header level that contains exercises (sets)
        let childExerciseLevel = findChildExerciseLevel(context, startIndex: context.currentIndex, parentLevel: headerLine.headerLevel!)

        // Parse child exercises
        var childExercises: [PlannedExercise] = []
        var childOrderIndex = 0

        while context.currentIndex < context.lines.count {
            let line = context.lines[context.currentIndex]

            // Stop at same or higher level header
            if let level = line.headerLevel, level <= headerLine.headerLevel! {
                break
            }

            // Parse child exercise at the determined child level
            if let childLevel = childExerciseLevel, line.headerLevel == childLevel {
                let result = parseExerciseBlock(context, workoutPlanId: workoutPlanId, orderIndex: orderIndex + childOrderIndex + 1)
                switch result {
                case .single(var exercise):
                    if exercise.parentExerciseId == nil {
                        exercise.parentExerciseId = parentId
                    }
                    if exercise.groupType == nil {
                        exercise.groupType = groupType
                        exercise.groupName = groupName
                    }
                    childExercises.append(exercise)
                    childOrderIndex += 1
                case .group(var exercises):
                    for i in 0..<exercises.count {
                        if exercises[i].parentExerciseId == nil {
                            exercises[i].parentExerciseId = parentId
                        }
                        if exercises[i].groupType != .superset || exercises[i].sets.isEmpty {
                            if exercises[i].groupType == nil {
                                exercises[i].groupType = groupType
                                exercises[i].groupName = groupName
                            }
                        }
                        childExercises.append(exercises[i])
                        childOrderIndex += 1
                    }
                case .none:
                    break
                }
            } else {
                context.currentIndex += 1
            }
        }

        return [parentExercise] + childExercises
    }

    /// Parse exercise metadata (@type, freeform notes)
    private static func parseExerciseMetadata(_ context: ParseContext, exerciseHeaderLevel: Int) -> (equipmentType: String?, notes: String?) {
        var equipmentType: String?
        var noteLines: [String] = []

        while context.currentIndex < context.lines.count {
            let line = context.lines[context.currentIndex]

            // Stop at headers at or above exercise level
            if let level = line.headerLevel, level <= exerciseHeaderLevel {
                break
            }

            // Stop at sets (list items)
            if line.isList {
                break
            }

            // Parse metadata
            if line.isMetadata {
                if line.metadataKey == "type" {
                    equipmentType = line.metadataValue
                }
                // Ignore unknown metadata (forward compatible)
                context.currentIndex += 1
            } else if !line.trimmed.isEmpty {
                noteLines.append(line.trimmed)
                context.currentIndex += 1
            } else {
                context.currentIndex += 1
            }
        }

        return (
            equipmentType: equipmentType,
            notes: noteLines.isEmpty ? nil : noteLines.joined(separator: "\n")
        )
    }

    // MARK: - Set Parsing

    /// Parse all sets for an exercise
    private static func parseSets(_ context: ParseContext, exerciseHeaderLevel: Int, exerciseId: String) -> [PlannedSet] {
        var sets: [PlannedSet] = []
        var orderIndex = 0

        while context.currentIndex < context.lines.count {
            let line = context.lines[context.currentIndex]

            // Stop at headers at or above exercise level
            if let level = line.headerLevel, level <= exerciseHeaderLevel {
                break
            }

            // Parse set (list item)
            if line.isList, let listContent = line.listContent {
                if let parsedSet = parseSetLine(listContent, context: context, lineNumber: line.lineNumber) {
                    sets.append(PlannedSet(
                        id: generateId(),
                        plannedExerciseId: exerciseId,
                        orderIndex: orderIndex,
                        targetWeight: parsedSet.weight,
                        targetWeightUnit: parsedSet.weightUnit,
                        targetReps: parsedSet.reps,
                        targetTime: parsedSet.time,
                        targetRpe: parsedSet.rpe.map { Int($0.rounded()) },
                        restSeconds: parsedSet.rest,
                        tempo: parsedSet.tempo,
                        isDropset: parsedSet.isDropset ?? false,
                        isPerSide: parsedSet.isPerSide ?? false,
                        isAmrap: parsedSet.isAmrap ?? false,
                        notes: parsedSet.notes
                    ))
                    orderIndex += 1
                }
                context.currentIndex += 1
            } else {
                context.currentIndex += 1
            }
        }

        return sets
    }

    /// Parse a single set line
    private static func parseSetLine(_ content: String, context: ParseContext, lineNumber: Int) -> ParsedSet? {
        // Split on @ to separate main content from modifiers
        let parts = content.components(separatedBy: "@")
        let mainPart = parts[0].trimmingCharacters(in: .whitespaces)
        let modifierParts = Array(parts.dropFirst())

        // Parse modifiers and extract trailing text
        let (modifiers, modifierTrailingText) = parseModifiersAndTrailingText(modifierParts, context: context, lineNumber: lineNumber)

        // Parse main set content
        guard let (setResult, mainTrailingText) = parseMainSetContent(mainPart, context: context, lineNumber: lineNumber) else {
            return nil
        }

        // Combine trailing text
        let combined = [mainTrailingText, modifierTrailingText].compactMap { $0 }.joined(separator: " ").trimmingCharacters(in: .whitespaces)

        // Merge modifiers into set
        var result = setResult
        if let rpe = modifiers.rpe { result.rpe = rpe }
        if let rest = modifiers.rest { result.rest = rest }
        if let tempo = modifiers.tempo { result.tempo = tempo }
        if let isDropset = modifiers.isDropset { result.isDropset = isDropset }
        if let isPerSide = modifiers.isPerSide { result.isPerSide = isPerSide }
        if !combined.isEmpty { result.notes = combined }

        // Auto-detect per-side keywords in set-line trailing text for timed sets
        if result.time != nil && result.isPerSide != true {
            let perSideKeywords = ["per side", "per leg", "per arm", "each side", "each leg", "each arm", "each"]
            let textToCheck = combined
            if !textToCheck.isEmpty, perSideKeywords.contains(where: { textToCheck.range(of: $0, options: .caseInsensitive) != nil }) {
                result.isPerSide = true
                // Strip the per-side keyword from notes since it's now conveyed by the flag
                var cleaned = textToCheck
                for keyword in perSideKeywords {
                    if let range = cleaned.range(of: keyword, options: .caseInsensitive) {
                        cleaned.replaceSubrange(range, with: "")
                    }
                }
                cleaned = cleaned.trimmingCharacters(in: .whitespacesAndNewlines)
                result.notes = cleaned.isEmpty ? nil : cleaned
            }
        }

        return result
    }

    /// Parse the main set content (before modifiers)
    private static func parseMainSetContent(
        _ content: String,
        context: ParseContext,
        lineNumber: Int
    ) -> (set: ParsedSet, trailingText: String?)? {
        let original = content.trimmingCharacters(in: .whitespaces)
        let trimmedLower = original.lowercased()

        // Reject standalone AMRAP — AMRAP must modify a weight (e.g., "135 x AMRAP", "bw x AMRAP")
        if trimmedLower == "amrap" {
            context.errors.append(ParseError(
                line: lineNumber,
                message: "Standalone \"AMRAP\" is not valid. AMRAP must be used with a weight (e.g., \"135 x AMRAP\" or \"bw x AMRAP\")",
                code: "STANDALONE_AMRAP"
            ))
            return nil
        }

        let pattern1 = Self.setPattern1
        let pattern2 = Self.setPattern2
        let pattern3 = Self.setPattern3

        let range = NSRange(original.startIndex..., in: original)

        // Try pattern 1
        if let match = pattern1.firstMatch(in: original, range: range) {
            let weightStr = substring(of: original, range: match.range(at: 1))!
            let unitStr = substring(of: original, range: match.range(at: 2))
            let repsOrTimeStr = substring(of: original, range: match.range(at: 3))!.lowercased()
            let repsUnitStr = substring(of: original, range: match.range(at: 4))
            let trailing = substring(of: original, range: match.range(at: 5))?.trimmingCharacters(in: .whitespaces)

            let weight = Double(weightStr)!
            let weightUnit = normalizeWeightUnit(unitStr)

            if weight < 0 {
                context.errors.append(ParseError(line: lineNumber, message: "Weight cannot be negative", code: "NEGATIVE_WEIGHT"))
                return nil
            }

            // Check if it's AMRAP
            if repsOrTimeStr == "amrap" {
                let isBW = unitStr?.lowercased() == "bw"
                return (
                    ParsedSet(
                        weight: isBW ? nil : weight,
                        weightUnit: isBW ? nil : weightUnit,
                        isAmrap: true
                    ),
                    trailing?.isEmpty == true ? nil : trailing
                )
            }

            let value = Int(repsOrTimeStr)!
            if value <= 0 {
                context.errors.append(ParseError(line: lineNumber, message: "Reps/time must be positive", code: "INVALID_REPS_TIME"))
                return nil
            }

            let isTime = repsUnitStr.map { $0.lowercased().hasPrefix("s") || $0.lowercased().hasPrefix("m") } ?? false

            let isBW = unitStr?.lowercased() == "bw"

            if isTime {
                let seconds = normalizeTimeToSeconds(value, unit: repsUnitStr)
                return (
                    ParsedSet(
                        weight: isBW ? nil : weight,
                        weightUnit: isBW ? nil : (weightUnit ?? nil),
                        time: seconds
                    ),
                    trailing?.isEmpty == true ? nil : trailing
                )
            } else {
                if value > 100 {
                    context.warnings.append(ParseWarning(
                        line: lineNumber,
                        message: "Very high rep count (\(value)). Double-check for typos.",
                        code: "HIGH_REPS"
                    ))
                }
                return (
                    ParsedSet(
                        weight: isBW ? nil : weight,
                        weightUnit: isBW ? nil : (weightUnit ?? nil),
                        reps: value
                    ),
                    trailing?.isEmpty == true ? nil : trailing
                )
            }
        }

        // Try pattern 2
        if let match = pattern2.firstMatch(in: original, range: range) {
            let repsOrTimeStr = substring(of: original, range: match.range(at: 2))!.lowercased()
            let repsUnitStr = substring(of: original, range: match.range(at: 3))
            let trailing = substring(of: original, range: match.range(at: 4))?.trimmingCharacters(in: .whitespaces)

            if repsOrTimeStr == "amrap" {
                return (ParsedSet(isAmrap: true), trailing?.isEmpty == true ? nil : trailing)
            }

            let value = Int(repsOrTimeStr)!
            if value <= 0 {
                context.errors.append(ParseError(line: lineNumber, message: "Reps/time must be positive", code: "INVALID_REPS_TIME"))
                return nil
            }

            let isTime = repsUnitStr.map { $0.lowercased().hasPrefix("s") || $0.lowercased().hasPrefix("m") } ?? false

            if isTime {
                let seconds = normalizeTimeToSeconds(value, unit: repsUnitStr)
                return (ParsedSet(time: seconds), trailing?.isEmpty == true ? nil : trailing)
            } else {
                if value > 100 {
                    context.warnings.append(ParseWarning(
                        line: lineNumber,
                        message: "Very high rep count (\(value)). Double-check for typos.",
                        code: "HIGH_REPS"
                    ))
                }
                return (ParsedSet(reps: value), trailing?.isEmpty == true ? nil : trailing)
            }
        }

        // Try pattern 3
        if let match = pattern3.firstMatch(in: original, range: range) {
            let valueStr = substring(of: original, range: match.range(at: 1))!
            let unitStr = substring(of: original, range: match.range(at: 2))
            let trailing = substring(of: original, range: match.range(at: 3))?.trimmingCharacters(in: .whitespaces)

            // Reject "135 lbs" or "100 kg" — weight unit without reps/time is incomplete
            if unitStr == nil, let trailing = trailing, !trailing.isEmpty {
                let trailingLower = trailing.lowercased()
                if trailingLower.hasPrefix("lb") || trailingLower.hasPrefix("kg") {
                    context.errors.append(ParseError(
                        line: lineNumber,
                        message: "Incomplete set: \"\(content)\". Weight with unit requires reps (x 5) or time (x 60s)",
                        code: "INCOMPLETE_SET"
                    ))
                    return nil
                }
            }

            let value = Int(valueStr)!
            if value <= 0 {
                context.errors.append(ParseError(line: lineNumber, message: "Reps/time must be positive", code: "INVALID_REPS_TIME"))
                return nil
            }

            let isTime = unitStr.map { $0.lowercased().hasPrefix("s") || $0.lowercased().hasPrefix("m") } ?? false

            if isTime {
                let seconds = normalizeTimeToSeconds(value, unit: unitStr)
                return (ParsedSet(time: seconds), trailing?.isEmpty == true ? nil : trailing)
            } else {
                if value > 100 {
                    context.warnings.append(ParseWarning(
                        line: lineNumber,
                        message: "Very high rep count (\(value)). Double-check for typos.",
                        code: "HIGH_REPS"
                    ))
                }
                return (ParsedSet(reps: value), trailing?.isEmpty == true ? nil : trailing)
            }
        }

        // Failed to parse
        context.errors.append(ParseError(
            line: lineNumber,
            message: "Invalid set format: \"\(content)\". Expected format: \"weight unit x reps\" or \"time\" or \"AMRAP\"",
            code: "INVALID_SET_FORMAT"
        ))
        return nil
    }

    // MARK: - Helpers

    /// Extract a substring from an NSRange, returning nil for NSNotFound
    private static func substring(of string: String, range: NSRange) -> String? {
        guard range.location != NSNotFound, let swiftRange = Range(range, in: string) else { return nil }
        let result = String(string[swiftRange])
        return result.isEmpty ? nil : result
    }

    /// Normalize weight unit to standard format
    private static func normalizeWeightUnit(_ unit: String?) -> WeightUnit? {
        guard let unit = unit else { return nil }
        let normalized = unit.lowercased().trimmingCharacters(in: .whitespaces)
        switch normalized {
        case "lb", "lbs": return .lbs
        case "kg", "kgs": return .kg
        case "bw": return nil // bodyweight — caller handles this
        default: return nil
        }
    }

    /// Normalize time value to seconds
    private static func normalizeTimeToSeconds(_ value: Int, unit: String?) -> Int {
        guard let unit = unit else { return value }
        if unit.lowercased().hasPrefix("m") {
            return value * 60
        }
        return value
    }

    /// Parse modifiers and extract trailing text from @ parts
    private static func parseModifiersAndTrailingText(
        _ parts: [String],
        context: ParseContext,
        lineNumber: Int
    ) -> (modifiers: ParsedSet, trailingText: String?) {
        var modifiers = ParsedSet()
        var trailingTextParts: [String] = []

        for part in parts {
            let trimmed = part.trimmingCharacters(in: .whitespaces)
            if trimmed.isEmpty { continue }

            let lowerTrimmed = trimmed.lowercased()

            // Check flag modifiers
            if lowerTrimmed.hasPrefix("dropset") {
                modifiers.isDropset = true
                let trailing = String(trimmed.dropFirst("dropset".count)).trimmingCharacters(in: .whitespaces)
                if !trailing.isEmpty { trailingTextParts.append(trailing) }
                continue
            }
            if lowerTrimmed.hasPrefix("perside") {
                modifiers.isPerSide = true
                let trailing = String(trimmed.dropFirst("perside".count)).trimmingCharacters(in: .whitespaces)
                if !trailing.isEmpty { trailingTextParts.append(trailing) }
                continue
            }

            // Try to parse as key: value modifier
            let modifierPattern = Self.modifierPattern
            let nsRange = NSRange(trimmed.startIndex..., in: trimmed)
            guard let match = modifierPattern.firstMatch(in: trimmed, range: nsRange),
                  let keyStr = substring(of: trimmed, range: match.range(at: 1)),
                  let valueStr = substring(of: trimmed, range: match.range(at: 2)) else {
                // Not a valid modifier, treat as trailing text
                trailingTextParts.append(trimmed)
                continue
            }

            let key = keyStr.lowercased()
            let value = valueStr.trimmingCharacters(in: .whitespaces)

            switch key {
            case "rpe":
                let rpePattern = Self.rpePattern
                let rpeRange = NSRange(value.startIndex..., in: value)
                if let rpeMatch = rpePattern.firstMatch(in: value, range: rpeRange),
                   let rpeStr = substring(of: value, range: rpeMatch.range(at: 1)),
                   let rpe = Double(rpeStr) {
                    let remaining = substring(of: value, range: rpeMatch.range(at: 2))?.trimmingCharacters(in: .whitespaces)
                    if rpe < 1 || rpe > 10 {
                        context.errors.append(ParseError(line: lineNumber, message: "RPE must be between 1-10, got: \(rpeStr)", code: "INVALID_RPE"))
                    } else {
                        let rounded = (rpe * 2).rounded() / 2
                        let clamped = max(1, min(10, rounded))
                        if clamped != rpe {
                            context.warnings.append(ParseWarning(line: lineNumber, message: "RPE rounded to nearest 0.5 (\(rpeStr) → \(clamped.truncatingRemainder(dividingBy: 1) == 0 ? String(format: "%.0f", clamped) : String(clamped)))", code: "RPE_ROUNDED"))
                        }
                        modifiers.rpe = clamped
                        if let remaining = remaining, !remaining.isEmpty { trailingTextParts.append(remaining) }
                        context.warnings.append(ParseWarning(line: lineNumber, message: "@rpe is deprecated — use freeform notes instead", code: "DEPRECATED_RPE"))
                    }
                } else {
                    context.errors.append(ParseError(line: lineNumber, message: "Invalid RPE format: \(value)", code: "INVALID_RPE"))
                }

            case "rest":
                let restPattern = Self.restPattern
                let restRange = NSRange(value.startIndex..., in: value)
                if let restMatch = restPattern.firstMatch(in: value, range: restRange),
                   let numStr = substring(of: value, range: restMatch.range(at: 1)) {
                    let unitStr = substring(of: value, range: restMatch.range(at: 2))
                    let remaining = substring(of: value, range: restMatch.range(at: 3))?.trimmingCharacters(in: .whitespaces)
                    let restValue = "\(numStr)\(unitStr ?? "")"
                    if let rest = parseRestTime(restValue) {
                        if rest < 10 {
                            context.warnings.append(ParseWarning(line: lineNumber, message: "Very short rest period (\(rest)s). Double-check for typos.", code: "SHORT_REST"))
                        }
                        if rest > 600 {
                            context.warnings.append(ParseWarning(line: lineNumber, message: "Very long rest period (\(rest)s). Double-check for typos.", code: "LONG_REST"))
                        }
                        modifiers.rest = rest
                        if let remaining = remaining, !remaining.isEmpty { trailingTextParts.append(remaining) }
                    } else {
                        context.errors.append(ParseError(line: lineNumber, message: "Invalid rest time format: \(restValue). Expected format: \"180s\" or \"3m\"", code: "INVALID_REST"))
                    }
                } else {
                    context.errors.append(ParseError(line: lineNumber, message: "Invalid rest time format: \(value). Expected format: \"180s\" or \"3m\"", code: "INVALID_REST"))
                }

            case "tempo":
                let tempoPattern = Self.tempoPattern
                let tempoRange = NSRange(value.startIndex..., in: value)
                if let tempoMatch = tempoPattern.firstMatch(in: value, range: tempoRange),
                   let tempoStr = substring(of: value, range: tempoMatch.range(at: 1)) {
                    modifiers.tempo = tempoStr
                    let remaining = substring(of: value, range: tempoMatch.range(at: 2))?.trimmingCharacters(in: .whitespaces)
                    if let remaining = remaining, !remaining.isEmpty { trailingTextParts.append(remaining) }
                    context.warnings.append(ParseWarning(line: lineNumber, message: "@tempo is deprecated — use freeform notes instead", code: "DEPRECATED_TEMPO"))
                } else {
                    context.errors.append(ParseError(line: lineNumber, message: "Invalid tempo format: \(value). Expected format: \"X-X-X-X\" (e.g., \"3-0-1-0\")", code: "INVALID_TEMPO"))
                }

            default:
                // Unknown modifier
                context.warnings.append(ParseWarning(line: lineNumber, message: "Unknown modifier: @\(key)", code: "UNKNOWN_MODIFIER"))
                trailingTextParts.append(trimmed)
            }
        }

        return (modifiers, trailingTextParts.isEmpty ? nil : trailingTextParts.joined(separator: " "))
    }

    /// Parse rest time to seconds
    private static func parseRestTime(_ value: String) -> Int? {
        let pattern = Self.restTimePattern
        let range = NSRange(value.startIndex..., in: value)
        guard let match = pattern.firstMatch(in: value, range: range),
              let numStr = substring(of: value, range: match.range(at: 1)),
              let num = Int(numStr) else { return nil }

        let unit = substring(of: value, range: match.range(at: 2))?.lowercased() ?? "s"
        if unit.hasPrefix("m") {
            return num * 60
        }
        return num
    }
}
