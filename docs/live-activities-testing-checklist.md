# Live Activities Testing Checklist

## Issue Summary

Live Activities are being created and updated (logs confirm ActivityKit calls), but they're not visible in the iOS simulator.

## Configuration Verification

### ✅ App Configuration (app.json)

The following are correctly configured:

```json
"infoPlist": {
  "NSSupportsLiveActivities": true,
  "NSSupportsLiveActivitiesFrequentUpdates": true
}
```

```json
"plugins": [
  ["expo-live-activity", { "enablePushNotifications": false }]
]
```

### Check Native Configuration

After running `npx expo prebuild`, verify:

```bash
# Check Info.plist contains Live Activities support
cat ios/liftmark/Info.plist | grep -A 2 "NSSupportsLiveActivities"
```

**Expected output:**
```xml
<key>NSSupportsLiveActivities</key>
<true/>
<key>NSSupportsLiveActivitiesFrequentUpdates</key>
<true/>
```

### Check Widget Extension

```bash
# Check if widget extension exists
ls -la ios/liftmarkWidgetExtension/ 2>/dev/null || echo "Widget extension not found"

# Check widget's Info.plist
cat ios/liftmarkWidgetExtension/Info.plist 2>/dev/null | head -20
```

## Testing Procedure

### Phase 1: Prerequisites

- [ ] **iOS Version**: Simulator running iOS 16.2 or later (Live Activities require iOS 16.2+)
  ```bash
  xcrun simctl list devices | grep Booted
  ```

- [ ] **Device Type**: Use iPhone 14 Pro or iPhone 15 Pro for Dynamic Island support
  ```bash
  # Recommended simulators:
  # - iPhone 14 Pro (iOS 16.4+)
  # - iPhone 15 Pro (iOS 17.0+)
  ```

- [ ] **Development Build**: Must use development build, NOT Expo Go
  ```bash
  # Verify you're running a development build
  npx expo run:ios
  ```

- [ ] **Clean Build**: After any app.json changes, rebuild native code
  ```bash
  npx expo prebuild --clean
  npx expo run:ios
  ```

### Phase 2: Simulator Setup

- [ ] **Lock Simulator**: Press `Cmd+L` to lock the simulator
  - Live Activities appear on the lock screen
  - Dynamic Island appears when unlocked (iPhone 14 Pro+)

- [ ] **Wake Simulator**: Press `Cmd+L` again or click simulator screen
  - Observe if activity appears in Dynamic Island

- [ ] **Check Notification Center**: Swipe down from top of screen
  - Some Live Activities may appear here instead of Dynamic Island

### Phase 3: Logging Verification

When starting a workout, check Metro bundler logs for:

#### ✅ Expected Successful Logs

```
[LiveActivity] Module loaded successfully
[LiveActivity] Platform: ios 17.0
[LiveActivity] startWorkoutLiveActivity called
[LiveActivity] Session: Upper Body Workout | Exercise: Bench Press
[LiveActivity] Progress: 0 / 15
[LiveActivity] Starting with content: {"title":"Bench Press","subtitle":"Set 1/3 • 100 lbs × 10","progressBar":{"progress":0}}
[LiveActivity] Presentation: {"backgroundColor":"#1a1a1a","titleColor":"#ffffff","subtitleColor":"#a0a0a0","progressViewTint":"#4CAF50"}
[LiveActivity] ✅ Started successfully with ID: 8062D6F8-C9DE-40BE-B4AA-740DDFCD0263
[LiveActivity] Activity should now be visible on lock screen/Dynamic Island
```

#### ⚠️ Warning Signs

```
[LiveActivity] ⚠️ No activity ID returned from startActivity
```
**Action**: Activity was created but no ID returned. Check native logs.

#### ❌ Error Indicators

```
[LiveActivity] ❌ Failed to start: [error details]
[LiveActivity] Error name: [error name]
[LiveActivity] Error message: [error message]
```
**Action**: Native module error. Check Xcode console for details.

```
[LiveActivity] Not available, skipping start
```
**Action**: Module didn't load or iOS version too old.

```
[LiveActivity] Module not loaded, skipping start
```
**Action**: expo-live-activity module failed to import.

### Phase 4: Native Debugging (Xcode)

If logs show success but activity still not visible:

1. **Open Xcode Console**:
   ```bash
   # While app is running, open Xcode
   open ios/liftmark.xcworkspace
   ```

2. **Check Console for ActivityKit Logs**:
   - Window → Devices and Simulators
   - Select your running simulator
   - View console output
   - Filter for "ActivityKit" or "LiveActivity"

3. **Expected Native Logs**:
   ```
   [ActivityKit] Starting activity with id: <UUID>
   [ActivityKit] Presenting activity on lock screen
   [ActivityKit] Activity updated
   ```

4. **Native Error Indicators**:
   ```
   [ActivityKit] Failed to present: Activity type not found
   [ActivityKit] Widget extension not found
   [ActivityKit] Content state does not match expected type
   ```

