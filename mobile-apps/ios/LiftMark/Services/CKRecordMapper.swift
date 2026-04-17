import CloudKit
import GRDB

/// Handles conversion between GRDB row types and CKRecords, plus merging incoming
/// CKRecords into the local database. Extracted from CloudKitService to support the
/// CKSyncEngine migration.
final class CKRecordMapper {
    private let dbManager: DatabaseManager

    init(dbManager: DatabaseManager = .shared) {
        self.dbManager = dbManager
    }

    // MARK: - Date Helpers

    private let isoFormatter: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()

    private let isoFormatterNoFrac: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        return f
    }()

    private func parseDate(_ str: String?) -> Date? {
        guard let str else { return nil }
        return isoFormatter.date(from: str) ?? isoFormatterNoFrac.date(from: str)
    }

    private func dateToISO(_ date: Date?) -> String? {
        guard let date else { return nil }
        return isoFormatter.string(from: date)
    }

    // MARK: - CKRecord Field Extractors

    private func stringField(_ record: CKRecord, _ key: String) -> String? {
        record[key] as? String
    }

    private func int64Field(_ record: CKRecord, _ key: String) -> Int64? {
        record[key] as? Int64
    }

    private func doubleField(_ record: CKRecord, _ key: String) -> Double? {
        record[key] as? Double
    }

    private func dateField(_ record: CKRecord, _ key: String) -> Date? {
        record[key] as? Date
    }

    private func stringListField(_ record: CKRecord, _ key: String) -> [String] {
        record[key] as? [String] ?? []
    }

    private func referenceId(_ record: CKRecord, _ key: String) -> String? {
        if let ref = record[key] as? CKRecord.Reference {
            return ref.recordID.recordName
        }
        return record[key] as? String
    }

    /// Returns true if the given CKRecord's updatedAt is newer than the local record's updatedAt.
    /// Used by conflict resolution to decide whether server or local wins.
    /// Returns true if remote is newer or timestamps are equal (server wins tiebreaker).
    func serverRecordIsNewer(_ record: CKRecord) -> Bool {
        do {
            let dbQueue = try dbManager.database()
            return try dbQueue.read { db in
                let recordName = record.recordID.recordName
                let remoteDate = self.dateField(record, "updatedAt")

                // Look up the local updatedAt based on record type
                let localUpdatedAt: String? = try {
                    switch record.recordType {
                    case "Gym":
                        return try GymRow.fetchOne(db, key: recordName)?.updatedAt
                    case "GymEquipment":
                        return try GymEquipmentRow.fetchOne(db, key: recordName)?.updatedAt
                    case "WorkoutPlan":
                        return try WorkoutPlanRow.fetchOne(db, key: recordName)?.updatedAt
                    case "PlannedExercise":
                        return try PlannedExerciseRow.fetchOne(db, key: recordName)?.updatedAt
                    case "PlannedSet":
                        return try PlannedSetRow.fetchOne(db, key: recordName)?.updatedAt
                    case "WorkoutSession":
                        return try WorkoutSessionRow.fetchOne(db, key: recordName)?.updatedAt
                    case "SessionExercise":
                        return try SessionExerciseRow.fetchOne(db, key: recordName)?.updatedAt
                    case "SessionSet":
                        return try SessionSetRow.fetchOne(db, key: recordName)?.updatedAt
                    case "UserSettings":
                        return try UserSettingsRow.fetchOne(db, key: recordName)?.updatedAt
                    case "SetMeasurement":
                        return try SetMeasurementRow.fetchOne(db, key: recordName)?.updatedAt
                    default:
                        return nil
                    }
                }()

                return self.remoteIsNewer(remoteDate: remoteDate, localUpdatedAt: localUpdatedAt)
            }
        } catch {
            // If we can't read the local DB, default to server wins
            Logger.shared.error(.sync, "Failed to read local record for conflict check: \(error.localizedDescription)")
            return true
        }
    }

    /// Returns true if remote updatedAt is newer than local updatedAt.
    private func remoteIsNewer(remoteDate: Date?, localUpdatedAt: String?) -> Bool {
        guard let remoteDate else { return false }
        guard let localStr = localUpdatedAt, let localDate = parseDate(localStr) else { return true }
        return remoteDate > localDate
    }

    // MARK: - Reference Helper

    private func makeReference(recordName: String, zoneID: CKRecordZone.ID) -> CKRecord.Reference {
        let id = CKRecord.ID(recordName: recordName, zoneID: zoneID)
        return CKRecord.Reference(recordID: id, action: .none)
    }

    // MARK: - To CKRecord

    func toCKRecord(_ gym: GymRow, zoneID: CKRecordZone.ID) -> CKRecord {
        let recordID = CKRecord.ID(recordName: gym.id, zoneID: zoneID)
        let record = CKRecord(recordType: "Gym", recordID: recordID)
        record["name"] = gym.name as CKRecordValue
        record["isDefault"] = Int64(gym.isDefault) as CKRecordValue
        if let d = parseDate(gym.createdAt) { record["createdAt"] = d as CKRecordValue }
        if let d = parseDate(gym.updatedAt) { record["updatedAt"] = d as CKRecordValue }
        return record
    }

    func toCKRecord(_ eq: GymEquipmentRow, zoneID: CKRecordZone.ID) -> CKRecord {
        let recordID = CKRecord.ID(recordName: eq.id, zoneID: zoneID)
        let record = CKRecord(recordType: "GymEquipment", recordID: recordID)
        record["name"] = eq.name as CKRecordValue
        record["isAvailable"] = Int64(eq.isAvailable) as CKRecordValue
        if let gymId = eq.gymId {
            record["gymId"] = makeReference(recordName: gymId, zoneID: zoneID) as CKRecordValue
        }
        if let d = parseDate(eq.lastCheckedAt) { record["lastCheckedAt"] = d as CKRecordValue }
        if let d = parseDate(eq.createdAt) { record["createdAt"] = d as CKRecordValue }
        if let d = parseDate(eq.updatedAt) { record["updatedAt"] = d as CKRecordValue }
        return record
    }

    func toCKRecord(_ plan: WorkoutPlanRow, zoneID: CKRecordZone.ID) -> CKRecord {
        let recordID = CKRecord.ID(recordName: plan.id, zoneID: zoneID)
        let record = CKRecord(recordType: "WorkoutPlan", recordID: recordID)
        record["name"] = plan.name as CKRecordValue
        record["isFavorite"] = Int64(plan.isFavorite) as CKRecordValue
        if let d = plan.description { record["planDescription"] = d as CKRecordValue }
        if let t = plan.tags { record["tags"] = t as CKRecordValue }
        if let u = plan.defaultWeightUnit { record["defaultWeightUnit"] = u as CKRecordValue }
        if let m = plan.sourceMarkdown { record["sourceMarkdown"] = m as CKRecordValue }
        if let d = parseDate(plan.createdAt) { record["createdAt"] = d as CKRecordValue }
        if let d = parseDate(plan.updatedAt) { record["updatedAt"] = d as CKRecordValue }
        return record
    }

    func toCKRecord(_ ex: PlannedExerciseRow, zoneID: CKRecordZone.ID) -> CKRecord {
        let recordID = CKRecord.ID(recordName: ex.id, zoneID: zoneID)
        let record = CKRecord(recordType: "PlannedExercise", recordID: recordID)
        record["workoutPlanId"] = makeReference(recordName: ex.workoutTemplateId, zoneID: zoneID) as CKRecordValue
        record["exerciseName"] = ex.exerciseName as CKRecordValue
        record["orderIndex"] = Int64(ex.orderIndex) as CKRecordValue
        if let n = ex.notes { record["notes"] = n as CKRecordValue }
        if let e = ex.equipmentType { record["equipmentType"] = e as CKRecordValue }
        if let g = ex.groupType { record["groupType"] = g as CKRecordValue }
        if let g = ex.groupName { record["groupName"] = g as CKRecordValue }
        if let p = ex.parentExerciseId {
            record["parentExerciseId"] = makeReference(recordName: p, zoneID: zoneID) as CKRecordValue
        }
        if let d = parseDate(ex.updatedAt) { record["updatedAt"] = d as CKRecordValue }
        return record
    }

    func toCKRecord(_ ps: PlannedSetRow, measurements: [SetMeasurementRow] = [], zoneID: CKRecordZone.ID) -> CKRecord {
        let recordID = CKRecord.ID(recordName: ps.id, zoneID: zoneID)
        let record = CKRecord(recordType: "PlannedSet", recordID: recordID)
        record["plannedExerciseId"] = makeReference(recordName: ps.templateExerciseId, zoneID: zoneID) as CKRecordValue
        record["orderIndex"] = Int64(ps.orderIndex) as CKRecordValue
        var attrs: [String] = []
        if ps.isDropset != 0 { attrs.append("dropset") }
        if ps.isPerSide != 0 { attrs.append("perSide") }
        if ps.isAmrap != 0 { attrs.append("amrap") }
        if !attrs.isEmpty { record["attributes"] = attrs as CKRecordValue }

        // Write target fields from measurements (dual-write for backward compat with old devices)
        let targets = measurements.filter { $0.role == "target" && $0.groupIndex == 0 }
        for m in targets {
            switch m.kind {
            case "weight":
                record["targetWeight"] = m.value as CKRecordValue
                if let u = m.unit { record["targetWeightUnit"] = u as CKRecordValue }
            case "reps":
                record["targetReps"] = Int64(m.value) as CKRecordValue
            case "time":
                record["targetTime"] = Int64(m.value) as CKRecordValue
            case "distance":
                record["targetDistance"] = m.value as CKRecordValue
                if let u = m.unit { record["targetDistanceUnit"] = u as CKRecordValue }
            case "rpe":
                record["targetRpe"] = m.value as CKRecordValue
            default: break
            }
        }

        if let r = ps.restSeconds { record["restSeconds"] = Int64(r) as CKRecordValue }
        if let n = ps.notes { record["notes"] = n as CKRecordValue }
        if let d = parseDate(ps.updatedAt) { record["updatedAt"] = d as CKRecordValue }
        return record
    }

    func toCKRecord(_ session: WorkoutSessionRow, zoneID: CKRecordZone.ID) -> CKRecord {
        let recordID = CKRecord.ID(recordName: session.id, zoneID: zoneID)
        let record = CKRecord(recordType: "WorkoutSession", recordID: recordID)
        record["name"] = session.name as CKRecordValue
        record["date"] = session.date as CKRecordValue
        record["status"] = session.status as CKRecordValue
        if let pid = session.workoutTemplateId { record["workoutPlanId"] = pid as CKRecordValue }
        if let d = parseDate(session.startTime) { record["startTime"] = d as CKRecordValue }
        if let d = parseDate(session.endTime) { record["endTime"] = d as CKRecordValue }
        if let dur = session.duration { record["duration"] = Int64(dur) as CKRecordValue }
        if let n = session.notes { record["notes"] = n as CKRecordValue }
        if let d = parseDate(session.updatedAt) { record["updatedAt"] = d as CKRecordValue }
        return record
    }

    func toCKRecord(_ se: SessionExerciseRow, zoneID: CKRecordZone.ID) -> CKRecord {
        let recordID = CKRecord.ID(recordName: se.id, zoneID: zoneID)
        let record = CKRecord(recordType: "SessionExercise", recordID: recordID)
        record["workoutSessionId"] = makeReference(recordName: se.workoutSessionId, zoneID: zoneID) as CKRecordValue
        record["exerciseName"] = se.exerciseName as CKRecordValue
        record["orderIndex"] = Int64(se.orderIndex) as CKRecordValue
        record["status"] = se.status as CKRecordValue
        if let n = se.notes { record["notes"] = n as CKRecordValue }
        if let e = se.equipmentType { record["equipmentType"] = e as CKRecordValue }
        if let g = se.groupType { record["groupType"] = g as CKRecordValue }
        if let g = se.groupName { record["groupName"] = g as CKRecordValue }
        if let p = se.parentExerciseId {
            record["parentExerciseId"] = makeReference(recordName: p, zoneID: zoneID) as CKRecordValue
        }
        if let d = parseDate(se.updatedAt) { record["updatedAt"] = d as CKRecordValue }
        return record
    }

    func toCKRecord(_ ss: SessionSetRow, measurements: [SetMeasurementRow] = [], zoneID: CKRecordZone.ID) -> CKRecord {
        let recordID = CKRecord.ID(recordName: ss.id, zoneID: zoneID)
        let record = CKRecord(recordType: "SessionSet", recordID: recordID)
        record["sessionExerciseId"] = makeReference(recordName: ss.sessionExerciseId, zoneID: zoneID) as CKRecordValue
        record["orderIndex"] = Int64(ss.orderIndex) as CKRecordValue
        record["status"] = ss.status as CKRecordValue

        // Attributes
        var attrs: [String] = []
        if ss.isDropset != 0 { attrs.append("dropset") }
        if ss.isPerSide != 0 { attrs.append("perSide") }
        if ss.isAmrap != 0 { attrs.append("amrap") }
        if !attrs.isEmpty { record["attributes"] = attrs as CKRecordValue }

        // Write target/actual fields from measurements (dual-write for backward compat)
        let groupZero = measurements.filter { $0.groupIndex == 0 }
        for m in groupZero {
            let prefix = m.role == "target" ? "target" : "actual"
            switch m.kind {
            case "weight":
                record["\(prefix)Weight"] = m.value as CKRecordValue
                if let u = m.unit { record["\(prefix)WeightUnit"] = u as CKRecordValue }
            case "reps":
                record["\(prefix)Reps"] = Int64(m.value) as CKRecordValue
            case "time":
                record["\(prefix)Time"] = Int64(m.value) as CKRecordValue
            case "distance":
                record["\(prefix)Distance"] = m.value as CKRecordValue
                if let u = m.unit { record["\(prefix)DistanceUnit"] = u as CKRecordValue }
            case "rpe":
                record["\(prefix)Rpe"] = m.value as CKRecordValue
            default: break
            }
        }

        setOptionalInt(on: record, key: "restSeconds", value: ss.restSeconds)
        setOptionalString(on: record, key: "notes", value: ss.notes)
        setOptionalString(on: record, key: "side", value: ss.side)
        setOptionalDate(on: record, key: "completedAt", isoString: ss.completedAt)
        setOptionalDate(on: record, key: "updatedAt", isoString: ss.updatedAt)
        return record
    }

    private func setOptionalString(on record: CKRecord, key: String, value: String?) {
        if let v = value { record[key] = v as CKRecordValue }
    }

    private func setOptionalInt(on record: CKRecord, key: String, value: Int?) {
        if let v = value { record[key] = Int64(v) as CKRecordValue }
    }

    private func setOptionalDouble(on record: CKRecord, key: String, value: Double?) {
        if let v = value { record[key] = v as CKRecordValue }
    }

    private func setOptionalDate(on record: CKRecord, key: String, isoString: String?) {
        if let d = parseDate(isoString) { record[key] = d as CKRecordValue }
    }

    func toCKRecord(_ m: SetMeasurementRow, zoneID: CKRecordZone.ID) -> CKRecord {
        let recordID = CKRecord.ID(recordName: m.id, zoneID: zoneID)
        let record = CKRecord(recordType: "SetMeasurement", recordID: recordID)
        record["setId"] = makeReference(recordName: m.setId, zoneID: zoneID) as CKRecordValue
        record["parentType"] = m.parentType as CKRecordValue
        record["role"] = m.role as CKRecordValue
        record["kind"] = m.kind as CKRecordValue
        record["value"] = m.value as CKRecordValue
        if let u = m.unit { record["unit"] = u as CKRecordValue }
        record["groupIndex"] = Int64(m.groupIndex) as CKRecordValue
        if let d = parseDate(m.updatedAt) { record["updatedAt"] = d as CKRecordValue }
        return record
    }

    func toCKRecord(_ s: UserSettingsRow, zoneID: CKRecordZone.ID) -> CKRecord {
        let recordID = CKRecord.ID(recordName: "user-settings", zoneID: zoneID)
        let record = CKRecord(recordType: "UserSettings", recordID: recordID)
        record["defaultWeightUnit"] = s.defaultWeightUnit as CKRecordValue
        record["enableWorkoutTimer"] = Int64(s.enableWorkoutTimer) as CKRecordValue
        record["autoStartRestTimer"] = Int64(s.autoStartRestTimer) as CKRecordValue
        record["theme"] = s.theme as CKRecordValue
        record["notificationsEnabled"] = Int64(s.notificationsEnabled) as CKRecordValue
        record["healthKitEnabled"] = Int64(s.healthkitEnabled) as CKRecordValue
        record["liveActivitiesEnabled"] = Int64(s.liveActivitiesEnabled) as CKRecordValue
        record["keepScreenAwake"] = Int64(s.keepScreenAwake) as CKRecordValue
        record["showOpenInClaudeButton"] = Int64(s.showOpenInClaudeButton) as CKRecordValue
        record["countdownSoundsEnabled"] = Int64(s.countdownSoundsEnabled) as CKRecordValue
        if let c = s.customPromptAddition { record["customPromptAddition"] = c as CKRecordValue }
        if let h = s.homeTiles { record["homeTiles"] = h as CKRecordValue }
        if let d = parseDate(s.updatedAt) { record["updatedAt"] = d as CKRecordValue }
        // Never sync anthropicApiKey
        return record
    }

    // MARK: - Merge Incoming

    /// Routes an incoming CKRecord to the appropriate merge method. Returns true if local DB was updated.
    func mergeIncoming(_ record: CKRecord) throws -> Bool {
        let dbQueue = try dbManager.database()

        switch record.recordType {
        case "Gym":
            return try mergeGym(record, dbQueue: dbQueue)
        case "GymEquipment":
            return try mergeGymEquipment(record, dbQueue: dbQueue)
        case "WorkoutPlan":
            return try mergeWorkoutPlan(record, dbQueue: dbQueue)
        case "PlannedExercise":
            return try mergePlannedExercise(record, dbQueue: dbQueue)
        case "PlannedSet":
            return try mergePlannedSet(record, dbQueue: dbQueue)
        case "WorkoutSession":
            return try mergeWorkoutSession(record, dbQueue: dbQueue)
        case "SessionExercise":
            return try mergeSessionExercise(record, dbQueue: dbQueue)
        case "SessionSet":
            return try mergeSessionSet(record, dbQueue: dbQueue)
        case "UserSettings":
            return try mergeUserSettings(record, dbQueue: dbQueue)
        case "SetMeasurement":
            return try mergeSetMeasurement(record, dbQueue: dbQueue)
        default:
            Logger.shared.warn(.sync, "Unknown record type for merge: \(record.recordType)")
            return false
        }
    }

    // MARK: - Individual Merge Methods

    private func mergeGym(_ record: CKRecord, dbQueue: DatabaseQueue) throws -> Bool {
        let remoteUpdatedAt = dateField(record, "updatedAt")
        return try dbQueue.write { db in
            let existing = try GymRow.fetchOne(db, key: record.recordID.recordName)

            // Don't re-insert a gym that was soft-deleted locally
            if let existing, existing.deletedAt != nil {
                return false
            }

            if let existing, !self.remoteIsNewer(remoteDate: remoteUpdatedAt, localUpdatedAt: existing.updatedAt) {
                return false
            }
            let row = GymRow(
                id: record.recordID.recordName,
                name: self.stringField(record, "name") ?? "Gym",
                isDefault: Int(self.int64Field(record, "isDefault") ?? 0),
                deletedAt: nil,
                createdAt: self.dateToISO(self.dateField(record, "createdAt")) ?? existing?.createdAt ?? self.isoFormatter.string(from: Date()),
                updatedAt: self.dateToISO(remoteUpdatedAt) ?? existing?.updatedAt ?? self.isoFormatter.string(from: Date())
            )
            if existing != nil { try row.update(db) } else { try row.insert(db) }
            return true
        }
    }

    private func mergeGymEquipment(_ record: CKRecord, dbQueue: DatabaseQueue) throws -> Bool {
        let remoteUpdatedAt = dateField(record, "updatedAt")
        return try dbQueue.write { db in
            let existing = try GymEquipmentRow.fetchOne(db, key: record.recordID.recordName)

            // Don't re-insert equipment that was soft-deleted locally
            if let existing, existing.deletedAt != nil {
                return false
            }

            if let existing, !self.remoteIsNewer(remoteDate: remoteUpdatedAt, localUpdatedAt: existing.updatedAt) {
                return false
            }
            let row = GymEquipmentRow(
                id: record.recordID.recordName,
                name: self.stringField(record, "name") ?? "Equipment",
                isAvailable: Int(self.int64Field(record, "isAvailable") ?? 1),
                lastCheckedAt: self.dateToISO(self.dateField(record, "lastCheckedAt")),
                deletedAt: nil,
                createdAt: self.dateToISO(self.dateField(record, "createdAt")) ?? existing?.createdAt ?? self.isoFormatter.string(from: Date()),
                updatedAt: self.dateToISO(remoteUpdatedAt) ?? existing?.updatedAt ?? self.isoFormatter.string(from: Date()),
                gymId: self.referenceId(record, "gymId")
            )
            if existing != nil { try row.update(db) } else { try row.insert(db) }
            return true
        }
    }

    private func mergeWorkoutPlan(_ record: CKRecord, dbQueue: DatabaseQueue) throws -> Bool {
        let remoteUpdatedAt = dateField(record, "updatedAt")
        return try dbQueue.write { db in
            let existing = try WorkoutPlanRow.fetchOne(db, key: record.recordID.recordName)
            if let existing, !self.remoteIsNewer(remoteDate: remoteUpdatedAt, localUpdatedAt: existing.updatedAt) {
                return false
            }
            let row = WorkoutPlanRow(
                id: record.recordID.recordName,
                name: self.stringField(record, "name") ?? "Workout",
                description: self.stringField(record, "planDescription"),
                tags: self.stringField(record, "tags"),
                defaultWeightUnit: self.stringField(record, "defaultWeightUnit"),
                sourceMarkdown: self.stringField(record, "sourceMarkdown"),
                createdAt: self.dateToISO(self.dateField(record, "createdAt")) ?? existing?.createdAt ?? self.isoFormatter.string(from: Date()),
                updatedAt: self.dateToISO(remoteUpdatedAt) ?? existing?.updatedAt ?? self.isoFormatter.string(from: Date()),
                isFavorite: Int(self.int64Field(record, "isFavorite") ?? 0)
            )
            if existing != nil { try row.update(db) } else { try row.insert(db) }
            return true
        }
    }

    private func mergePlannedExercise(_ record: CKRecord, dbQueue: DatabaseQueue) throws -> Bool {
        let remoteUpdatedAt = dateField(record, "updatedAt")
        return try dbQueue.write { db in
            let existing = try PlannedExerciseRow.fetchOne(db, key: record.recordID.recordName)
            let fk = self.referenceId(record, "workoutPlanId") ?? existing?.workoutTemplateId ?? ""
            if fk.isEmpty && existing == nil {
                Logger.shared.error(.sync, "[sync-merge] Skipping PlannedExercise \(record.recordID.recordName): missing workoutPlanId FK")
                return false
            }

            if let existing, !self.remoteIsNewer(remoteDate: remoteUpdatedAt, localUpdatedAt: existing.updatedAt) {
                return false
            }

            let row = PlannedExerciseRow(
                id: record.recordID.recordName,
                workoutTemplateId: fk,
                exerciseName: self.stringField(record, "exerciseName") ?? existing?.exerciseName ?? "",
                orderIndex: Int(self.int64Field(record, "orderIndex") ?? Int64(existing?.orderIndex ?? 0)),
                notes: self.stringField(record, "notes"),
                equipmentType: self.stringField(record, "equipmentType"),
                groupType: self.stringField(record, "groupType"),
                groupName: self.stringField(record, "groupName"),
                parentExerciseId: self.referenceId(record, "parentExerciseId"),
                updatedAt: self.dateToISO(remoteUpdatedAt) ?? existing?.updatedAt
            )
            if existing != nil {
                try row.update(db)
            } else {
                let duplicate = try PlannedExerciseRow
                    .filter(Column("workout_template_id") == row.workoutTemplateId)
                    .filter(Column("exercise_name") == row.exerciseName)
                    .filter(Column("order_index") == row.orderIndex)
                    .fetchOne(db)
                if duplicate != nil {
                    Logger.shared.warn(.sync, "Skipping duplicate exercise: \(row.exerciseName) at index \(row.orderIndex)")
                    return false
                }
                try row.insert(db)
            }
            return true
        }
    }

    private func mergePlannedSet(_ record: CKRecord, dbQueue: DatabaseQueue) throws -> Bool {
        let remoteUpdatedAt = dateField(record, "updatedAt")
        return try dbQueue.write { db in
            let setId = record.recordID.recordName
            let existing = try PlannedSetRow.fetchOne(db, key: setId)
            let fk = self.referenceId(record, "plannedExerciseId") ?? existing?.templateExerciseId ?? ""
            if fk.isEmpty && existing == nil {
                Logger.shared.error(.sync, "[sync-merge] Skipping PlannedSet \(setId): missing plannedExerciseId FK")
                return false
            }

            if let existing, !self.remoteIsNewer(remoteDate: remoteUpdatedAt, localUpdatedAt: existing.updatedAt) {
                return false
            }

            let attrs = self.stringListField(record, "attributes")
            let now = self.dateToISO(remoteUpdatedAt) ?? existing?.updatedAt
            let row = PlannedSetRow(
                id: setId,
                templateExerciseId: fk,
                orderIndex: Int(self.int64Field(record, "orderIndex") ?? Int64(existing?.orderIndex ?? 0)),
                restSeconds: self.int64Field(record, "restSeconds").map { Int($0) },
                isDropset: attrs.contains("dropset") ? 1 : 0,
                isPerSide: attrs.contains("perSide") ? 1 : 0,
                isAmrap: attrs.contains("amrap") ? 1 : 0,
                notes: self.stringField(record, "notes"),
                updatedAt: now
            )
            if existing != nil {
                try row.update(db)
            } else {
                let duplicate = try PlannedSetRow
                    .filter(Column("template_exercise_id") == row.templateExerciseId)
                    .filter(Column("order_index") == row.orderIndex)
                    .fetchOne(db)
                if duplicate != nil {
                    Logger.shared.warn(.sync, "Skipping duplicate set at index \(row.orderIndex)")
                    return false
                }
                try row.insert(db)
            }

            // Replace measurements from CK record fields (dual-read: old-format CKRecords)
            try db.execute(sql: "DELETE FROM set_measurements WHERE set_id = ? AND parent_type = 'planned'", arguments: [setId])
            try self.insertMeasurementsFromCKRecord(record, setId: setId, parentType: "planned", role: "target", now: now, in: db)

            return true
        }
    }

    private func mergeWorkoutSession(_ record: CKRecord, dbQueue: DatabaseQueue) throws -> Bool {
        let remoteUpdatedAt = dateField(record, "updatedAt")
        return try dbQueue.write { db in
            let existing = try WorkoutSessionRow.fetchOne(db, key: record.recordID.recordName)

            if let existing, !self.remoteIsNewer(remoteDate: remoteUpdatedAt, localUpdatedAt: existing.updatedAt) {
                return false
            }

            // Don't let remote data overwrite a local cancellation
            let remoteStatus = self.stringField(record, "status")
            let mergedStatus: String
            if existing?.status == SessionStatus.canceled.rawValue {
                mergedStatus = SessionStatus.canceled.rawValue
            } else {
                mergedStatus = remoteStatus ?? existing?.status ?? SessionStatus.inProgress.rawValue
            }

            let row = WorkoutSessionRow(
                id: record.recordID.recordName,
                workoutTemplateId: self.stringField(record, "workoutPlanId"),
                name: self.stringField(record, "name") ?? existing?.name ?? "Workout",
                date: self.stringField(record, "date") ?? existing?.date ?? "",
                startTime: self.dateToISO(self.dateField(record, "startTime")),
                endTime: self.dateToISO(self.dateField(record, "endTime")),
                duration: self.int64Field(record, "duration").map { Int($0) },
                notes: self.stringField(record, "notes"),
                status: mergedStatus,
                updatedAt: self.dateToISO(remoteUpdatedAt) ?? existing?.updatedAt
            )
            if existing != nil { try row.update(db) } else { try row.insert(db) }
            return true
        }
    }

    private func mergeSessionExercise(_ record: CKRecord, dbQueue: DatabaseQueue) throws -> Bool {
        let remoteUpdatedAt = dateField(record, "updatedAt")
        return try dbQueue.write { db in
            let existing = try SessionExerciseRow.fetchOne(db, key: record.recordID.recordName)
            let fk = self.referenceId(record, "workoutSessionId") ?? existing?.workoutSessionId ?? ""
            if fk.isEmpty && existing == nil {
                Logger.shared.error(.sync, "[sync-merge] Skipping SessionExercise \(record.recordID.recordName): missing workoutSessionId FK")
                return false
            }

            if let existing, !self.remoteIsNewer(remoteDate: remoteUpdatedAt, localUpdatedAt: existing.updatedAt) {
                return false
            }

            let row = SessionExerciseRow(
                id: record.recordID.recordName,
                workoutSessionId: fk,
                exerciseName: self.stringField(record, "exerciseName") ?? existing?.exerciseName ?? "",
                orderIndex: Int(self.int64Field(record, "orderIndex") ?? Int64(existing?.orderIndex ?? 0)),
                notes: self.stringField(record, "notes"),
                equipmentType: self.stringField(record, "equipmentType"),
                groupType: self.stringField(record, "groupType"),
                groupName: self.stringField(record, "groupName"),
                parentExerciseId: self.referenceId(record, "parentExerciseId"),
                status: self.stringField(record, "status") ?? existing?.status ?? ExerciseStatus.pending.rawValue,
                updatedAt: self.dateToISO(remoteUpdatedAt) ?? existing?.updatedAt
            )
            if existing != nil { try row.update(db) } else { try row.insert(db) }
            return true
        }
    }

    private func mergeSessionSet(_ record: CKRecord, dbQueue: DatabaseQueue) throws -> Bool {
        let remoteUpdatedAt = dateField(record, "updatedAt")
        return try dbQueue.write { db in
            let setId = record.recordID.recordName
            let existing = try SessionSetRow.fetchOne(db, key: setId)
            let fk = self.referenceId(record, "sessionExerciseId") ?? existing?.sessionExerciseId ?? ""
            if fk.isEmpty && existing == nil {
                Logger.shared.error(.sync, "[sync-merge] Skipping SessionSet \(setId): missing sessionExerciseId FK")
                return false
            }

            if let existing, !self.remoteIsNewer(remoteDate: remoteUpdatedAt, localUpdatedAt: existing.updatedAt) {
                return false
            }

            let attrs = self.stringListField(record, "attributes")
            let now = self.dateToISO(remoteUpdatedAt) ?? existing?.updatedAt
            let row = SessionSetRow(
                id: setId,
                sessionExerciseId: fk,
                orderIndex: Int(self.int64Field(record, "orderIndex") ?? Int64(existing?.orderIndex ?? 0)),
                restSeconds: self.int64Field(record, "restSeconds").map { Int($0) },
                completedAt: self.dateToISO(self.dateField(record, "completedAt")),
                status: self.stringField(record, "status") ?? existing?.status ?? SetStatus.pending.rawValue,
                notes: self.stringField(record, "notes"),
                isDropset: attrs.contains("dropset") ? 1 : 0,
                isPerSide: attrs.contains("perSide") ? 1 : 0,
                isAmrap: attrs.contains("amrap") ? 1 : 0,
                side: self.stringField(record, "side"),
                updatedAt: now
            )
            if existing != nil { try row.update(db) } else { try row.insert(db) }

            // Replace measurements from CK record fields (dual-read: old-format CKRecords)
            try db.execute(sql: "DELETE FROM set_measurements WHERE set_id = ? AND parent_type = 'session'", arguments: [setId])
            try self.insertMeasurementsFromCKRecord(record, setId: setId, parentType: "session", role: "target", now: now, in: db)
            try self.insertMeasurementsFromCKRecord(record, setId: setId, parentType: "session", role: "actual", now: now, in: db)

            return true
        }
    }

    /// Extract measurement fields from a CKRecord and insert into set_measurements.
    /// Handles old-format CKRecords that store target/actual fields directly on the set record.
    private func insertMeasurementsFromCKRecord(
        _ record: CKRecord,
        setId: String,
        parentType: String,
        role: String,
        now: String?,
        in db: Database
    ) throws {
        let prefix = role == "target" ? "target" : "actual"

        if let w = doubleField(record, "\(prefix)Weight") {
            let unit = stringField(record, "\(prefix)WeightUnit")
            let mRow = SetMeasurementRow(
                id: IDGenerator.generate(), setId: setId, parentType: parentType,
                role: role, kind: "weight", value: w, unit: unit,
                groupIndex: 0, updatedAt: now
            )
            try mRow.insert(db)
        }
        if let r = int64Field(record, "\(prefix)Reps") {
            let mRow = SetMeasurementRow(
                id: IDGenerator.generate(), setId: setId, parentType: parentType,
                role: role, kind: "reps", value: Double(r), unit: nil,
                groupIndex: 0, updatedAt: now
            )
            try mRow.insert(db)
        }
        if let t = int64Field(record, "\(prefix)Time") {
            let mRow = SetMeasurementRow(
                id: IDGenerator.generate(), setId: setId, parentType: parentType,
                role: role, kind: "time", value: Double(t), unit: "s",
                groupIndex: 0, updatedAt: now
            )
            try mRow.insert(db)
        }
        if let d = doubleField(record, "\(prefix)Distance") {
            let unit = stringField(record, "\(prefix)DistanceUnit")
            let mRow = SetMeasurementRow(
                id: IDGenerator.generate(), setId: setId, parentType: parentType,
                role: role, kind: "distance", value: d, unit: unit,
                groupIndex: 0, updatedAt: now
            )
            try mRow.insert(db)
        }
        if let rpe = doubleField(record, "\(prefix)Rpe") {
            let mRow = SetMeasurementRow(
                id: IDGenerator.generate(), setId: setId, parentType: parentType,
                role: role, kind: "rpe", value: rpe, unit: nil,
                groupIndex: 0, updatedAt: now
            )
            try mRow.insert(db)
        } else if let rpe = int64Field(record, "\(prefix)Rpe") {
            let mRow = SetMeasurementRow(
                id: IDGenerator.generate(), setId: setId, parentType: parentType,
                role: role, kind: "rpe", value: Double(rpe), unit: nil,
                groupIndex: 0, updatedAt: now
            )
            try mRow.insert(db)
        }
    }

    private func mergeUserSettings(_ record: CKRecord, dbQueue: DatabaseQueue) throws -> Bool {
        let remoteUpdatedAt = dateField(record, "updatedAt")
        return try dbQueue.write { db in
            let existing = try UserSettingsRow.fetchOne(db)
            if let existing, !self.remoteIsNewer(remoteDate: remoteUpdatedAt, localUpdatedAt: existing.updatedAt) {
                return false
            }
            if let existing {
                let updatedAt = self.dateToISO(remoteUpdatedAt) ?? existing.updatedAt
                let row = UserSettingsRow(
                    id: existing.id,
                    defaultWeightUnit: self.stringField(record, "defaultWeightUnit") ?? existing.defaultWeightUnit,
                    enableWorkoutTimer: Int(self.int64Field(record, "enableWorkoutTimer") ?? Int64(existing.enableWorkoutTimer)),
                    autoStartRestTimer: Int(self.int64Field(record, "autoStartRestTimer") ?? Int64(existing.autoStartRestTimer)),
                    theme: self.stringField(record, "theme") ?? existing.theme,
                    notificationsEnabled: Int(self.int64Field(record, "notificationsEnabled") ?? Int64(existing.notificationsEnabled)),
                    customPromptAddition: self.stringField(record, "customPromptAddition") ?? existing.customPromptAddition,
                    anthropicApiKeyStatus: existing.anthropicApiKeyStatus, // Never sync
                    healthkitEnabled: Int(self.int64Field(record, "healthKitEnabled") ?? Int64(existing.healthkitEnabled)),
                    liveActivitiesEnabled: Int(self.int64Field(record, "liveActivitiesEnabled") ?? Int64(existing.liveActivitiesEnabled)),
                    keepScreenAwake: Int(self.int64Field(record, "keepScreenAwake") ?? Int64(existing.keepScreenAwake)),
                    showOpenInClaudeButton: Int(self.int64Field(record, "showOpenInClaudeButton") ?? Int64(existing.showOpenInClaudeButton)),
                    developerModeEnabled: existing.developerModeEnabled,
                    countdownSoundsEnabled: Int(self.int64Field(record, "countdownSoundsEnabled") ?? Int64(existing.countdownSoundsEnabled)),
                    hasAcceptedDisclaimer: existing.hasAcceptedDisclaimer, // Never sync — local-only
                    homeTiles: self.stringField(record, "homeTiles") ?? existing.homeTiles,
                    createdAt: existing.createdAt,
                    updatedAt: updatedAt
                )
                try row.update(db)
                return true
            } else {
                let now = self.isoFormatter.string(from: Date())
                let row = UserSettingsRow(
                    id: IDGenerator.generate(),
                    defaultWeightUnit: self.stringField(record, "defaultWeightUnit") ?? "lbs",
                    enableWorkoutTimer: Int(self.int64Field(record, "enableWorkoutTimer") ?? 1),
                    autoStartRestTimer: Int(self.int64Field(record, "autoStartRestTimer") ?? 1),
                    theme: self.stringField(record, "theme") ?? "auto",
                    notificationsEnabled: Int(self.int64Field(record, "notificationsEnabled") ?? 1),
                    customPromptAddition: self.stringField(record, "customPromptAddition"),
                    anthropicApiKeyStatus: "not_set",
                    healthkitEnabled: Int(self.int64Field(record, "healthKitEnabled") ?? 0),
                    liveActivitiesEnabled: Int(self.int64Field(record, "liveActivitiesEnabled") ?? 1),
                    keepScreenAwake: Int(self.int64Field(record, "keepScreenAwake") ?? 1),
                    showOpenInClaudeButton: Int(self.int64Field(record, "showOpenInClaudeButton") ?? 0),
                    developerModeEnabled: 0,
                    countdownSoundsEnabled: Int(self.int64Field(record, "countdownSoundsEnabled") ?? 1),
                    hasAcceptedDisclaimer: 0, // New device — must accept again
                    homeTiles: self.stringField(record, "homeTiles"),
                    createdAt: now,
                    updatedAt: self.dateToISO(remoteUpdatedAt) ?? now
                )
                try row.insert(db)
                return true
            }
        }
    }

    private func mergeSetMeasurement(_ record: CKRecord, dbQueue: DatabaseQueue) throws -> Bool {
        let remoteUpdatedAt = dateField(record, "updatedAt")
        return try dbQueue.write { db in
            let measurementId = record.recordID.recordName
            let existing = try SetMeasurementRow.fetchOne(db, key: measurementId)

            if let existing, !self.remoteIsNewer(remoteDate: remoteUpdatedAt, localUpdatedAt: existing.updatedAt) {
                return false
            }

            let setId = self.referenceId(record, "setId") ?? existing?.setId ?? ""
            if setId.isEmpty {
                Logger.shared.error(.sync, "[sync-merge] Skipping SetMeasurement \(measurementId): missing setId FK")
                return false
            }

            // Validate FK: setId must reference an existing session_set or template_set
            let parentType = self.stringField(record, "parentType") ?? existing?.parentType ?? "session"
            let fkTable = parentType == "planned" ? "template_sets" : "session_sets"
            let fkExists = try Row.fetchOne(db, sql: "SELECT 1 FROM \(fkTable) WHERE id = ?", arguments: [setId]) != nil
            if !fkExists && existing == nil {
                Logger.shared.error(.sync, "[sync-merge] Skipping SetMeasurement \(measurementId): setId \(setId) not found in \(fkTable)")
                return false
            }

            let row = SetMeasurementRow(
                id: measurementId,
                setId: setId,
                parentType: parentType,
                role: self.stringField(record, "role") ?? existing?.role ?? "actual",
                kind: self.stringField(record, "kind") ?? existing?.kind ?? "weight",
                value: self.doubleField(record, "value") ?? existing?.value ?? 0,
                unit: self.stringField(record, "unit") ?? existing?.unit,
                groupIndex: self.int64Field(record, "groupIndex").map { Int($0) } ?? existing?.groupIndex ?? 0,
                updatedAt: self.dateToISO(remoteUpdatedAt) ?? existing?.updatedAt
            )
            if existing != nil { try row.update(db) } else { try row.insert(db) }
            return true
        }
    }

    // MARK: - Record Lookup

    /// Create a CKRecord for a local row identified by its record ID.
    /// Scans all entity tables to find the matching row.
    func createCKRecord(for recordID: CKRecord.ID, zoneID: CKRecordZone.ID) -> CKRecord? {
        let id = recordID.recordName
        do {
            let dbQueue = try dbManager.database()
            return try dbQueue.read { db -> CKRecord? in
                if let gym = try GymRow.fetchOne(db, key: id) {
                    if gym.deletedAt != nil { return nil }
                    return self.toCKRecord(gym, zoneID: zoneID)
                }
                if let eq = try GymEquipmentRow.fetchOne(db, key: id) {
                    if eq.deletedAt != nil { return nil }
                    return self.toCKRecord(eq, zoneID: zoneID)
                }
                if let plan = try WorkoutPlanRow.fetchOne(db, key: id) {
                    return self.toCKRecord(plan, zoneID: zoneID)
                }
                if let ex = try PlannedExerciseRow.fetchOne(db, key: id) {
                    return self.toCKRecord(ex, zoneID: zoneID)
                }
                if let ps = try PlannedSetRow.fetchOne(db, key: id) {
                    let measurements = try SetMeasurementRow
                        .filter(Column("set_id") == id)
                        .filter(Column("parent_type") == "planned")
                        .fetchAll(db)
                    return self.toCKRecord(ps, measurements: measurements, zoneID: zoneID)
                }
                if let session = try WorkoutSessionRow.fetchOne(db, key: id) {
                    return self.toCKRecord(session, zoneID: zoneID)
                }
                if let se = try SessionExerciseRow.fetchOne(db, key: id) {
                    return self.toCKRecord(se, zoneID: zoneID)
                }
                if let ss = try SessionSetRow.fetchOne(db, key: id) {
                    let measurements = try SetMeasurementRow
                        .filter(Column("set_id") == id)
                        .filter(Column("parent_type") == "session")
                        .fetchAll(db)
                    return self.toCKRecord(ss, measurements: measurements, zoneID: zoneID)
                }
                if let settings = try UserSettingsRow.fetchOne(db) {
                    if settings.id == id || id == "user-settings" {
                        return self.toCKRecord(settings, zoneID: zoneID)
                    }
                }
                if let measurement = try SetMeasurementRow.fetchOne(db, key: id) {
                    return self.toCKRecord(measurement, zoneID: zoneID)
                }
                return nil
            }
        } catch {
            Logger.shared.error(.sync, "Failed to look up local record for \(id)", error: error)
            return nil
        }
    }

    // MARK: - Local Deletion

    /// Delete a local record by ID, scanning all entity tables.
    func deleteLocalRecord(id: String) throws {
        let dbQueue = try dbManager.database()
        let tables = [
            "gyms", "gym_equipment", "workout_templates", "template_exercises",
            "template_sets", "workout_sessions", "session_exercises", "session_sets",
            "user_settings"
        ]
        try dbQueue.write { db in
            // Clean up measurements if this is a set being deleted (no CASCADE)
            try db.execute(sql: "DELETE FROM set_measurements WHERE set_id = ?", arguments: [id])

            // Also try deleting from set_measurements directly (the deleted record may BE a SetMeasurement)
            try db.execute(sql: "DELETE FROM set_measurements WHERE id = ?", arguments: [id])
            if db.changesCount > 0 { return }

            for table in tables {
                try db.execute(sql: "DELETE FROM \(table) WHERE id = ?", arguments: [id])
                if db.changesCount > 0 { return }
            }
        }
    }

    // MARK: - Active Session Protection

    /// IDs belonging to an in-progress workout session that must not be deleted or overwritten by sync.
    struct ActiveSessionProtectedIds {
        let sessionId: String?
        let exerciseIds: Set<String>
        let setIds: Set<String>
        let planId: String?
        let plannedExerciseIds: Set<String>
        let plannedSetIds: Set<String>

        /// All protected IDs keyed by CloudKit record type.
        var byRecordType: [String: Set<String>] {
            var map: [String: Set<String>] = [:]
            if let sid = sessionId { map["WorkoutSession"] = [sid] }
            if !exerciseIds.isEmpty { map["SessionExercise"] = exerciseIds }
            if !setIds.isEmpty { map["SessionSet"] = setIds }
            if let pid = planId { map["WorkoutPlan"] = [pid] }
            if !plannedExerciseIds.isEmpty { map["PlannedExercise"] = plannedExerciseIds }
            if !plannedSetIds.isEmpty { map["PlannedSet"] = plannedSetIds }
            return map
        }

        static let empty = ActiveSessionProtectedIds(
            sessionId: nil, exerciseIds: [], setIds: [],
            planId: nil, plannedExerciseIds: [], plannedSetIds: []
        )
    }

    /// Query the database for the active (in_progress) session and collect all IDs that belong to it,
    /// including the parent WorkoutPlan's PlannedExercise and PlannedSet records.
    func getActiveSessionProtectedIds() -> ActiveSessionProtectedIds {
        do {
            let dbQueue = try dbManager.database()
            return try dbQueue.read { db in
                guard let sessionRow = try Row.fetchOne(db, sql: "SELECT id, workout_template_id FROM workout_sessions WHERE status = 'in_progress' LIMIT 1"),
                      let sessionId: String = sessionRow["id"] else {
                    return .empty
                }

                let exerciseRows = try Row.fetchAll(db, sql: "SELECT id FROM session_exercises WHERE workout_session_id = ?", arguments: [sessionId])
                let exerciseIds = Set(exerciseRows.compactMap { $0["id"] as String? })

                var setIds = Set<String>()
                if !exerciseIds.isEmpty {
                    let placeholders = exerciseIds.map { _ in "?" }.joined(separator: ",")
                    let setRows = try Row.fetchAll(db, sql: "SELECT id FROM session_sets WHERE session_exercise_id IN (\(placeholders))", arguments: StatementArguments(Array(exerciseIds)))
                    setIds = Set(setRows.compactMap { $0["id"] as String? })
                }

                let planId: String? = sessionRow["workout_template_id"]
                var plannedExerciseIds = Set<String>()
                var plannedSetIds = Set<String>()

                if let planId, !planId.isEmpty {
                    let peRows = try Row.fetchAll(db, sql: "SELECT id FROM template_exercises WHERE workout_template_id = ?", arguments: [planId])
                    plannedExerciseIds = Set(peRows.compactMap { $0["id"] as String? })

                    if !plannedExerciseIds.isEmpty {
                        let pePlaceholders = plannedExerciseIds.map { _ in "?" }.joined(separator: ",")
                        let psRows = try Row.fetchAll(
                            db,
                            sql: "SELECT id FROM template_sets "
                                + "WHERE template_exercise_id IN (\(pePlaceholders))",
                            arguments: StatementArguments(Array(plannedExerciseIds))
                        )
                        plannedSetIds = Set(psRows.compactMap { $0["id"] as String? })
                    }
                }

                return ActiveSessionProtectedIds(
                    sessionId: sessionId, exerciseIds: exerciseIds, setIds: setIds,
                    planId: planId, plannedExerciseIds: plannedExerciseIds, plannedSetIds: plannedSetIds
                )
            }
        } catch {
            Logger.shared.error(.app, "Failed to query active session for sync protection", error: error)
            return .empty
        }
    }
}
