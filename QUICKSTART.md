# LiftMark 2.0 - Quick Start Guide

## Prerequisites

- **Xcode** (for iOS development) - Includes iOS Simulator
- **Node.js** v18 or later
- **npm** (comes with Node.js)

## Installation & Running

### 1. Install Dependencies

**IMPORTANT**: Must use `--legacy-peer-deps` flag due to React version conflicts:

```bash
npm install --legacy-peer-deps
```

### 2. Start the App

#### iOS Simulator (Mac only)

```bash
npm run ios
```

Or manually:
```bash
npx expo start --ios --clear
```

The app will:
1. Start the Metro bundler
2. Open the iOS Simulator automatically
3. Build and launch the app

**First launch may take 1-2 minutes** while Metro bundles the JavaScript.

#### Android Emulator

```bash
npm run android
```

Make sure you have:
- Android Studio installed
- An Android emulator created and running

#### Web Browser (Limited Functionality)

```bash
npm run web
```

**Note**: SQLite features won't work in web mode - this is for UI testing only.

### 3. Development Server Commands

Once `expo start` is running, you can press:
- `i` - Open iOS simulator
- `a` - Open Android emulator
- `w` - Open in web browser
- `r` - Reload app
- `m` - Toggle menu
- `q` - Quit

## Troubleshooting

### npm install fails

**Error**: `ERESOLVE could not resolve`

**Solution**: Always use `--legacy-peer-deps`:
```bash
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps
```

### Port 8081 already in use

**Error**: `Port 8081 is running this app in another window`

**Solution**: Kill existing processes:
```bash
pkill -9 -f expo
pkill -9 -f node
npm run ios
```

### TypeScript errors

Check for compilation errors:
```bash
npx tsc --noEmit
```

### Clear Metro bundler cache

If you see weird runtime errors:
```bash
npx expo start --clear
```

Or manually:
```bash
rm -rf .expo node_modules/.cache
npm run ios
```

### Simulator not opening

Check available simulators:
```bash
xcrun simctl list devices available
```

Manually open a specific simulator:
```bash
open -a Simulator
# Then press 'i' in the Expo terminal
```

## Project Structure

```
/LiftMark2
├── app/                    # Expo Router screens
│   ├── (tabs)/            # Tab navigation
│   ├── modal/             # Modal screens
│   └── workout/           # Workout details
├── src/
│   ├── db/                # Database layer
│   ├── services/          # Business logic (Parser)
│   ├── stores/            # Zustand state
│   ├── types/             # TypeScript types
│   └── utils/             # Utilities
└── package.json
```

## Testing the App

### Import a Sample Workout

1. Launch the app
2. Tap "Import Workout" on the home screen
3. Paste this example:

```markdown
# Push Day A
@tags: push, chest, shoulders
@units: lbs

Bench Press
- 3x10 @135
- 3x8 @185
- @rest: 120s

Incline Dumbbell Press
- 3x12 @60
- @rpe: 8

Overhead Press
- 4x8 @95
```

4. Tap "Import"
5. Go to "Workouts" tab to see your imported workout
6. Tap the workout to view details

## Verified Working

✅ npm install with --legacy-peer-deps
✅ TypeScript compilation (npx tsc --noEmit)
✅ Expo dev server starts
✅ iOS Simulator launches
✅ Metro bundler completes
✅ App renders without errors

## Known Issues

- **React Native Screens warning**: Version 4.16.0 vs 4.19.0 - Does not affect functionality
- **Peer dependency conflicts**: Require `--legacy-peer-deps` flag - This is due to React 19.1.0 compatibility

## Sources

- [Expo SDK 54 Changelog](https://expo.dev/changelog/sdk-54)
- [Expo SDK 54 uses React 19.1.0 and React Native 0.81](https://medium.com/@shanavascruise/upgrading-to-expo-54-and-react-native-0-81-a-developers-survival-story-2f58abf0e326)
