# iPad Layout Specification

> Defines how each screen adapts from iPhone to iPad. The goal is to use iPad screen real estate effectively rather than simply stretching the iPhone layout.

## Design Principles

1. **Content width constraint** — On iPad, constrain primary content to a max width (800px) and center it, unless using a split layout. This prevents text lines and cards from stretching uncomfortably wide.
2. **Split views for list+detail** — Screens with a list and a detail view use side-by-side split layout on iPad (already implemented for Workouts and History).
3. **Multi-column grids** — Where the iPhone shows a single column of cards, iPad can show 2 columns.
4. **Larger touch targets and spacing** — iPad uses larger padding, font sizes, and spacing via the responsive utilities.
5. **Landscape support** — All screens support both portrait and landscape on iPad. Layouts reflow appropriately.
6. **No iPad-only features** — iPad layouts are the same features, better arranged. No iPad-exclusive UI.

## Breakpoints

| Device | Width | `isTablet` |
|--------|-------|------------|
| iPhone (any) | < 768px | `false` |
| iPad Portrait | 768–1024px | `true` |
| iPad Landscape | 1024–1366px | `true` |

## Screen-by-Screen Wireframes

---

### Home Screen (`/(tabs)/index`)

**iPhone (current)**:
```
┌──────────────────────┐
│  LiftMark        Home│  ← tab header
├──────────────────────┤
│ ┌──────────────────┐ │
│ │ ▶ Resume: Push A │ │  ← resume banner (conditional)
│ └──────────────────┘ │
│                      │
│  Max Lifts           │
│ ┌────────┬─────────┐ │
│ │ Squat  │ Deadlift│ │  ← 2x2 grid
│ │ 315lbs │ 405lbs  │ │
│ ├────────┼─────────┤ │
│ │ Bench  │ OHP     │ │
│ │ 225lbs │ 135lbs  │ │
│ └────────┴─────────┘ │
│                      │
│  Recent Plans        │
│ ┌──────────────────┐ │
│ │ Push Day         │ │  ← plan cards (up to 3)
│ └──────────────────┘ │
│ ┌──────────────────┐ │
│ │ Pull Day         │ │
│ └──────────────────┘ │
│ ┌──────────────────┐ │
│ │ Leg Day          │ │
│ └──────────────────┘ │
│                      │
│ [ + Create Plan ]    │
└──────────────────────┘
│  🏠   📋   🏋   ⚙  │  ← tab bar
└──────────────────────┘
```

**iPad Portrait**:
```
┌────────────────────────────────────────────┐
│  LiftMark                             Home │
├────────────────────────────────────────────┤
│  ┌──────────────────────┐                  │
│  │ ▶ Resume: Push Day A │                  │  ← compact card (not full-width)
│  │   6/28 sets          │                  │
│  └──────────────────────┘                  │
│                                            │
│          Max Lifts                         │
│  ┌──────────┬──────────┬──────────┬──────────┐
│  │  Squat   │ Deadlift │  Bench   │   OHP    │  ← 4-across row on iPad
│  │  315 lbs │  405 lbs │  225 lbs │  135 lbs │
│  │  ╱╲╱╲╱╱  │  ╱╱╱╱╱╲  │  ╲╱╱╲╱╱  │  ──╱──   │  ← sparklines (trend)
│  └──────────┴──────────┴──────────┴──────────┘
│                                            │
│          Recent Plans                      │
│  ┌──────────────────┐ ┌──────────────────┐ │
│  │ Push Day         │ │ Pull Day         │ │  ← 2-column grid
│  │ strength, upper  │ │ strength, back   │ │
│  └──────────────────┘ └──────────────────┘ │
│  ┌──────────────────┐                      │
│  │ Leg Day          │  [ + Create Plan ]   │
│  │ strength, lower  │                      │
│  └──────────────────┘                      │
│                                            │
└────────────────────────────────────────────┘
│  🏠      📋      🏋      ⚙               │
└────────────────────────────────────────────┘
```

