// Jest setup file
// Add any global test setup here

// Mock expo-crypto for generateId utility
jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(() => 'test-uuid-' + Math.random().toString(36).substr(2, 9)),
}));
