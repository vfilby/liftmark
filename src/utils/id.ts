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
