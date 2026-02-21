# Audio Service Specification

## Purpose

Play audio feedback sounds during workouts, specifically for rest timer countdown ticks and timer completion alerts. This provides audible cues so users know when rest periods are ending without looking at their screen.

## Public API

The service is implemented as a singleton class (`AudioService`).

### `preloadSounds(): Promise<void>`

Initialize the audio mode configuration and create audio players for all sound assets. Should be called early in the workout lifecycle to avoid playback delays.

### `playTick(): Promise<void>`

Play the countdown tick sound. Used during the final seconds of a rest timer.

### `playComplete(): Promise<void>`

Play the timer completion sound. Used when a rest timer reaches zero.

### `unloadSounds(): Promise<void>`

Release all audio player resources. Should be called when the workout ends or the component unmounts.

## Behavior Rules

- Audio is configured to play in silent mode (respects the app's need to be heard even when the device ringer is off).
- Audio is configured to play in the background (continues when the app is not in the foreground).
- Two sound assets are used:
  - `tick.mp3` for countdown ticks.
  - `complete.mp3` for timer completion.
- Audio players are created lazily: if `playTick()` or `playComplete()` is called before `preloadSounds()`, the player is created on demand.
- Before each playback, the player seeks to the start position to allow rapid repeated playback.
- Volume is set to 1.0 for all players.
- The service tracks its initialization state to avoid double-initialization.

## Dependencies

- `expo-audio` (`createAudioPlayer`, `setAudioModeAsync`) for audio playback and mode configuration.

## Error Handling

All methods catch errors internally and log them. No method throws exceptions. Audio playback failures are silent from the caller's perspective, since audio feedback is a non-critical enhancement.
