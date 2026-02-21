# iOS Project Requirements

This document defines the requirements for building a deployable iOS application from the LiftMark spec. Any iOS implementation (React Native or native Swift) must satisfy these requirements to be App Store deployable.

## Xcode Project Structure

The iOS app MUST be a proper Xcode project (`.xcodeproj`), NOT a Swift Package Manager package. SPM packages cannot:
- Run on iOS simulators as apps
- Host UI test targets (XCUITest)
- Be submitted to App Store Connect
- Include app-level configuration (entitlements, capabilities, Info.plist)

### Required Targets

| Target | Type | Purpose |
|--------|------|---------|
| **LiftMark** | iOS Application | Main app target |
| **LiftMarkTests** | Unit Test Bundle | XCTest unit tests (parser, repositories, services) |
| **LiftMarkUITests** | UI Test Bundle | XCUITest E2E tests driven by YAML spec |

### Bundle Configuration

- **Bundle Identifier**: `com.liftmark.app` (or team-specific equivalent)
- **Minimum Deployment Target**: iOS 18.0
- **Device Family**: iPhone (primary), iPad (supported)
- **Supported Orientations**: Portrait (iPhone), All (iPad)
- **Swift Language Version**: 5.9+

### Info.plist Required Keys

| Key | Value | Reason |
|-----|-------|--------|
| `NSHealthShareUsageDescription` | "LiftMark reads your workout history to track progress." | HealthKit read access |
| `NSHealthUpdateUsageDescription` | "LiftMark saves your completed workouts to Apple Health." | HealthKit write access |
| `CFBundleURLTypes` | `liftmark://` scheme | Deep link / share target import |
| `NSSupportsLiveActivities` | `YES` | Live Activities support |
| `UIBackgroundModes` | `processing` | Background task for sync |

### Entitlements

| Entitlement | Reason |
|-------------|--------|
| `com.apple.developer.healthkit` | HealthKit integration |
| `com.apple.developer.healthkit.background-delivery` | Background health data |
| `com.apple.developer.icloud-container-identifiers` | CloudKit sync |
| `com.apple.developer.icloud-services` | CloudKit |
| `com.apple.security.application-groups` | Shared container for Live Activities widget |

### Capabilities

The Xcode project must enable these capabilities:
- **HealthKit** — Read/write workout data
- **iCloud** — CloudKit container for sync
- **Push Notifications** — CloudKit change notifications
- **Background Modes** — Background processing, Remote notifications
- **App Groups** — Shared data between app and Live Activity widget

## Dependencies

Third-party dependencies should be managed via **Swift Package Manager** (integrated into the Xcode project, not a standalone Package.swift).

| Dependency | Version | Purpose |
|------------|---------|---------|
| [GRDB.swift](https://github.com/groue/GRDB.swift) | 6.24+ | SQLite database (canonical schema from `spec/data/database-schema.md`) |

All other functionality uses Apple frameworks:
- **SwiftUI** — UI
- **HealthKit** — Apple Health integration
- **ActivityKit** — Live Activities
- **CloudKit** — iCloud sync
- **AVFoundation** — Audio playback
- **Security** — Keychain for API key storage
- **Charts** — Exercise history charts (iOS 16+)

## Live Activity Widget Extension

Live Activities require a **Widget Extension** target:

| Target | Type | Purpose |
|--------|------|---------|
| **LiftMarkWidgets** | Widget Extension | Live Activity UI for active workouts |

The widget extension must:
- Define `ActivityAttributes` matching the `LiveActivityService` data model
- Provide lock screen and Dynamic Island UI
- Share data with main app via App Group container
- Minimum deployment: iOS 18.0

## App Store Deployment

### Signing

- Requires Apple Developer Program membership
- Automatic signing recommended for development
- Distribution provisioning profile for App Store / TestFlight

### Asset Requirements

| Asset | Specification |
|-------|--------------|
| App Icon | 1024x1024 single-size icon (Xcode 15+ auto-generates all sizes) |
| Launch Screen | SwiftUI launch screen or LaunchScreen.storyboard |
| Screenshots | Required for App Store listing (6.7", 6.5", 5.5" iPhones; 12.9" iPad) |

### Build Settings

| Setting | Value |
|---------|-------|
| `SWIFT_VERSION` | 5.9 |
| `IPHONEOS_DEPLOYMENT_TARGET` | 18.0 |
| `ENABLE_BITCODE` | NO (deprecated) |
| `SWIFT_STRICT_CONCURRENCY` | Complete (recommended) |

## Testing

### Unit Tests (LiftMarkTests)

Run via Xcode or command line:
```bash
xcodebuild test \
  -project LiftMark.xcodeproj \
  -scheme LiftMark \
  -destination 'platform=iOS Simulator,name=iPhone 16' \
  -only-testing:LiftMarkTests
```

### UI Tests (LiftMarkUITests)

The UI test target reads YAML scenario files from `e2e-spec/scenarios/` and executes them via the XCUITest runner (see `e2e-spec/runners/xcuitest/`).

```bash
xcodebuild test \
  -project LiftMark.xcodeproj \
  -scheme LiftMark \
  -destination 'platform=iOS Simulator,name=iPhone 16' \
  -only-testing:LiftMarkUITests
```

The YAML scenario files and fixtures must be included in the UI test bundle's resources (via "Copy Bundle Resources" build phase or resource references in the project).

### Build Validation

Before any release:
1. `xcodebuild build` succeeds with 0 errors and 0 warnings
2. All unit tests pass
3. All UI tests pass (YAML scenarios execute successfully)
4. No analyzer warnings (`xcodebuild analyze`)

## Project File Organization

The Xcode project should mirror the filesystem layout:

```
swift-ios/
  LiftMark.xcodeproj/
  LiftMark/
    App/                    -- @main entry, ContentView
    Models/                 -- Data types
    Views/                  -- All SwiftUI views (grouped by feature)
    Database/               -- GRDB layer
    Services/               -- Business logic
    Stores/                 -- @Observable state
    Navigation/             -- Routing
    Theme/                  -- Visual constants
    Utils/                  -- Helpers
    Resources/
      Assets.xcassets       -- App icon, colors, images
      Sounds/               -- Audio files for timers
  LiftMarkTests/            -- Unit tests
  LiftMarkUITests/          -- E2E tests (YAML runner)
  LiftMarkWidgets/          -- Live Activity widget extension
```

Groups in the Xcode project should use folder references (blue folders) to stay in sync with the filesystem, not virtual groups.
