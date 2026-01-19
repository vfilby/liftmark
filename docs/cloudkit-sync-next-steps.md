# CloudKit Sync - Next Steps

## Implementation Status: ✅ Complete (Phases 1-4)

All core CloudKit sync functionality has been implemented. The following steps are needed to integrate and test.

---

## 1. Build & Prebuild (Required)

```bash
# Generate native iOS project with CloudKit module
npx expo prebuild --clean

# Install CocoaPods dependencies
cd ios && pod install && cd ..

# Build for iOS
npx expo run:ios
```

**What to verify:**
- CloudKit module compiles without errors
- No Swift/Objective-C compilation issues
- App launches successfully

---

## 2. Initialize Sync on App Startup

**File:** `/app/_layout.tsx` (or wherever app initialization happens)

Add sync initialization:

```typescript
import { useSyncStore } from '@/stores/syncStore';
import { registerBackgroundSyncTask } from '@/services/backgroundSyncService';
import { useEffect } from 'react';

// In your root component
useEffect(() => {
  // Load sync state
  useSyncStore.getState().loadSyncState();

  // Register background sync task
  registerBackgroundSyncTask();
}, []);
```

---

## 3. Add Sync Status Indicator to UI

**Recommended location:** Header/navbar of main screens

Example for `/app/(tabs)/_layout.tsx`:

```typescript
import SyncStatusIndicator from '@/components/SyncStatusIndicator';

// In header component
<Stack.Screen
  options={{
    headerRight: () => <SyncStatusIndicator size={24} />,
  }}
/>
```

---

## 4. Add Sync Error Banner to Screens

**Recommended location:** Top of main screens (workouts list, session screen)

Example:

```typescript
import SyncErrorBanner from '@/components/SyncErrorBanner';

// At top of screen render
<View>
  <SyncErrorBanner />
  {/* Rest of content */}
</View>
```

---

## 5. Testing Checklist

### Basic Functionality
- [ ] App builds and runs without errors
- [ ] CloudKit module loads correctly
- [ ] Settings → iCloud Sync screen opens
- [ ] Can enable/disable sync toggle

### Two-Device Sync Test
**Setup:** Two iOS devices (or simulator + device) signed into same iCloud account

1. **Device A - Enable Sync:**
   - [ ] Open Settings → iCloud Sync
   - [ ] Toggle "Enable iCloud Sync" ON
   - [ ] Verify "Ready to Sync" message appears
   - [ ] Tap "Sync Now"
   - [ ] Verify sync completes without errors

2. **Device A - Create Workout:**
   - [ ] Create a new workout template
   - [ ] Wait 5 seconds (debounce delay)
   - [ ] Verify sync status shows "Syncing..." then "Up to date"
   - [ ] Check "Pending Changes" shows 0

3. **Device B - Enable Sync:**
   - [ ] Open Settings → iCloud Sync
   - [ ] Toggle "Enable iCloud Sync" ON
   - [ ] Tap "Sync Now"
   - [ ] Verify it downloads the workout from Device A

4. **Device B - Edit Workout:**
   - [ ] Edit the synced workout
   - [ ] Wait for sync to complete
   - [ ] Verify changes sync to Device A

5. **Delete Test:**
   - [ ] Delete workout on Device A
   - [ ] Wait for sync
   - [ ] Verify workout disappears on Device B

### Offline/Recovery Test
- [ ] Enable airplane mode on Device A
- [ ] Create workout while offline
- [ ] Verify "Offline" status appears
- [ ] Disable airplane mode
- [ ] Verify sync resumes automatically
- [ ] Verify workout appears on Device B

### Conflict Resolution Test
- [ ] Enable airplane mode on both devices
- [ ] Edit same workout differently on each device
- [ ] Disable airplane mode on both
- [ ] Wait for sync
- [ ] Verify last-write-wins resolution
- [ ] Check Settings → iCloud Sync → Sync Conflicts for log entry

### Background Sync Test
- [ ] Create workout on Device A
- [ ] Background app on Device B
- [ ] Wait 15-20 minutes
- [ ] Foreground Device B
- [ ] Verify workout appears (background sync worked)

