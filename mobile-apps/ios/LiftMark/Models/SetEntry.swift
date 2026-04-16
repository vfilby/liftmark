import Foundation

// MARK: - Measured Value Types

struct MeasuredWeight: Codable, Hashable {
    var value: Double
    var unit: WeightUnit
}

struct MeasuredDistance: Codable, Hashable {
    var value: Double
    var unit: DistanceUnit
}

// MARK: - EntryValues

/// The measurement values for one role (target or actual) within a set entry.
struct EntryValues: Codable, Hashable {
    var weight: MeasuredWeight?
    var reps: Int?
    var time: Int? // seconds
    var distance: MeasuredDistance?
    var rpe: Int?

    var isEmpty: Bool {
        weight == nil && reps == nil && time == nil && distance == nil && rpe == nil
    }
}

// MARK: - SetEntry

/// A single entry within a set, grouping target and actual values together.
/// Normal sets have one entry (groupIndex=0). Drop sets have multiple entries.
struct SetEntry: Codable, Hashable {
    var groupIndex: Int
    var target: EntryValues?
    var actual: EntryValues?
}

// MARK: - Building from SetMeasurementRow

extension SetEntry {
    /// Convert flat measurement rows into structured entries grouped by groupIndex.
    static func buildEntries(from measurements: [SetMeasurementRow]) -> [SetEntry] {
        guard !measurements.isEmpty else { return [] }

        let byGroup = Dictionary(grouping: measurements, by: \.groupIndex)
        return byGroup.keys.sorted().map { groupIndex in
            let group = byGroup[groupIndex]!
            let targets = group.filter { $0.role == "target" }
            let actuals = group.filter { $0.role == "actual" }
            return SetEntry(
                groupIndex: groupIndex,
                target: targets.isEmpty ? nil : EntryValues.from(targets),
                actual: actuals.isEmpty ? nil : EntryValues.from(actuals)
            )
        }
    }
}

// MARK: - EntryValues ↔ SetMeasurementRow conversion

extension EntryValues {
    /// Build EntryValues from a flat array of measurement rows (all same role + groupIndex).
    static func from(_ measurements: [SetMeasurementRow]) -> EntryValues {
        var values = EntryValues()
        for m in measurements {
            switch m.kind {
            case "weight":
                values.weight = MeasuredWeight(
                    value: m.value,
                    unit: m.unit.flatMap { WeightUnit(rawValue: $0) } ?? .lbs
                )
            case "reps":
                values.reps = Int(m.value)
            case "time":
                values.time = Int(m.value)
            case "distance":
                values.distance = MeasuredDistance(
                    value: m.value,
                    unit: m.unit.flatMap { DistanceUnit(rawValue: $0) } ?? .meters
                )
            case "rpe":
                values.rpe = Int(m.value)
            default:
                break
            }
        }
        return values
    }

    /// Convert to flat measurement rows for database persistence.
    func toMeasurementRows(
        setId: String,
        parentType: String,
        role: String,
        groupIndex: Int,
        now: String
    ) -> [SetMeasurementRow] {
        var rows: [SetMeasurementRow] = []
        if let w = weight {
            rows.append(SetMeasurementRow(
                id: IDGenerator.generate(), setId: setId, parentType: parentType,
                role: role, kind: "weight", value: w.value, unit: w.unit.rawValue,
                groupIndex: groupIndex, updatedAt: now
            ))
        }
        if let r = reps {
            rows.append(SetMeasurementRow(
                id: IDGenerator.generate(), setId: setId, parentType: parentType,
                role: role, kind: "reps", value: Double(r), unit: nil,
                groupIndex: groupIndex, updatedAt: now
            ))
        }
        if let t = time {
            rows.append(SetMeasurementRow(
                id: IDGenerator.generate(), setId: setId, parentType: parentType,
                role: role, kind: "time", value: Double(t), unit: "s",
                groupIndex: groupIndex, updatedAt: now
            ))
        }
        if let d = distance {
            rows.append(SetMeasurementRow(
                id: IDGenerator.generate(), setId: setId, parentType: parentType,
                role: role, kind: "distance", value: d.value, unit: d.unit.rawValue,
                groupIndex: groupIndex, updatedAt: now
            ))
        }
        if let r = rpe {
            rows.append(SetMeasurementRow(
                id: IDGenerator.generate(), setId: setId, parentType: parentType,
                role: role, kind: "rpe", value: Double(r), unit: nil,
                groupIndex: groupIndex, updatedAt: now
            ))
        }
        return rows
    }
}