**iPad Landscape**:
```
┌──────────────────────────────────────────────────────────────┐
│  LiftMark                                               Home│
├──────────────────────────────────────────────────────────────┤
│  ┌──────────────────────┐                                    │
│  │ ▶ Resume: Push Day A │                                    │
│  └──────────────────────┘                                    │
│                                                              │
│               Max Lifts                                      │
│   ┌──────────┬──────────┬──────────┬──────────┐              │
│   │  Squat   │ Deadlift │  Bench   │   OHP    │              │
│   │  315 lbs │  405 lbs │  225 lbs │  135 lbs │              │
│   │  ╱╲╱╲╱╱  │  ╱╱╱╱╱╲  │  ╲╱╱╲╱╱  │  ──╱──   │              │
│   └──────────┴──────────┴──────────┴──────────┘              │
│                                                              │
│               Recent Plans                                   │
│   ┌─────────────────┐ ┌─────────────────┐ ┌────────────────┐│
│   │ Push Day        │ │ Pull Day        │ │ Leg Day        ││
│   │ strength, upper │ │ strength, back  │ │ strength, lower││
│   └─────────────────┘ └─────────────────┘ └────────────────┘│
│                                                              │
│   [ + Create Plan ]                                          │
└──────────────────────────────────────────────────────────────┘
```

**Changes from iPhone**:
- Max Lifts: 2x2 grid → 4-across single row with sparklines showing max weight trend over the last 6 sessions. Sparklines justify the wider tiles by conveying trend data at a glance.
- Resume banner: compact inline card (not full-width). On iPhone, the full-width banner works because the screen is narrow. On iPad, it becomes a smaller tappable card that doesn't dominate the layout.
- Recent Plans: single column → 2-column grid (portrait) or 3-column (landscape)
- Content centered with max-width constraint (800px)
- "Create Plan" button stays inline at end of content

---

### Workouts Screen (`/(tabs)/workouts`)

**iPhone (current)**:
```
┌──────────────────────┐
│  Plans          Plans │
├──────────────────────┤
│ [🔍 Search plans...] │
│ [▼ Show Filters    ] │
│                      │
│ ┌──────────────────┐ │
│ │ Push Day     ♥   │ │
│ │ strength, upper  │ │
│ │ 6 exercises      │ │
│ └──────────────────┘ │
│ ┌──────────────────┐ │
│ │ Pull Day     ♥   │ │
│ │ strength, back   │ │
│ │ 5 exercises      │ │
│ └──────────────────┘ │
│        ...           │
└──────────────────────┘
```

**iPad (portrait & landscape) — already implemented as SplitView**:
```
┌────────────────────────────────────────────┐
│  Plans                                Plans│
├──────────────┬─────────────────────────────┤
│ [🔍 Search ] │                             │
│ [▼ Filters ] │    Push Day            ♥    │
│              │    strength, upper           │
│ ┌──────────┐ │                             │
│ │▸Push Day │ │    Stats: 6 ex · 18 sets    │
│ └──────────┘ │                             │
│ ┌──────────┐ │    ── Exercises ──          │
│ │ Pull Day │ │    1. Bench Press           │
│ └──────────┘ │       135x5, 185x5, 225x5  │
│ ┌──────────┐ │    2. Incline DB Press      │
│ │ Leg Day  │ │       60x8, 60x8, 60x8     │
│ └──────────┘ │    ...                      │
│              │                             │
│              │  [ Start Workout ]          │
│  35%         │              65%            │
├──────────────┴─────────────────────────────┤
```

**Status**: Already implemented. Minor refinements:
- Left pane cards should use theme-aware divider color (currently hardcoded `#e0e0e0`)
- Selected card highlight should use `colors.primaryLight` background, not just border

---

### History Screen (`/(tabs)/history`)

**iPhone (current)**:
```
┌──────────────────────┐
│  History       [↗]   │
├──────────────────────┤
│ ┌──────────────────┐ │
│ │ Push Day         │ │
│ │ Today · 45m      │ │
│ │ 18 sets · 6 ex   │ │
│ └──────────────────┘ │
│ ┌──────────────────┐ │
│ │ Leg Day          │ │
│ │ Yesterday · 55m  │ │
│ │ 15 sets · 5 ex   │ │
│ └──────────────────┘ │
└──────────────────────┘
```

