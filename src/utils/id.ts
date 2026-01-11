import { randomUUID } from 'expo-crypto';

/**
 * Generates a UUID v4 for use as primary key
 * @returns UUID string (e.g., "550e8400-e29b-41d4-a716-446655440000")
 *
 * Uses expo-crypto for secure, standards-compliant UUID generation
 */
export function generateId(): string {
  return randomUUID();
}

/**
 * Creates a short ID suitable for UI display
 * @param fullId - Full UUID to shorten
 * @returns First 8 characters of the UUID
 */
export function createShortId(fullId?: string): string {
  const id = fullId || generateId();
  return id.substring(0, 8);
}
