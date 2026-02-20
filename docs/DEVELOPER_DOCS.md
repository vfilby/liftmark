## Tech Stack

- **Framework**: Expo SDK 54
- **Language**: TypeScript 5.9.2
- **Runtime**: React 19.1.0, React Native 0.81.5
- **Navigation**: Expo Router ~6.0.23
- **Database**: expo-sqlite 16.0.10
- **State Management**: Zustand 5.0.9
- **ID Generation**: expo-crypto 15.0.8 (UUID v4)
- **Date Utilities**: date-fns 4.1.0

## Project Structure

```
/LiftMark
├── app/                          # Expo Router screens
│   ├── (tabs)/                  # Tab navigation
│   │   ├── _layout.tsx          # Tab layout
│   │   ├── index.tsx            # Home screen
│   │   ├── workouts.tsx         # Workout list screen
│   │   ├── history.tsx          # Workout history screen
│   │   └── settings.tsx         # Settings screen
│   ├── modal/                   # Modal screens
│   │   └── import.tsx           # Import workout modal
│   ├── workout/                 # Workout screens
│   │   ├── [id].tsx            # Workout detail screen
│   │   ├── active.tsx          # Active workout tracking
│   │   └── summary.tsx         # Workout summary
│   ├── history/                 # History screens
│   │   └── [id].tsx            # Individual workout history
│   ├── gym/                     # Gym management
│   │   └── [id].tsx            # Gym detail/equipment
│   ├── settings/                # Settings sub-screens
│   │   ├── _layout.tsx
│   │   ├── workout.tsx         # Workout settings
│   │   ├── sync.tsx            # iCloud sync settings
│   │   └── debug-logs.tsx      # Debug log viewer
│   └── _layout.tsx              # Root layout
├── src/
│   ├── db/                      # Database layer
│   │   ├── index.ts            # SQLite setup & migrations
│   │   ├── repository.ts       # Template CRUD operations
│   │   ├── sessionRepository.ts # Workout session CRUD
│   │   └── exerciseHistoryRepository.ts # Exercise history queries
│   ├── services/                # Business logic
│   │   ├── MarkdownParser.ts   # LMWF parser
│   │   ├── workoutGenerationService.ts # AI workout generation
│   │   ├── anthropicService.ts         # Anthropic SDK service
│   │   ├── workoutExportService.ts     # Export & share
│   │   ├── workoutHistoryService.ts    # Workout history queries
│   │   ├── workoutHighlightsService.ts # Workout highlights/PRs
│   │   ├── healthKitService.ts         # HealthKit integration
│   │   ├── liveActivityService.ts      # Live Activities
│   │   ├── cloudKitService.ts          # iCloud sync
│   │   ├── databaseBackupService.ts    # Database backup/restore
│   │   ├── fileImportService.ts        # File import handling
│   │   ├── audioService.ts             # Audio feedback
│   │   ├── logger.ts                   # Logging service
│   │   └── secureStorage.ts            # Secure key storage
│   ├── stores/                  # Zustand state
│   │   ├── workoutPlanStore.ts # Workout plan state & actions
│   │   ├── sessionStore.ts    # Active session state
│   │   ├── settingsStore.ts   # Settings state & actions
│   │   ├── gymStore.ts        # Gym management state
│   │   └── equipmentStore.ts  # Equipment state
│   ├── components/              # Reusable UI components
│   ├── hooks/                   # Custom React hooks
│   ├── types/                   # TypeScript types
│   ├── theme/                   # Theme configuration
│   └── utils/                   # Utilities
├── babel.config.js              # Babel with module resolver
├── tsconfig.json                # TypeScript config
├── package.json
└── app.json                     # Expo config
```

## Getting Started

### Prerequisites
- Node.js (v18 or later recommended)
- npm
- Xcode (for iOS development builds)

### Installation

```bash
# Install deps + generate native projects
make

# Run on iOS (dev build — native modules require it, not Expo Go)
make ios

# Start dev server with logging
make server
```

See `CLAUDE.md` for the full list of build, test, and release commands.

## Development Notes

### Path Aliases
The project uses `@/` as an alias for `src/`:
```typescript
import { useWorkoutPlanStore } from '@/stores/workoutPlanStore';
```

Configured in:
- `tsconfig.json` - TypeScript compilation
- `babel.config.js` - Runtime module resolution

### ID Generation
All entities use UUID v4 for primary keys:
```typescript
import { generateId } from '@/utils/id';
const id = generateId(); // Returns UUID v4 string
```

### Database Access
Always use `getDatabase()` to get the singleton instance:
```typescript
import { getDatabase } from '@/db';
const db = await getDatabase();
```

## Release Process

Version must be bumped manually in **both** `app.json` (`expo.version`) and `package.json` (`version`) before releasing. The release script reads from `package.json`.

Always push commits to main before releasing — `make release-alpha` creates a GitHub release tag that triggers a TestFlight build, but does NOT push commits.

```bash
# 1. Bump version in both files
# 2. Commit and push
git push origin main

# 3. Create a release
make release-alpha       # alpha → TestFlight
make release-beta        # beta
make release-production  # production
```

## Troubleshooting

### Xcode Duplicate LiveActivity Target Error

**Problem:** `npx expo run:ios` fails with duplicate output errors:
```
❌ error: Multiple commands produce '/Users/.../LiveActivity.appex'
❌ error: Multiple commands produce '.../LiveActivity.appex/LiveActivity.debug.dylib'
❌ error: Multiple commands produce '.../LiveActivity.appex/LiveActivity'
```

**Root Cause:** Stale or corrupted Xcode project files from previous prebuild operations. The expo-live-activity plugin creates an app extension target, but duplicate targets may be created if the iOS project is not properly regenerated.

**Solution:** Clean and regenerate the iOS project:
```bash
# Option 1: Using make command
make rebuild-native

# Option 2: Manual cleanup
rm -rf ios/
npx expo prebuild --clean
```

**Verification:**
1. Check that only 2 native targets exist:
   ```bash
   grep -c "isa = PBXNativeTarget" ios/LiftMark.xcodeproj/project.pbxproj
   # Should output: 2
   ```
2. Run the build:
   ```bash
   npx expo run:ios
   ```
3. Verify successful linking of LiveActivity files without errors

**Expected Result:** Single LiveActivity target, successful build, all native modules (clipboard, live-activity, healthkit) included in development build.