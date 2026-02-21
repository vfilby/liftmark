# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Structure

This is a multi-platform project with two app targets:

- `react-ios/` — React Native (Expo) app (current production app)
- `swift-ios/` — Native Swift app (in development)
- `spec/` — Shared specifications
- `e2e-spec/` — Shared E2E test specifications
- `docs/` — Documentation
- `assets/` — Shared assets
- `test-workouts/` — Test workout files
- `test-fixtures/` — Test fixture files

## Build & Development (React Native)

All React Native commands run from `react-ios/`:

```bash
# From repo root — delegating Makefile
make react-install    # Install dependencies
make react-ios        # Run on iOS simulator
make react-server     # Start dev server
make react-test       # Run test suite

# Or from react-ios/ directly
cd react-ios
make                  # Full build (install deps + prebuild)
make ios              # Run on iOS (dev build, NOT Expo Go — native modules require it)
make server           # Start dev server with logging
make rebuild-native   # Clean rebuild of native projects
make clean            # Full clean (native dirs, node_modules, caches)
```

## Testing (React Native)

```bash
# From root
make react-test

# From react-ios/
cd react-ios
make test                  # Full CI suite: audit + typecheck + jest with coverage
npx jest src/__tests__/MarkdownParser.test.ts  # Single test
make test-watch            # Watch mode
make test-coverage-open    # Coverage with HTML report
npm run typecheck          # Type checking only
```

**Coverage threshold**: 45% for branches, functions, lines, statements. Only `.ts` files are collected (not `.tsx`).

### E2E (Detox, iPhone 15 simulator)

```bash
cd react-ios
npm run e2e:prebuild    # generate iOS project
npm run e2e:build       # build test app
npm run e2e:test        # run all E2E tests
npm run e2e:test:smoke  # smoke tests only
```

## Release

Always push commits to main before releasing — `make release-alpha` creates a GitHub release tag that triggers a TestFlight build, but does NOT push commits.

Always bump **both** `react-ios/app.json` (`expo.version`) **and** `react-ios/package.json` (`version`) together. The release script reads from `package.json`.

```bash
cd react-ios
make release-alpha       # alpha → TestFlight
make release-beta        # beta
make release-production  # production
```

## Architecture (React Native)

**Expo SDK 54 / React Native 0.81 / TypeScript** fitness tracking app with New Architecture enabled.

### Directory Layout (react-ios/)

- `react-ios/app/` — Expo Router file-based routes. Tabs: index, workouts, history, settings. Dynamic route: `workout/[id].tsx`.
- `react-ios/src/stores/` — Zustand stores (workoutPlanStore, sessionStore, settingsStore, gymStore, equipmentStore)
- `react-ios/src/db/` — SQLite layer via expo-sqlite. Repository pattern (`repository.ts`, `sessionRepository.ts`, `exerciseHistoryRepository.ts`). Versioned migrations in `db/index.ts`.
- `react-ios/src/services/` — Business logic: `MarkdownParser.ts` (LMWF parser), `workoutGenerationService.ts` + `anthropicService.ts` (Anthropic AI), `healthKitService.ts`, `liveActivityService.ts`, `cloudKitService.ts` (iCloud sync), `databaseBackupService.ts`, `fileImportService.ts`, `workoutExportService.ts`, `workoutHistoryService.ts`, `workoutHighlightsService.ts`, `audioService.ts`, `logger.ts`, `secureStorage.ts`
- `react-ios/src/components/` — Reusable UI components
- `react-ios/src/hooks/` — Custom React hooks
- `react-ios/src/types/` — TypeScript type definitions
- `react-ios/src/utils/` — Utilities (ID generation via expo-crypto, etc.)
- `react-ios/src/theme/` — Theme config

### Key Patterns

- **Path alias**: `@/` maps to `src/` (configured in tsconfig + babel, within react-ios/)
- **State**: Zustand stores, no providers needed
- **Database**: expo-sqlite with repository pattern and migration system
- **Native modules**: HealthKit, Clipboard, Live Activities — always use dev builds (`npx expo run:ios`), never Expo Go
- **Bottom sheets**: `@gorhom/bottom-sheet`
- **Dates**: `date-fns`
- **File system**: expo-file-system v19 — `File.text()` returns `Promise<string>`, `File.textSync()` returns `string`

### LiftMark Workout Format (LMWF)

Custom markdown-based format for workout plans. Full spec in `docs/MARKDOWN_SPEC.md`, quick reference in `react-ios/QUICK_REFERENCE.md`. The parser lives in `react-ios/src/services/MarkdownParser.ts`.

```markdown
# Push Day
@tags: strength, upper
@units: lbs

## Bench Press
- 135 x 5
- 185 x 5
- 225 x 5
```

### React Navigation / expo-router

`headerRight` in native stack wraps ALL children in a single pill/container — you cannot have two visually separate buttons. For multiple header actions: use a single button + action sheet, or put secondary actions in the screen body.
