import Foundation
import Security

// MARK: - SecureStorage

enum SecureStorage {

    private static let serviceName = "com.liftmark.app"
    private static let apiKeyAccount = "anthropic_api_key"

    // MARK: - API Key Validation

    /// Validates Anthropic API key format.
    /// Keys start with "sk-ant-" and have a specific format.
    static func validateAnthropicApiKey(_ apiKey: String) -> Bool {
        let trimmed = apiKey.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return false }

        let pattern = #"^sk-ant-[a-zA-Z0-9_-]{95,}$"#
        return trimmed.range(of: pattern, options: .regularExpression) != nil
    }

    // MARK: - Store

    /// Securely stores the Anthropic API key in the Keychain.
    static func storeApiKey(_ apiKey: String) throws {
        let trimmed = apiKey.trimmingCharacters(in: .whitespacesAndNewlines)
        guard validateAnthropicApiKey(trimmed) else {
            throw SecureStorageError.invalidKeyFormat
        }

        guard let data = trimmed.data(using: .utf8) else {
            throw SecureStorageError.encodingFailed
        }

        // Delete existing key first
        let deleteQuery: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: serviceName,
            kSecAttrAccount as String: apiKeyAccount,
        ]
        SecItemDelete(deleteQuery as CFDictionary)

        // Add new key
        let addQuery: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: serviceName,
            kSecAttrAccount as String: apiKeyAccount,
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
        ]

        let status = SecItemAdd(addQuery as CFDictionary, nil)
        guard status == errSecSuccess else {
            throw SecureStorageError.storageFailed(status)
        }
    }

    // MARK: - Retrieve

    /// Retrieves the stored Anthropic API key from the Keychain.
    static func getApiKey() -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: serviceName,
            kSecAttrAccount as String: apiKeyAccount,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]

        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)

        guard status == errSecSuccess, let data = result as? Data else {
            return nil
        }

        return String(data: data, encoding: .utf8)
    }

    // MARK: - Remove

    /// Removes the stored Anthropic API key from the Keychain.
    static func removeApiKey() throws {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: serviceName,
            kSecAttrAccount as String: apiKeyAccount,
        ]

        let status = SecItemDelete(query as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else {
            throw SecureStorageError.deletionFailed(status)
        }
    }

    // MARK: - Check

    /// Checks if an API key is currently stored.
    static func hasApiKey() -> Bool {
        getApiKey() != nil
    }

    // MARK: - Generic Keychain Access

    /// Store arbitrary string data in the Keychain.
    static func store(key: String, value: String) throws {
        guard let data = value.data(using: .utf8) else {
            throw SecureStorageError.encodingFailed
        }

        let deleteQuery: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: serviceName,
            kSecAttrAccount as String: key,
        ]
        SecItemDelete(deleteQuery as CFDictionary)

        let addQuery: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: serviceName,
            kSecAttrAccount as String: key,
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
        ]

        let status = SecItemAdd(addQuery as CFDictionary, nil)
        guard status == errSecSuccess else {
            throw SecureStorageError.storageFailed(status)
        }
    }

    /// Retrieve arbitrary string data from the Keychain.
    static func retrieve(key: String) -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: serviceName,
            kSecAttrAccount as String: key,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]

        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)

        guard status == errSecSuccess, let data = result as? Data else {
            return nil
        }

        return String(data: data, encoding: .utf8)
    }

    /// Delete arbitrary data from the Keychain.
    static func delete(key: String) throws {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: serviceName,
            kSecAttrAccount as String: key,
        ]

        let status = SecItemDelete(query as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else {
            throw SecureStorageError.deletionFailed(status)
        }
    }
}

// MARK: - Errors

enum SecureStorageError: LocalizedError {
    case invalidKeyFormat
    case encodingFailed
    case storageFailed(OSStatus)
    case deletionFailed(OSStatus)

    var errorDescription: String? {
        switch self {
        case .invalidKeyFormat:
            return "Invalid Anthropic API key format. Keys should start with \"sk-ant-\"."
        case .encodingFailed:
            return "Failed to encode data for secure storage."
        case .storageFailed(let status):
            return "Failed to store data in Keychain (status: \(status))."
        case .deletionFailed(let status):
            return "Failed to remove data from Keychain (status: \(status))."
        }
    }
}