### Phase 5: Known Simulator Issues

#### Issue 1: Simulator Display Bug (iOS 16.x)

**Symptoms**: Logs show success, native logs confirm presentation, but nothing visible.

**Workaround**:
1. Restart the simulator
2. Try a different simulator device (iPhone 14 Pro vs 15 Pro)
3. Test on a physical device

**Known Affected Versions**: iOS 16.2 - 16.4 have reported display bugs

#### Issue 2: Widget Extension Not Linked

**Symptoms**: Activity ID returned but native logs show "Widget extension not found"

**Solution**:
```bash
# Clean and rebuild native projects
rm -rf ios android
npx expo prebuild
npx expo run:ios
```

#### Issue 3: Dynamic Island Not Supported

**Symptoms**: Activity works on lock screen but not Dynamic Island

**Reason**: Only iPhone 14 Pro and newer support Dynamic Island

**Verification**:
- Lock simulator (`Cmd+L`) and check lock screen
- If visible on lock screen, Dynamic Island is not the issue

#### Issue 4: Simulator State Issues

**Symptoms**: Intermittent visibility, works sometimes but not always

**Solution**:
```bash
# Reset simulator
xcrun simctl shutdown all
xcrun simctl erase <device-udid>
# Or use: Device → Erase All Content and Settings
```

### Phase 6: Physical Device Testing

If simulator issues persist, test on physical device:

1. **Build for Device**:
   ```bash
   npx expo run:ios --device
   ```

2. **Select Physical Device**: When prompted, choose connected iPhone

3. **Verify Logs**: Check Metro bundler for same log patterns

4. **Expected Behavior**:
   - Lock screen: Activity visible above notifications
   - Dynamic Island: Activity pill visible when unlocked (iPhone 14 Pro+)
   - Tap activity: Should navigate to app

## Debugging Flowchart

```
Start workout in app
       ↓
Check Metro logs
       ↓
   [LiveActivity] ✅ Started successfully?
       ↓               ↓
      YES             NO → Check Prerequisites (Phase 1)
       ↓
Lock simulator (Cmd+L)
       ↓
Activity visible on lock screen?
       ↓               ↓
      YES             NO
       ↓               ↓
    SUCCESS    Check native logs (Phase 4)
                      ↓
               ActivityKit errors?
                      ↓               ↓
                     YES             NO
                      ↓               ↓
            Fix config issue    Simulator bug (Phase 5)
                                     ↓
                              Test on physical device
```

## Common Fixes

### Fix 1: Rebuild Native Code

After any configuration changes:
```bash
npx expo prebuild --clean
npx expo run:ios
```

### Fix 2: Clear Derived Data

If builds seem stale:
```bash
rm -rf ~/Library/Developer/Xcode/DerivedData
npx expo run:ios
```

### Fix 3: Update Expo Dependencies

Ensure latest expo-live-activity version:
```bash
npx expo install expo-live-activity@latest
npx expo prebuild --clean
```

### Fix 4: Verify Entitlements

Check `ios/liftmark/liftmark.entitlements`:
```xml
<key>com.apple.developer.activity-kit</key>
<true/>
```

If missing, the expo-live-activity plugin should add this automatically during prebuild.

## Success Criteria

✅ Live Activity is considered working when:

1. **Logs confirm**:
   - `[LiveActivity] ✅ Started successfully with ID: <UUID>`
   - No error logs during start/update/end

2. **Visual confirmation**:
   - Lock screen: Activity visible with title, subtitle, and progress bar
   - Dynamic Island (iPhone 14 Pro+): Activity pill visible when unlocked
   - Updates: Changes reflected in real-time

3. **Interactive**:
   - Tapping activity opens app
   - Activity dismisses when workout ends

## Reference Links

- [expo-live-activity GitHub](https://github.com/software-mansion-labs/expo-live-activity)
- [expo-live-activity Known Issues](https://github.com/software-mansion-labs/expo-live-activity/issues)
- [Apple ActivityKit Documentation](https://developer.apple.com/documentation/activitykit)
- [iOS Simulator Live Activities Support](https://developer.apple.com/forums/tags/live-activities)

## Troubleshooting Quick Reference

| Symptom | Likely Cause | Solution |
|---------|-------------|----------|
| Module not available log | expo-live-activity not installed | `npm install expo-live-activity` |
| No activity ID returned | Native module error | Check Xcode console |
| Success logs but not visible | Simulator display bug | Test on physical device or different simulator |
| Works on lock screen only | Not iPhone 14 Pro+ | Expected behavior (no Dynamic Island) |
| Intermittent visibility | Simulator state issue | Reset simulator |
| Widget extension not found | Prebuild didn't run | `npx expo prebuild --clean` |

---

**Document Version**: 1.0
**Last Updated**: 2026-01-11
**Maintained By**: furiosa (liftmark polecat)