**iPad — already implemented as SplitView**:
```
┌────────────────────────────────────────────┐
│  History                            [↗]    │
├──────────────┬─────────────────────────────┤
│              │                             │
│ ┌──────────┐ │   Push Day                  │
│ │▸Push Day │ │   March 1, 2026 · 45 min   │
│ │ Today 45m│ │                             │
│ └──────────┘ │   Exercise History Charts   │
│ ┌──────────┐ │   ┌───────────────────────┐ │
│ │ Leg Day  │ │   │ Bench Press 📈        │ │
│ │ Yest 55m │ │   │ 225lbs (PR!)          │ │
│ └──────────┘ │   └───────────────────────┘ │
│              │                             │
│              │   Exercises:                │
│              │   1. Bench Press 3/3 ✓      │
│              │   2. Incline Press 3/3 ✓    │
│  35%         │              65%            │
├──────────────┴─────────────────────────────┤
```

**Status**: Already implemented. Same minor refinements as Workouts split view (theme-aware colors).

---

### Active Workout Screen (`/workout/active`)

**iPhone (current)**:
```
┌──────────────────────┐
│ ⏸ Push Day    [+][✓] │  ← custom header
│ ████████░░░░ 8/18    │  ← progress bar
├──────────────────────┤
│                      │
│ 1. Bench Press    🔗 │
│ ┌──────────────────┐ │
│ │ ✓ 135 lbs x 5   │ │  ← completed
│ │ ✓ 185 lbs x 5   │ │  ← completed
│ │ ► [225] x [5]    │ │  ← active set
│ │   [Skip] [Done ✓]│ │
│ │ · 225 lbs x 5    │ │  ← pending
│ └──────────────────┘ │
│                      │
│ 2. Incline Press  🔗 │
│ ┌──────────────────┐ │
│ │ · 60 lbs x 8    │ │
│ │ · 60 lbs x 8    │ │
│ │ · 60 lbs x 8    │ │
│ └──────────────────┘ │
└──────────────────────┘
```

**iPad Portrait** — centered with max-width, larger inputs:
```
┌────────────────────────────────────────────┐
│  ⏸  Push Day                     [+]  [✓] │
│  ████████████░░░░░░░░░░░ 8/18 sets         │
├────────────────────────────────────────────┤
│                                            │
│      1. Bench Press                   🔗   │
│      ┌──────────────────────────────┐      │
│      │ ✓  135 lbs × 5              │      │
│      │ ✓  185 lbs × 5              │      │
│      │ ►  [ 225 ]  ×  [ 5 ]        │      │  ← wider inputs
│      │    [  Skip  ]  [ Complete ✓ ]│      │  ← full-word buttons
│      │ ·  225 lbs × 5              │      │
│      └──────────────────────────────┘      │
│                                            │
│      2. Incline Dumbbell Press        🔗   │
│      ┌──────────────────────────────┐      │
│      │ ·  60 lbs × 8               │      │
│      │ ·  60 lbs × 8               │      │
│      │ ·  60 lbs × 8               │      │
│      └──────────────────────────────┘      │
│                                            │
│         ← max-width: 800 centered →        │
└────────────────────────────────────────────┘
```

**iPad Landscape** — two-column layout with exercise list + history side panel:
```
┌──────────────────────────────────────────────────────────────┐
│  ⏸  Push Day                                       [+]  [✓] │
│  ████████████░░░░░░░░░░░ 8/18 sets                           │
├───────────────────────────────────┬──────────────────────────┤
│                                   │                          │
│  1. Bench Press              🔗   │  Exercise History        │
│  ┌─────────────────────────────┐  │  ┌────────────────────┐  │
│  │ ✓  135 lbs × 5             │  │  │ Bench Press 📈     │  │
│  │ ✓  185 lbs × 5             │  │  │                    │  │
│  │ ►  [ 225 ] × [ 5 ]        │  │  │  225─┐             │  │
│  │    [  Skip  ] [ Done ✓ ]   │  │  │  185─┤  ┌──        │  │
│  │ ·  225 lbs × 5             │  │  │  135─┘──┘          │  │
│  └─────────────────────────────┘  │  │  Feb  Mar  Apr    │  │
│                                   │  └────────────────────┘  │
│  2. Incline Press            🔗   │                          │
│  ┌─────────────────────────────┐  │  Last Session:           │
│  │ ·  60 lbs × 8              │  │  225 × 5, 225 × 4       │
│  │ ·  60 lbs × 8              │  │  225 × 4                 │
│  │ ·  60 lbs × 8              │  │                          │
│  └─────────────────────────────┘  │  PR: 245 lbs (Jan 15)   │
│                                   │                          │
│           ~60%                    │        ~40%              │
├───────────────────────────────────┴──────────────────────────┤
```

