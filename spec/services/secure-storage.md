# Secure Storage Service Specification

## Purpose

Securely store and retrieve the user's Anthropic API key using the platform's secure storage mechanism (iOS Keychain). The API key is never stored in the database or in plaintext on disk.

## Public API

### `validateAnthropicApiKey(apiKey): boolean`

Validates that a string matches the expected Anthropic API key format.

**Validation regex:** `/^sk-ant-[a-zA-Z0-9_-]{95,}$/`

Returns `true` if valid, `false` otherwise.

### `storeApiKey(apiKey): Promise<void>`

Stores the API key in secure storage after validation.

**Logic:**
1. Trim whitespace from input.
2. Validate format using `validateAnthropicApiKey`.
3. If invalid, throw an error with message describing the expected format.
4. Write to secure storage under the key `anthropic_api_key`.
5. If storage fails, throw an error.

### `getApiKey(): Promise<string | null>`

Retrieves the stored API key.

Returns the key string if present, or `null` if no key is stored. Swallows all errors and returns `null` on failure (defensive — never crashes the app for a missing key).

### `removeApiKey(): Promise<void>`

Deletes the API key from secure storage. Throws on failure.

### `hasApiKey(): Promise<boolean>`

Convenience method. Calls `getApiKey()` and returns `true` if the result is non-null and non-empty.

## Storage Details

| Property | Value |
|----------|-------|
| Storage key | `anthropic_api_key` |
| Platform mechanism | iOS Keychain (via platform secure storage API) |
| Accessibility | After first unlock |

## Dependencies

- Platform-specific secure storage API (e.g., `expo-secure-store` on React Native, `Keychain` on native iOS).

## Error Handling

- `storeApiKey` throws on invalid format or storage failure.
- `getApiKey` never throws — returns `null` on any error.
- `removeApiKey` throws on failure.
- `hasApiKey` never throws — returns `false` on any error.
