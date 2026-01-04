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
      console.log('[AudioService] Configuring audio mode...');
      // Configure audio to play in silent mode and background
      await setAudioModeAsync({
        playsInSilentMode: true,
        shouldPlayInBackground: true,
      });
      console.log('[AudioService] Audio mode configured');

      console.log('[AudioService] Creating audio players...');
      // Create players for each sound
      this.tickPlayer = createAudioPlayer(SOUNDS.tick);
      this.completePlayer = createAudioPlayer(SOUNDS.complete);

      // Set volume
      this.tickPlayer.volume = 1.0;
      this.completePlayer.volume = 1.0;

      this.isInitialized = true;
      console.log('[AudioService] Sounds preloaded successfully');
    } catch (error) {
      console.error('[AudioService] Failed to preload sounds:', error);
    }
  }

  /**
   * Play the countdown tick sound
   */
  async playTick(): Promise<void> {
    console.log('[AudioService] playTick called');
    try {
      if (!this.tickPlayer) {
        console.log('[AudioService] Creating tick player on demand');
        this.tickPlayer = createAudioPlayer(SOUNDS.tick);
        this.tickPlayer.volume = 1.0;
      }

      console.log('[AudioService] Tick player state:', {
        playing: this.tickPlayer.playing,
        duration: this.tickPlayer.duration,
        currentTime: this.tickPlayer.currentTime,
      });

      // Seek to start and play
      await this.tickPlayer.seekTo(0);
      this.tickPlayer.play();
      console.log('[AudioService] Tick play() called');
    } catch (error) {
      console.error('[AudioService] Failed to play tick sound:', error);
    }
  }

  /**
   * Play the timer complete sound
   */
  async playComplete(): Promise<void> {
    console.log('[AudioService] playComplete called');
    try {
      if (!this.completePlayer) {
        console.log('[AudioService] Creating complete player on demand');
        this.completePlayer = createAudioPlayer(SOUNDS.complete);
        this.completePlayer.volume = 1.0;
      }

      console.log('[AudioService] Complete player state:', {
        playing: this.completePlayer.playing,
        duration: this.completePlayer.duration,
        currentTime: this.completePlayer.currentTime,
      });

      // Seek to start and play
      await this.completePlayer.seekTo(0);
      this.completePlayer.play();
      console.log('[AudioService] Complete play() called');
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
      console.log('[AudioService] Sounds unloaded');
    } catch (error) {
      console.error('[AudioService] Failed to unload sounds:', error);
    }
  }
}

// Export singleton instance
export const audioService = new AudioService();
