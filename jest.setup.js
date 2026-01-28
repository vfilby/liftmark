// Jest setup file
// Add any global test setup here

// Mock expo-crypto for generateId utility
jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(() => 'test-uuid-' + Math.random().toString(36).substr(2, 9)),
}));

// Mock expo-secure-store for secure API key storage
const secureStoreMock = new Map();
jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn((key, value) => {
    secureStoreMock.set(key, value);
    return Promise.resolve();
  }),
  getItemAsync: jest.fn((key) => {
    return Promise.resolve(secureStoreMock.get(key) || null);
  }),
  deleteItemAsync: jest.fn((key) => {
    secureStoreMock.delete(key);
    return Promise.resolve();
  }),
}));

// Mock react-native Platform
jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
    select: jest.fn((obj) => obj.ios),
  },
}));

// Mock expo-audio
jest.mock('expo-audio', () => ({
  createAudioPlayer: jest.fn(() => ({
    play: jest.fn(),
    seekTo: jest.fn().mockResolvedValue(undefined),
    release: jest.fn(),
    volume: 1.0,
    playing: false,
    duration: 1000,
    currentTime: 0,
  })),
  setAudioModeAsync: jest.fn().mockResolvedValue(undefined),
}));
