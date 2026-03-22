# Onboarding Flow

## Purpose

Present a one-time welcome and legal disclaimer to new users before they access the app. LiftMark is a tracking tool, not an exercise instruction or coaching app. Users must acknowledge they are responsible for their own safety.

## Trigger

The onboarding screen is displayed **once**, on first launch, when `hasAcceptedDisclaimer` is `false` (the default). Until the user accepts, the main app UI is not accessible.

## Flow

1. App launches
2. If `hasAcceptedDisclaimer` is `false` → present the Onboarding Screen (full screen, no navigation chrome)
3. User reads the welcome message and disclaimer
4. User taps "I Understand" to accept
5. `hasAcceptedDisclaimer` is set to `true` and persisted
6. App transitions to the normal tab-based Home Screen
7. On all subsequent launches, the onboarding screen is skipped

## Re-access

The full disclaimer text is accessible from **Settings > About > Disclaimer** as a read-only view, so users can review it at any time.

## Content

See `spec/screens/onboarding.md` for the full screen layout and disclaimer text.
