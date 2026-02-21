import { createAudioPlayer, setAudioModeAsync, AudioPlayer } from 'expo-audio';

// Sound file imports - using require for static assets
const SOUNDS = {
  tick: require('../../assets/sounds/tick.mp3'),
  complete: require('../../assets/sounds/complete.mp3'),
};

class AudioService {
  private tickPlayer: AudioPlayer | null = null;
  private completePlayer: AudioPlayer | null = null;
  private isInitialized = false;

  /**
   * Initialize audio mode and preload sounds
   */
  async preloadSounds(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Configure audio to play in silent mode and background
      await setAudioModeAsync({
        playsInSilentMode: true,
        shouldPlayInBackground: true,
      });

      // Create players for each sound
      this.tickPlayer = createAudioPlayer(SOUNDS.tick);
      this.completePlayer = createAudioPlayer(SOUNDS.complete);

      // Set volume
      this.tickPlayer.volume = 1.0;
      this.completePlayer.volume = 1.0;

      this.isInitialized = true;
    } catch (error) {
      console.error('[AudioService] Failed to preload sounds:', error);
    }
  }

  /**
   * Play the countdown tick sound
   */
  async playTick(): Promise<void> {
    try {
      if (!this.tickPlayer) {
        this.tickPlayer = createAudioPlayer(SOUNDS.tick);
        this.tickPlayer.volume = 1.0;
      }

      // Seek to start and play
      await this.tickPlayer.seekTo(0);
      this.tickPlayer.play();
    } catch (error) {
      console.error('[AudioService] Failed to play tick sound:', error);
    }
  }

  /**
   * Play the timer complete sound
   */
  async playComplete(): Promise<void> {
    try {
      if (!this.completePlayer) {
        this.completePlayer = createAudioPlayer(SOUNDS.complete);
        this.completePlayer.volume = 1.0;
      }

      // Seek to start and play
      await this.completePlayer.seekTo(0);
      this.completePlayer.play();
    } catch (error) {
      console.error('[AudioService] Failed to play complete sound:', error);
    }
  }

  /**
   * Cleanup sounds when no longer needed
   */
  async unloadSounds(): Promise<void> {
    try {
      if (this.tickPlayer) {
        this.tickPlayer.release();
        this.tickPlayer = null;
      }
      if (this.completePlayer) {
        this.completePlayer.release();
        this.completePlayer = null;
      }
      this.isInitialized = false;
    } catch (error) {
      console.error('[AudioService] Failed to unload sounds:', error);
    }
  }
}

// Export singleton instance
export const audioService = new AudioService();