### Error Handling Test
- [ ] Sign out of iCloud on device
- [ ] Try to enable sync
- [ ] Verify error message appears
- [ ] Sign back into iCloud
- [ ] Verify sync can be enabled

---

## 6. CloudKit Dashboard Verification

1. Open [CloudKit Dashboard](https://icloud.developer.apple.com/dashboard)
2. Select your app: `com.eff3.liftmark`
3. Navigate to Development → Data
4. Verify custom zone: `LiftMarkZone`
5. Check record types exist:
   - `WorkoutTemplate`
   - `TemplateExercise`
   - `TemplateSet`
   - `WorkoutSession`
   - `SessionExercise`
   - `SessionSet`

---

## 7. Performance Optimization (Future)

Once basic sync is working, consider:

1. **Batch Upload:**
   - Currently uploads one record at a time
   - Implement batching for initial sync (up to 400 records)

2. **Pagination:**
   - For users with 100+ workouts
   - Implement cursor-based pagination in queries

3. **Soft Deletes:**
   - Add `isDeleted` flag to records
   - Implement 30-day retention before permanent deletion

4. **Asset Handling:**
   - For large sourceMarkdown fields (>100KB)
   - Use CKAsset instead of string fields

---

## 8. Known Limitations

1. **iOS Only:** CloudKit is Apple-exclusive, no Android support
2. **iCloud Required:** Users must be signed into iCloud
3. **Network Required:** Initial sync requires internet
4. **400 Record Limit:** CloudKit batch operations limited to 400 records
5. **Rate Limiting:** CloudKit has rate limits, implement exponential backoff

---

## 9. Troubleshooting

### Module Not Found Error
```bash
# Clean and rebuild
rm -rf node_modules ios/Pods ios/build
npm install
cd ios && pod install && cd ..
npx expo prebuild --clean
```

### Sync Not Working
1. Check CloudKit Dashboard for records
2. View sync conflicts: Settings → iCloud Sync → Sync Conflicts
3. Check Xcode console for CloudKit errors
4. Verify iCloud entitlements in Xcode

### "Account Not Available" Error
- User not signed into iCloud
- iCloud Drive disabled in Settings
- Network connection issues

---

## 10. Future Enhancements

- **Sync Progress Indicator:** Show detailed progress during initial sync
- **Selective Sync:** Allow users to choose what to sync (templates only, sessions only, etc.)
- **Conflict Resolution UI:** Let users manually resolve conflicts
- **Sync Statistics:** Show detailed sync stats (data usage, sync frequency, etc.)
- **Export/Import:** Backup/restore functionality independent of CloudKit
- **Shared Workouts:** CloudKit shared database for workout templates

---

## Files Created/Modified

### New Files (27 total):
- `modules/expo-cloudkit/ios/ExpoCloudKitModule.swift`
- `modules/expo-cloudkit/src/index.ts`
- `modules/expo-cloudkit/src/types.ts`
- `modules/expo-cloudkit/package.json`
- `modules/expo-cloudkit/expo-module.config.json`
- `src/services/cloudKitService.ts`
- `src/services/syncService.ts`
- `src/services/backgroundSyncService.ts`
- `src/db/syncMetadataRepository.ts`
- `src/stores/syncStore.ts`
- `src/components/SyncStatusIndicator.tsx`
- `src/components/SyncErrorBanner.tsx`
- `app/settings/sync.tsx`
- `app/settings/sync-conflicts.tsx`
- `app/modal/sync-setup.tsx`

### Modified Files (3 total):
- `src/db/index.ts` - Added sync table migrations
- `src/db/repository.ts` - Added sync hooks
- `src/db/sessionRepository.ts` - Added sync hooks
- `app/(tabs)/settings.tsx` - Added iCloud Sync section

---

## Support & Documentation

- **CloudKit Documentation:** https://developer.apple.com/icloud/cloudkit/
- **Expo Task Manager:** https://docs.expo.dev/versions/latest/sdk/task-manager/
- **Expo Background Fetch:** https://docs.expo.dev/versions/latest/sdk/background-fetch/

---

**Status:** Ready for integration testing
**Estimated Time to Complete:** 2-4 hours of testing
**Priority:** High (core feature for multi-device users)
