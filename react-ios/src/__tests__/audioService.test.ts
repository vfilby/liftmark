// Tests for audioService
// Note: expo-audio is mocked in jest.setup.js

describe('audioService', () => {
  let audioService: typeof import('../services/audioService').audioService;
  let mockSetAudioModeAsync: jest.Mock;
  let mockCreateAudioPlayer: jest.Mock;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    // Re-get the mocked functions after reset
    const expoAudio = require('expo-audio');
    mockSetAudioModeAsync = expoAudio.setAudioModeAsync;
    mockCreateAudioPlayer = expoAudio.createAudioPlayer;

    // Import fresh audioService
    audioService = require('../services/audioService').audioService;
  });

  describe('preloadSounds', () => {
    it('configures audio mode and creates players on first call', async () => {
      await audioService.preloadSounds();

      expect(mockSetAudioModeAsync).toHaveBeenCalledWith({
        playsInSilentMode: true,
        shouldPlayInBackground: true,
      });
      expect(mockCreateAudioPlayer).toHaveBeenCalledTimes(2);
    });

    it('does not reinitialize if already initialized', async () => {
      await audioService.preloadSounds();
      const callCount = mockSetAudioModeAsync.mock.calls.length;

      await audioService.preloadSounds();

      // Should not be called again
      expect(mockSetAudioModeAsync).toHaveBeenCalledTimes(callCount);
    });

    it('handles errors gracefully', async () => {
      mockSetAudioModeAsync.mockRejectedValueOnce(new Error('Audio init failed'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await audioService.preloadSounds();

      expect(consoleSpy).toHaveBeenCalledWith(
        '[AudioService] Failed to preload sounds:',
        expect.any(Error)
      );
      consoleSpy.mockRestore();
    });
  });

  describe('playTick', () => {
    it('creates player on demand if not preloaded', async () => {
      await audioService.playTick();

      expect(mockCreateAudioPlayer).toHaveBeenCalled();
    });

    it('seeks to start and plays', async () => {
      const mockPlayer = {
        play: jest.fn(),
        seekTo: jest.fn().mockResolvedValue(undefined),
        volume: 1.0,
        playing: false,
        duration: 1000,
        currentTime: 0,
      };
      mockCreateAudioPlayer.mockReturnValue(mockPlayer);

      await audioService.playTick();

      expect(mockPlayer.seekTo).toHaveBeenCalledWith(0);
      expect(mockPlayer.play).toHaveBeenCalled();
    });

    it('handles errors gracefully', async () => {
      mockCreateAudioPlayer.mockImplementationOnce(() => {
        throw new Error('Player creation failed');
      });
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await audioService.playTick();

      expect(consoleSpy).toHaveBeenCalledWith(
        '[AudioService] Failed to play tick sound:',
        expect.any(Error)
      );
      consoleSpy.mockRestore();
    });
  });

  describe('playComplete', () => {
    it('creates player on demand if not preloaded', async () => {
      await audioService.playComplete();

      expect(mockCreateAudioPlayer).toHaveBeenCalled();
    });

    it('seeks to start and plays', async () => {
      const mockPlayer = {
        play: jest.fn(),
        seekTo: jest.fn().mockResolvedValue(undefined),
        volume: 1.0,
        playing: false,
        duration: 1000,
        currentTime: 0,
      };
      mockCreateAudioPlayer.mockReturnValue(mockPlayer);

      await audioService.playComplete();

      expect(mockPlayer.seekTo).toHaveBeenCalledWith(0);
      expect(mockPlayer.play).toHaveBeenCalled();
    });

    it('handles errors gracefully', async () => {
      mockCreateAudioPlayer.mockImplementationOnce(() => {
        throw new Error('Player creation failed');
      });
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await audioService.playComplete();

      expect(consoleSpy).toHaveBeenCalledWith(
        '[AudioService] Failed to play complete sound:',
        expect.any(Error)
      );
      consoleSpy.mockRestore();
    });
  });

  describe('unloadSounds', () => {
    it('releases players and resets initialized state', async () => {
      // First preload
      await audioService.preloadSounds();
      const initialCalls = mockSetAudioModeAsync.mock.calls.length;

      // Unload
      await audioService.unloadSounds();

      // Preload again - should work since isInitialized was reset
      await audioService.preloadSounds();

      expect(mockSetAudioModeAsync).toHaveBeenCalledTimes(initialCalls + 1);
    });

    it('handles case when players are null', async () => {
      // Call unload without preloading - should not throw
      await expect(audioService.unloadSounds()).resolves.not.toThrow();
    });

    it('handles release errors gracefully', async () => {
      const mockPlayer = {
        play: jest.fn(),
        seekTo: jest.fn().mockResolvedValue(undefined),
        release: jest.fn(() => {
          throw new Error('Release failed');
        }),
        volume: 1.0,
      };
      mockCreateAudioPlayer.mockReturnValue(mockPlayer);
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await audioService.preloadSounds();
      await audioService.unloadSounds();

      expect(consoleSpy).toHaveBeenCalledWith(
        '[AudioService] Failed to unload sounds:',
        expect.any(Error)
      );
      consoleSpy.mockRestore();
    });
  });
});
