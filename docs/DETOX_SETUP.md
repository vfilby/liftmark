# Detox E2E Testing Setup

## ✅ Setup Complete

Detox is now installed and configured for end-to-end testing on iOS simulator.

## 📦 What Was Installed

- **detox@20.47.0** - E2E testing framework
- **jest-circus@30.2.0** - Test runner (compatible with Detox 20)

## 📁 Configuration Files

### `.detoxrc.js`
- Updated to modern Detox 20 config format
- Configured for iOS iPhone 15 simulator
- Build command uses xcodebuild directly

### `e2e/jest.config.js`
- Configured for Detox test environment
- Uses Jest Circus runner
- 120s test timeout
- Single worker (maxWorkers: 1)

### `e2e/environment.js` (NEW)
- Custom Detox CircusEnvironment
- Handles test initialization and cleanup

### `e2e/init.js`
- Simplified (initialization now in environment)

### `e2e/smoke.test.js`
- Updated with better wait logic
- Uses `waitFor()` with 30s timeout
- Fallback element checking

## 📜 NPM Scripts Added

```json
{
  "e2e:prebuild": "expo prebuild --platform ios --clean",
  "e2e:build": "detox build --configuration ios.sim.debug",
  "e2e:test": "detox test --configuration ios.sim.debug",
  "e2e:test:smoke": "detox test --configuration ios.sim.debug e2e/smoke.test.js"
}
```

## 🚀 Running Tests

### First Time Setup

1. **Build the app:**
   ```bash
   npm run e2e:build
   ```
   This takes ~5-10 minutes and only needs to be done once (or when native code changes).

2. **Start Metro bundler:**
   ```bash
   npm start
   ```
   Keep this running in a separate terminal.

3. **Run tests:**
   ```bash
   npm run e2e:test:smoke
   ```

### Subsequent Test Runs

Just keep Metro running and run:
```bash
npm run e2e:test
```

## ✅ Test Results

**Smoke Test Status:** ✅ PASSING

```
PASS e2e/smoke.test.js (39.025s)
  Smoke
    ✓ app launches and shows home screen (30405ms)

Test Suites: 1 passed, 1 total
Tests:       1 passed, 1 total
```

### What the Smoke Test Verifies
- App launches successfully on iPhone 15 simulator
- JavaScript bundle loads from Metro
- Database initializes
- Home screen renders with testID="home-screen"
- No critical crashes during app initialization

## 📊 Current E2E Test Files

1. **e2e/smoke.test.js** ✅ PASSING
   - Basic app launch verification

2. **e2e/tabs.e2e.js** ⏸️ NOT UPDATED
   - Tab navigation tests
   - Needs updating for new nomenclature (WorkoutPlan)

3. **e2e/workout-flow.e2e.js** ⏸️ NOT UPDATED
   - Full workout flow tests
   - Needs updating for new nomenclature

4. **e2e/detail-settings.e2e.js** ⏸️ NOT UPDATED
   - Detail and settings tests
   - Needs updating for new nomenclature

## ⚠️ Important Notes

### Metro Bundler Required
For Debug builds, Metro bundler MUST be running (`npm start`). Without it, the app shows a red box error: "No script URL provided."

### Alternative: Release Build
For CI/CD or standalone testing, build a Release version with embedded bundle:
```bash
# Update .detoxrc.js to add ios.release configuration
# Then build release version
npm run e2e:build:release
```

### Simulator Configuration
Tests run on **iPhone 15** simulator (iOS 18.0+). To change:
1. Edit `.detoxrc.js`
2. Change `device.type` under devices.simulator
3. Rebuild: `npm run e2e:build`

## 🔧 Troubleshooting

### "No script URL provided" Error
**Solution:** Start Metro bundler with `npm start`

### Test Timeouts
**Solution:** The smoke test uses a 30s timeout for first element. App initialization (database, settings) takes time.

### Build Failures
**Solution:**
```bash
# Clean and rebuild
rm -rf ios/build
npm run e2e:build
```

### Simulator Not Found
**Solution:**
```bash
# List available simulators
xcrun simctl list devices available

# Update .detoxrc.js with available device
```

## 📈 Next Steps

### Update Existing Tests
The following tests need updating for the WorkoutPlan nomenclature:
- Search for `workout-list` → update to reflect new testIDs
- Update `workouts.length` checks → `plans.length`
- Update navigation paths if changed

### Add More Tests
Recommended test scenarios:
- ✅ App launch (smoke test)
- ⏸️ Tab navigation
- ⏸️ Import workout plan from markdown
- ⏸️ Start workout from plan
- ⏸️ Complete workout and view summary
- ⏸️ View workout history
- ⏸️ Settings configuration

### CI/CD Integration
For GitHub Actions:
1. Add macOS runner
2. Install dependencies
3. Build app
4. Run tests with Metro
5. Upload test artifacts

Example workflow:
```yaml
- name: Build Detox
  run: npm run e2e:build

- name: Run E2E Tests
  run: |
    npm start &
    sleep 20
    npm run e2e:test
```

## 📚 Resources

- [Detox Documentation](https://wix.github.io/Detox/)
- [Detox 20 Migration Guide](https://wix.github.io/Detox/docs/guide/migration)
- [Jest Configuration](https://jestjs.io/docs/configuration)
- [Expo + Detox](https://docs.expo.dev/build-reference/e2e-tests/)

## ✨ Summary

Detox E2E testing is now fully configured and working! The smoke test passes successfully, verifying that:
- The iOS app builds correctly
- The app launches without crashing
- The home screen renders properly
- All core initialization completes successfully

You now have a solid foundation for writing comprehensive E2E tests for your fitness tracking app.
