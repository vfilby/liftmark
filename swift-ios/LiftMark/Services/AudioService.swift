import Foundation
import AVFoundation

// MARK: - AudioService

final class AudioService {
    static let shared = AudioService()

    private var tickPlayer: AVAudioPlayer?
    private var completePlayer: AVAudioPlayer?
    private var isInitialized = false

    private init() {}

    // MARK: - Preload

    /// Initialize audio session and preload sound assets.
    /// Call early in the workout lifecycle to avoid playback delays.
    func preloadSounds() {
        guard !isInitialized else { return }

        #if os(iOS)
        do {
            // Configure audio to play in silent mode and background
            try AVAudioSession.sharedInstance().setCategory(
                .playback,
                mode: .default,
                options: [.mixWithOthers]
            )
            try AVAudioSession.sharedInstance().setActive(true)
        } catch {
            Logger.shared.error(.app, "Failed to configure audio session", error: error)
        }
        #endif

        // Create players for each sound
        tickPlayer = loadPlayer(named: "tick", extension: "mp3")
        completePlayer = loadPlayer(named: "complete", extension: "mp3")

        isInitialized = true
    }

    // MARK: - Playback

    /// Play the countdown tick sound.
    func playTick() {
        if tickPlayer == nil {
            tickPlayer = loadPlayer(named: "tick", extension: "mp3")
        }

        guard let player = tickPlayer else { return }
        player.currentTime = 0
        player.play()
    }

    /// Play the timer completion sound.
    func playComplete() {
        if completePlayer == nil {
            completePlayer = loadPlayer(named: "complete", extension: "mp3")
        }

        guard let player = completePlayer else { return }
        player.currentTime = 0
        player.play()
    }

    // MARK: - Cleanup

    /// Release all audio player resources.
    func unloadSounds() {
        tickPlayer?.stop()
        tickPlayer = nil
        completePlayer?.stop()
        completePlayer = nil
        isInitialized = false
    }

    // MARK: - Helpers

    private func loadPlayer(named name: String, extension ext: String) -> AVAudioPlayer? {
        guard let url = Bundle.main.url(forResource: name, withExtension: ext) else {
            Logger.shared.warn(.app, "Sound file not found: \(name).\(ext)")
            return nil
        }

        do {
            let player = try AVAudioPlayer(contentsOf: url)
            player.volume = 1.0
            player.prepareToPlay()
            return player
        } catch {
            Logger.shared.error(.app, "Failed to create audio player for \(name).\(ext)", error: error)
            return nil
        }
    }
}
