# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development

```bash
# Install deps + generate native projects
make

# Run on iOS (dev build, NOT Expo Go — native modules require it)
make ios

# Start dev server with logging
make server

# Clean rebuild of native projects (fixes duplicate target errors)
make rebuild-native

# Full clean (native dirs, node_modules, caches)
make clean
```

## Testing

```bash
# Full CI suite: audit + typecheck + jest with coverage
make test

# Run a single test
npx jest src/__tests__/MarkdownParser.test.ts

# Watch mode
make test-watch

# Coverage with HTML report
make test-coverage-open

# Type checking only
npm run typecheck
```

**Coverage threshold**: 45% for branches, functions, lines, statements. Only `.ts` files are collected (not `.tsx`).

### E2E (Detox, iPhone 15 simulator)

```bash
npm run e2e:prebuild    # generate iOS project
npm run e2e:build       # build test app
npm run e2e:test        # run all E2E tests
npm run e2e:test:smoke  # smoke tests only
```

## Release

Always push commits to main before releasing — `make release-alpha` creates a GitHub release tag that triggers a TestFlight build, but does NOT push commits.

Always bump **both** `app.json` (`expo.version`) **and** `package.json` (`version`) together. The release script reads from `package.json`.

```bash
make release-alpha       # alpha → TestFlight
make release-beta        # beta
make release-production  # production
```

## Architecture

**Expo SDK 54 / React Native 0.81 / TypeScript** fitness tracking app with New Architecture enabled.

### Directory Layout

- `app/` — Expo Router file-based routes. Tabs: index, workouts, history, settings. Dynamic route: `workout/[id].tsx`.
- `src/stores/` — Zustand stores (workoutPlanStore, sessionStore, settingsStore, gymStore, equipmentStore)
- `src/db/` — SQLite layer via expo-sqlite. Repository pattern (`repository.ts`, `sessionRepository.ts`, `exerciseHistoryRepository.ts`). Versioned migrations in `db/index.ts`.
- `src/services/` — Business logic: `MarkdownParser.ts` (LMWF parser, ~1300 lines), `workoutGenerationService.ts` (Anthropic AI), `healthKitService.ts`, `liveActivityService.ts`, `workoutExportService.ts`
- `src/components/` — Reusable UI components
- `src/hooks/` — Custom React hooks
- `src/types/` — TypeScript type definitions
- `src/utils/` — Utilities (ID generation via expo-crypto, etc.)
- `src/theme/` — Theme config

### Key Patterns

- **Path alias**: `@/` maps to `src/` (configured in tsconfig + babel)
- **State**: Zustand stores, no providers needed
- **Database**: expo-sqlite with repository pattern and migration system
- **Native modules**: HealthKit, Clipboard, Live Activities — always use dev builds (`npx expo run:ios`), never Expo Go
- **Bottom sheets**: `@gorhom/bottom-sheet`
- **Dates**: `date-fns`
- **File system**: expo-file-system v19 — `File.text()` returns `Promise<string>`, `File.textSync()` returns `string`

### LiftMark Workout Format (LMWF)

Custom markdown-based format for workout plans. Full spec in `docs/MARKDOWN_SPEC.md`, quick reference in `QUICK_REFERENCE.md`. The parser lives in `src/services/MarkdownParser.ts`.

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
