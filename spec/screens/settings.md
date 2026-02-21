# Settings Screen

## Purpose
Central configuration hub for the app. Manages appearance, workout preferences, gym/equipment, integrations (HealthKit, Live Activities, iCloud), AI assistance, data backup/restore, and app info.

## Route
`/(tabs)/settings` — Fourth tab in the bottom tab bar.

### Sub-routes (via settings/_layout.tsx Stack)
- `/settings/workout` — Workout Settings (units, timers, screen)
- `/settings/sync` — iCloud Sync settings
- `/settings/debug-logs` — Debug log viewer

## Layout
- **Body**: ScrollView with grouped sections
  1. **Header** — Title "Settings" + subtitle
  2. **Preferences** — Appearance (theme selector)
  3. **Workout** — Nav link to Workout Settings + Gym Management
  4. **Integrations** (iOS only) — iCloud Sync nav, HealthKit toggle, Live Activities toggle
  5. **AI Assistance** — Custom prompt text, API key management, button options
  6. **Data Management** — Backup export/import
  7. **Developer** (non-DEV only) — Debug Logs nav link
  8. **About** — Version + Build info

## UI Elements

| Element | testID | Type |
|---------|--------|------|
| Loading state | `settings-loading` | View |
| Screen container | `settings-screen` | ScrollView |
| Theme: Light | `button-theme-light` | TouchableOpacity |
| Theme: Dark | `button-theme-dark` | TouchableOpacity |
| Theme: Auto | `button-theme-auto` | TouchableOpacity |
| Workout Settings nav | `workout-settings-button` | TouchableOpacity |
| Gym item | `gym-item` | TouchableOpacity |
| Set default gym | `set-default-{gym.id}` | TouchableOpacity |
| Add gym button | `add-gym-button` | TouchableOpacity |
| iCloud Sync nav | `sync-settings-button` | TouchableOpacity |
| HealthKit switch | `switch-healthkit` | Switch |
| Live Activities switch | `switch-live-activities` | Switch |
| Custom prompt input | `input-custom-prompt` | TextInput |
| API key input | `input-api-key` | TextInput |
| Toggle API key visibility | `toggle-api-key-visibility` | TouchableOpacity |
| Save API key | `save-api-key-button` | TouchableOpacity |
| Remove API key | `remove-api-key-button` | TouchableOpacity |
| Open Claude console | `open-claude-button` | TouchableOpacity |
| Show Open in Claude toggle | `switch-show-open-in-claude` | Switch |
| Button options section | `button-options-section` | View |
| Debug logs nav | `debug-logs-button` | TouchableOpacity |

## Data Dependencies
- **settingsStore**: `settings`, `loadSettings`, `updateSettings`
- **gymStore**: `gyms`, `defaultGym`, `loadGyms`, `addGym`, `setDefaultGym`
- **workoutPlanStore**: `loadPlans`
- **equipmentStore**: `loadEquipment`
- **healthKitService**: `isHealthKitAvailable()`, `requestHealthKitAuthorization()`
- **liveActivityService**: `isLiveActivityAvailable()`
- **databaseBackupService**: `exportDatabase()`, `importDatabase()`, `validateDatabaseFile()`
- **expo-sharing**: `shareAsync()`
- **expo-document-picker**: `getDocumentAsync()`

## User Interactions
- **Tap theme segment** → updates theme to light/dark/auto
- **Tap Workout Settings** → navigates to `/settings/workout`
- **Tap gym item** → navigates to `/gym/{gym.id}`
- **Tap star on non-default gym** → sets as default gym
- **Tap Add Gym** → Alert.prompt for gym name → creates gym → navigates to `/gym/{newGym.id}`
- **Tap iCloud Sync** → navigates to `/settings/sync`
- **Toggle HealthKit** → requests authorization, shows alert on failure
- **Toggle Live Activities** → updates setting directly
- **Edit custom prompt** → saves on blur
- **Enter API key + Save** → validates `sk-ant-` prefix, saves securely
- **Remove API key** → confirmation alert → removes key
- **Tap Open in Claude** → opens `https://console.anthropic.com`
- **Export Database** → exports + share sheet
- **Import Database** → document picker → validation → confirmation alert → imports + reloads all stores
- **Tap Debug Logs** → navigates to `/settings/debug-logs`

## Navigation
- `/settings/workout` — workout settings
- `/settings/sync` — iCloud sync
- `/settings/debug-logs` — debug logs
- `/gym/{id}` — gym detail

## State
- `promptText` — local state for custom prompt editing
- `apiKey` — local state for API key input
- `showApiKey` — toggle API key visibility
- `isExporting` / `isImporting` — loading states for backup operations

## Error/Empty States
- **Settings not loaded**: LoadingView with "Loading settings..."
- **Error from settings/gym store**: Alert dialog
- **Invalid API key format**: Alert "Anthropic API keys must start with sk-ant-..."
- **Invalid database file**: Alert "Selected file is not a valid LiftMark database"
- **Export/import failure**: Alert with error message

---

## Sub-screen: Workout Settings

### Route: `/settings/workout`

### Purpose
Configure weight units, rest timer behavior, and screen preferences.

### UI Elements

| Element | testID | Type |
|---------|--------|------|
| Screen container | `workout-settings-screen` | View |
| LBS button | `button-unit-lbs` | TouchableOpacity |
| KG button | `button-unit-kg` | TouchableOpacity |
| Workout timer switch | `switch-workout-timer` | Switch |
| Auto-start rest timer switch | `switch-auto-start-rest` | Switch |
| Keep screen awake switch | `switch-keep-screen-awake` | Switch |

### Data Dependencies
- **settingsStore**: `settings`, `loadSettings`, `updateSettings`

---

## Sub-screen: iCloud Sync

### Route: `/settings/sync`

### Purpose
Experimental iCloud sync configuration. Check CloudKit status, toggle sync.

### UI Elements
- Check Status button, Enable Sync switch, CloudKit Test Screen button
- Status badge showing: iCloud Available / No iCloud Account / Error / etc.

### Data Dependencies
- **cloudKitService** (dynamically imported): `getAccountStatus()`

---

## Sub-screen: Debug Logs

### Route: `/settings/debug-logs`

### Purpose
View, filter, and export application logs for troubleshooting production issues.

### UI Elements

| Element | testID | Type |
|---------|--------|------|
| Screen container | `debug-logs-screen` | View |
| Actions bar | `debug-logs-actions` | View |
| Export button | `debug-logs-export` | TouchableOpacity |
| Clear button | `debug-logs-clear` | TouchableOpacity |
| Loading state | `debug-logs-loading` | View |
| Logs list | `debug-logs-list` | ScrollView |
| Empty state | `debug-logs-empty` | Text |

### Data Dependencies
- **logger**: `getLogs()`, `getLogStats()`, `exportLogs()`, `clearLogs()`, `getDeviceInformation()`
- **navigationLogger**: `exportHistory()`, `clearHistory()`
- **@react-native-clipboard/clipboard**: `setString()`
