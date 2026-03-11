# Audio Service

**Status: Active**

## Purpose

Provides audible countdown warnings and completion tones for all timers during active workouts. Plays through the device speaker even in silent mode.

## Sound Assets

| File | Duration | Description |
|------|----------|-------------|
| `tick.mp3` | ~100ms | Short click/tick sound for countdown warnings |
| `complete.mp3` | ~500ms | Completion chime when timer reaches zero |

Location: `LiftMark/Resources/Sounds/`

## Behavior

### Countdown Ticks
- During the **last 5 seconds** of any timer, play `tick.mp3` once at each second: 5, 4, 3, 2, 1.
- Applies to both **RestTimerView** (countdown) and **ExerciseTimerView** (count-up with target).
- Each tick plays **exactly once** per second threshold — returning from background must not trigger multiple ticks for skipped seconds.

### Completion Tone
- Play `complete.mp3` once when a timer reaches 0 (rest timer) or when elapsed time reaches the target (exercise timer).
- The completion tone plays **once** per timer cycle, even if the timer continues counting past zero.

### User Setting
- Controlled by the `countdownSoundsEnabled` user setting (default: **true**).
- When disabled, no tick or completion sounds play.
- The toggle appears in Workout Settings under the "Rest Timer" section.

## Audio Session Configuration

- Category: `.playback` with `.mixWithOthers` option — sounds play even in silent mode and mix with other audio (e.g., music).
- Session is activated on `preloadSounds()` and remains active during the workout lifecycle.

## API

```swift
AudioService.shared.preloadSounds()   // Idempotent; call on timer appear
AudioService.shared.playTick()        // Play countdown tick
AudioService.shared.playComplete()    // Play completion tone
AudioService.shared.unloadSounds()    // Release resources
```

## Integration Points

- **RestTimerView**: Checks `settingsStore.settings?.countdownSoundsEnabled`. Tracks `lastPlayedSecond` to avoid double-plays. Plays tick at remaining = 5, 4, 3, 2, 1. Plays complete at remaining = 0.
- **ExerciseTimerView**: Same setting check. Calculates `remaining = targetSeconds - displayElapsed`. Plays tick at remaining = 5, 4, 3, 2, 1. Plays complete when elapsed first reaches target.

## Tests

- **Unit**: Verify `AudioService` loads players without crashing when sound files exist.
- **Integration**: Verify that countdown ticks fire at the correct second thresholds (mock AudioService or verify call counts).
- **Setting**: Verify that toggling `countdownSoundsEnabled` off suppresses all audio playback.