**Changes from iPhone**:
- **Portrait**: Content constrained to max-width 800, centered. Buttons show full text ("Complete" not just "✓"). Input fields are wider.
- **Landscape**: Two-column layout. Left column = exercise list (scrollable). Right column = exercise history panel showing chart and past performance for the currently active exercise. This replaces the bottom sheet that overlays on iPhone. The history panel updates as the user moves through exercises.
- **Landscape history panel**: Shows the same content as `ExerciseHistoryBottomSheet` but inline. Includes the line chart, last session data, and PR info.

---

### Workout Detail Screen (`/workout/[id]`)

**iPhone**: Full screen push navigation with ScrollView.

**iPad**: This screen is only shown on phone. On iPad, the detail is rendered inside the SplitView right pane on the Workouts tab (already implemented via `WorkoutDetailView`).

No changes needed — the split view handles this.

---

### Settings Screen (`/(tabs)/settings`)

**iPhone (current)**:
```
┌──────────────────────┐
│  Settings    Settings │
├──────────────────────┤
│                      │
│  Preferences         │
│ ┌──────────────────┐ │
│ │ [Light|Dark|Auto]│ │
│ └──────────────────┘ │
│                      │
│  Workout             │
│ ┌──────────────────┐ │
│ │ Workout Settings>│ │
│ └──────────────────┘ │
│                      │
│  Gyms                │
│ ┌──────────────────┐ │
│ │ ★ Home Gym     > │ │
│ │ + Add Gym        │ │
│ └──────────────────┘ │
│                      │
│  Integrations        │
│ ┌──────────────────┐ │
│ │ iCloud Sync    > │ │
│ │ HealthKit    [⊙] │ │
│ │ Live Act.    [⊙] │ │
│ └──────────────────┘ │
│       ...            │
└──────────────────────┘
```

**iPad (portrait & landscape)** — split view with nav list + detail pane:
```
┌────────────────────────────────────────────┐
│  Settings                         Settings │
├──────────────┬─────────────────────────────┤
│              │                             │
│  Settings    │  Workout Settings           │
│              │                             │
│ ┌──────────┐ │  Units                      │
│ │  Theme   │ │  ┌───────────────────────┐  │
│ └──────────┘ │  │ Weight Unit  [LBS|KG] │  │
│ ┌──────────┐ │  └───────────────────────┘  │
│ │▸Workout  │ │                             │
│ │ Settings │ │  Timer                      │
│ └──────────┘ │  ┌───────────────────────┐  │
│ ┌──────────┐ │  │ Auto-start rest  [⊙]  │  │
│ │  Gyms    │ │  │ Workout timer    [⊙]  │  │
│ └──────────┘ │  └───────────────────────┘  │
│ ┌──────────┐ │                             │
│ │ iCloud   │ │  Screen                     │
│ │ Health   │ │  ┌───────────────────────┐  │
│ └──────────┘ │  │ Keep awake       [ ]  │  │
│ ┌──────────┐ │  └───────────────────────┘  │
│ │  AI      │ │                             │
│ └──────────┘ │                             │
│ ┌──────────┐ │                             │
│ │  Data    │ │                             │
│ │  About   │ │                             │
│ └──────────┘ │                             │
│              │                             │
│  ~280px      │     remaining width         │
├──────────────┴─────────────────────────────┤
│  🏠      📋      🏋      ⚙               │
└────────────────────────────────────────────┘
```

**Changes from iPhone**:
- Split view layout (like iOS Settings on iPad): left pane has a scrollable navigation list (~280px fixed width), right pane shows the detail content for the selected category
- No sub-screen push navigation on iPad — selecting a settings category updates the right pane inline
- Each settings section (Theme, Workout Settings, Gyms, iCloud Sync, AI Assistance, Data Management, About) is a selectable row in the left pane
- Right pane content fills remaining width — no need for a max-width constraint since the split pane itself constrains width
- iPhone behavior is unchanged — still uses push navigation for sub-screens

---

### Import Modal (`/modal/import`)

**iPhone**: Full-height modal with text input area.

**iPad**: Modal presentation with constrained width (max 600px), centered. Standard iOS modal behavior on iPad already shows a card-style presentation rather than full-screen.

