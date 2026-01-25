/**
 * Secure Storage Service
 * Handles secure storage of sensitive data like API keys using expo-secure-store
 */
import * as SecureStore from 'expo-secure-store';

const API_KEY_STORAGE_KEY = 'anthropic_api_key';

/**
 * Validates Anthropic API key format
 * @param apiKey The API key to validate
 * @returns true if the format is valid
 */
export function validateAnthropicApiKey(apiKey: string): boolean {
  if (!apiKey || typeof apiKey !== 'string') {
    return false;
  }

  // Anthropic API keys start with 'sk-ant-' and have a specific format
  // Format: sk-ant-api03-[base64-like string]
  const anthropicKeyRegex = /^sk-ant-[a-zA-Z0-9_-]{95,}$/;
  return anthropicKeyRegex.test(apiKey.trim());
}

/**
 * Securely stores the Anthropic API key
 * @param apiKey The API key to store
 * @throws Error if storage fails
 */
export async function storeApiKey(apiKey: string): Promise<void> {
  try {
    if (!validateAnthropicApiKey(apiKey)) {
      throw new Error('Invalid Anthropic API key format. Keys should start with "sk-ant-"');
    }

    await SecureStore.setItemAsync(API_KEY_STORAGE_KEY, apiKey.trim());
  } catch (error) {
    console.error('Failed to store API key:', error);
    throw new Error('Failed to securely store API key');
  }
}

/**
 * Retrieves the stored Anthropic API key
 * @returns The API key or null if not found
 */
export async function getApiKey(): Promise<string | null> {
  try {
    const apiKey = await SecureStore.getItemAsync(API_KEY_STORAGE_KEY);
    return apiKey;
  } catch (error) {
    console.error('Failed to retrieve API key:', error);
    return null;
  }
}

/**
 * Removes the stored Anthropic API key
 * @throws Error if removal fails
 */
export async function removeApiKey(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(API_KEY_STORAGE_KEY);
  } catch (error) {
    console.error('Failed to remove API key:', error);
    throw new Error('Failed to remove API key from secure storage');
  }
}

/**
 * Checks if an API key is currently stored
 * @returns true if an API key exists
 */
export async function hasApiKey(): Promise<boolean> {
  const apiKey = await getApiKey();
  return apiKey !== null && apiKey.length > 0;
}
