# Import Workout Modal

## Purpose
Modal for importing workouts via LiftMark Workout Format (LMWF) markdown. Supports manual paste, AI-generated prompts (copy to clipboard or generate directly via Anthropic API), and file pre-fill from external imports.

## Route
`/modal/import` — Presented as a modal. Accepts optional `prefilledMarkdown` and `fileName` search params.

## Layout
- **Header**: Cancel button (left), "Import Workout" title (center), Import button (right)
- **Body**: ScrollView containing:
  1. AI Workout Prompt section (expandable) with Copy and optional Generate/Open in Claude buttons
  2. Markdown input label + hint
  3. Monospace TextInput for LMWF markdown
  4. Quick Guide help section

## UI Elements

| Element | testID | Type |
|---------|--------|------|
| Screen container | `import-modal` | View |
| Cancel button | `button-cancel` | TouchableOpacity |
| Import button | `button-import` | TouchableOpacity |
| Copy prompt button | `button-copy-prompt` | TouchableOpacity |
| Generate with Claude button | `button-generate` | TouchableOpacity |
| Open in Claude button | `button-open-claude` | TouchableOpacity |
| Markdown input | `input-markdown` | TextInput |

## User Interactions
- **Tap Cancel** → if markdown has content: confirmation alert ("Discard Changes") → navigates back; if empty: navigates back directly
- **Tap Import** → parses markdown via LMWF parser → if warnings: alert with Continue/Cancel → saves plan → success alert → navigates back
- **Tap AI prompt toggle** → expands/collapses prompt preview section
- **Tap Copy** → copies full AI prompt (with equipment, history, custom additions) to clipboard
- **Tap "Generate with Claude"** (visible when API key set) → calls Anthropic API → populates markdown field with result
- **Tap "Open in Claude"** (visible when no API key or showOpenInClaudeButton enabled) → copies prompt to clipboard → opens claude.ai/new in browser
- **Edit markdown field** → updates local state

## Navigation
- Back (via Cancel or after successful import) → previous screen

## Computed Values
- `promptText` — memoized combination of base LMWF prompt + available equipment from default gym + workout history context + custom prompt addition from settings

## Error/Empty States
- **Parse error**: Alert with error messages from parser
- **Parse warnings**: Alert with Continue/Cancel options
- **No API key (Generate)**: Alert with options: Cancel, Open in Claude (console), Go to Settings
- **Generation failure**: Alert with error message
- **Copy failure**: Alert "Failed to copy prompt"
- **Open Claude failure**: Alert "Unable to open Claude.ai"
- **Save failure**: Alert with error message
- **Import button disabled**: When `isParsing`, `isGenerating`, or markdown is empty