No wireframe changes needed — iOS handles modal sizing on iPad naturally.

---

### Workout Summary (`/workout/summary`)

**iPhone**: Full-screen summary with stats and highlights.

**iPad**: Same layout, constrained to max-width 800px and centered. Stats grid can use wider cards.

Minimal changes — apply max-width constraint.

---

## Implementation Details

### SplitView Component Improvements

The existing `SplitView.tsx` needs theme-aware styling:

```
Current:  borderRightColor: '#e0e0e0'  (hardcoded)
Proposed: borderRightColor: colors.border (from theme)

Current:  emptyStateText color: '#999' (hardcoded)
Proposed: emptyStateText color: colors.textMuted (from theme)
```

### Active Workout Landscape Layout

New component: `ActiveWorkoutSplitLayout`
- Only used when `isTablet && orientation === 'landscape'`
- Left pane (60%): exercise list ScrollView (same as current)
- Right pane (40%): exercise history panel (content from ExerciseHistoryBottomSheet, rendered inline)
- When the active exercise changes, the right pane updates to show that exercise's history
- On portrait iPad or phone: falls back to current single-column + bottom sheet

### Home Screen Grid

Update the max lifts section:
- iPhone: 2x2 grid (minWidth 45%, flex wrap) — unchanged
- iPad: 4-across single row (minWidth 22%, flex wrap) with sparklines

Update recent plans:
- iPhone: single column — unchanged
- iPad: `FlatList` with `numColumns={isTablet ? (isLandscape ? 3 : 2) : 1}`

### Home Screen Sparklines

On iPad, each max lift tile includes a sparkline showing the max weight trend over the last 6 sessions:
- Small SVG line chart (~32px tall) at the bottom of each tile
- Shows a filled area under the line for visual weight
- Current (rightmost) point highlighted with a dot
- Label below: "6 sessions" + trend arrow (↗ rising, → flat, ↘ declining)
- On iPhone, sparklines are hidden (tiles are too small)
- Data source: query `SessionSet` for the exercise, group by session, take max `actualWeight` per session, limit to last 6

### Home Screen Resume Banner

On iPad, the resume banner is a compact inline card (`display: inline-flex`) rather than full-width:
- Contains a play icon, workout name, and set progress
- Sized to fit content, not stretched to fill width
- On iPhone, banner remains full-width (works well at narrow widths)

### Settings Split View

On iPad, Settings uses a split-view layout:
- **Left pane** (~280px fixed width): scrollable navigation list with categorized rows (Theme, Workout Settings, Gyms, iCloud Sync, Apple Health, AI Assistance, Data Management, About). Each row has a colored icon, label, and chevron.
- **Right pane** (remaining width): detail content for the selected category, rendered inline
- Selected row is highlighted with `colors.primaryLight` background
- Tab bar spans full width below the split
- On iPhone, Settings remains single-column with push navigation for sub-screens

### Max Content Width

Screens that should use `useMaxContentWidth()`:
- Home: 800px
- Active Workout (portrait only): 800px
- Workout Summary: 800px
- Import Modal: 600px
- Settings: uses split view on iPad (no max-width needed)

### Responsive Utilities (already exist)

No changes needed to `useResponsivePadding()`, `useResponsiveFontSizes()`, or `useMaxContentWidth()`. Add a new utility:

```typescript
export function useGridColumns() {
  const { isTablet, orientation } = useDeviceLayout();
  return {
    plans: isTablet ? (orientation === 'landscape' ? 3 : 2) : 1,
    maxLifts: isTablet ? 4 : 2,
  };
}
```

## Summary of Changes by Screen

| Screen | iPhone | iPad Change |
|--------|--------|-------------|
| Home | Single column, full-width resume banner, 2x2 tiles | Compact resume card, 4-across tiles with sparklines, 2-3 column plan grid, max-width 800 |
| Workouts | Full list | SplitView (already done), theme fixes |
| History | Full list | SplitView (already done), theme fixes |
| Active Workout | Single column + bottom sheet | Portrait: max-width 800. Landscape: split with inline history panel |
| Workout Detail | Push screen | Handled by SplitView (already done) |
| Settings | Single column + push navigation | Split view: nav list (left) + detail (right), no push navigation |
| Import Modal | Full modal | Constrained width (iOS default) |
| Summary | Full screen | Max-width 800, centered |
