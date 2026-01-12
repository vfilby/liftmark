## Tech Stack

- **Framework**: Expo SDK 54
- **Language**: TypeScript 5.9.2
- **Runtime**: React 19.1.0, React Native 0.81.5
- **Navigation**: Expo Router 6.0.21
- **Database**: expo-sqlite 16.0.10
- **State Management**: Zustand 5.0.9
- **ID Generation**: expo-crypto 15.0.8 (UUID v4)
- **Date Utilities**: date-fns 4.1.0

## Project Structure

```
/LiftMark2
├── app/                          # Expo Router screens
│   ├── (tabs)/                  # Tab navigation
│   │   ├── _layout.tsx          # Tab layout
│   │   ├── index.tsx            # Home screen
│   │   ├── workouts.tsx         # Workout list screen
│   │   └── settings.tsx         # Settings screen
│   ├── modal/                   # Modal screens
│   │   └── import.tsx           # Import workout modal
│   ├── workout/                 # Workout detail
│   │   └── [id].tsx            # Workout detail screen
│   └── _layout.tsx              # Root layout
├── src/
│   ├── db/                      # Database layer
│   │   ├── index.ts            # SQLite setup & migrations
│   │   └── repository.ts       # CRUD operations
│   ├── services/                # Business logic
│   │   ├── MarkdownParser.ts   # LMWF parser (1,038 lines)
│   │   ├── README.md
│   │   ├── PARSER_EXAMPLES.md
│   │   └── PARSER_FEATURES.md
│   ├── stores/                  # Zustand state
│   │   ├── workoutStore.ts     # Workout state & actions
│   │   └── settingsStore.ts    # Settings state & actions
│   ├── types/                   # TypeScript types
│   │   ├── workout.ts          # All type definitions
│   │   └── index.ts
│   └── utils/                   # Utilities
│       └── id.ts               # UUID generation
├── babel.config.js              # Babel with module resolver
├── tsconfig.json                # TypeScript config
├── package.json
└── app.json                     # Expo config
```

## Getting Started

### Prerequisites
- Node.js (v18 or later recommended)
- npm or yarn
- Expo Go app (for testing on physical device)

### Installation

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm start
```

3. Run on your device:
- Scan the QR code with Expo Go (Android) or Camera app (iOS)
- Or press `i` for iOS simulator, `a` for Android emulator

## Development Notes

### Path Aliases
The project uses `@/` as an alias for `src/`:
```typescript
import { useWorkoutStore } from '@/stores/workoutStore';
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

## Deployment & Versioning

### Automated Version Bumping

This project uses automated version bumping via the Refinery (Gas Town's merge queue processor). When PRs are merged to `main`:

1. The Refinery automatically bumps the patch version in `package.json`
2. The version increment is included in the merge commit
3. No manual version management needed

**Configuration:** See `.refinery/refinery.yml` for version bump settings.

**Current Strategy:** Patch bump (1.0.24 → 1.0.25) on every merge.

### Release Process

After the Refinery merges your PR and bumps the version:

```bash
# Pull the latest main with version bump
git checkout main
git pull

# Create a release (alpha/beta/production)
make release-alpha
```

This creates a git tag and triggers deployment to TestFlight.

**Full details:** See [`docs/release-process.md`](./release-process.md) for the complete release workflow.

### Refinery Integration

The `.refinery/` directory contains:
- `bump-version.sh` - Script that performs version bumping
- `refinery.yml` - Configuration for merge behavior
- `test-bump.sh` - Test suite for version bumping logic
- `README.md` - Detailed documentation

**Testing version bump locally:**
```bash
.refinery/test-bump.sh
```

See [`.refinery/README.md`](../.refinery/README.md) for complete documentation.