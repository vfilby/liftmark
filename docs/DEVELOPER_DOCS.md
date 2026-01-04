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