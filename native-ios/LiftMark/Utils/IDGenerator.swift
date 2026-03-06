import Foundation

enum IDGenerator {
    /// Generate a UUID string, matching the expo-crypto generateId() pattern
    static func generate() -> String {
        UUID().uuidString
    }
}
