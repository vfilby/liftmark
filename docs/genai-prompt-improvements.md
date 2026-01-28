# GenAI Workout Prompt Improvements

## Overview

Improved the AI workout generation prompt in the Import Workout modal for better clarity and usability when working with AI assistants (ChatGPT, Claude, etc.).

## Location

**File**: `app/modal/import.tsx`
**Lines**: 36-118 (basePromptText constant)

## Problems Identified

### Before Improvements:

1. **Poor Information Architecture**
   - Format rules came before seeing an example
   - Mixed instructions, rules, and examples without clear separation
   - Hard to scan and find specific information

2. **Weak Visual Hierarchy**
   - Everything blended together
   - No clear sections or organization
   - Difficult to differentiate between different types of information

3. **Ambiguous Instructions**
   - Ending with "Generate a [workout type] workout with [specific requirements]" was unclear
   - No clear priority of what's required vs. optional

4. **Dense Rule List**
   - Long bullet list was overwhelming
   - Rules weren't grouped by category
   - Made it difficult to understand relationships between concepts

## Improvements Made

### 1. Clear Section Structure

Reorganized prompt into distinct sections with visual separators:

```
=== QUICK FORMAT OVERVIEW ===
=== COMPLETE EXAMPLE ===
=== DETAILED FORMAT RULES ===
=== YOUR TASK ===
```

### 2. Example-First Approach

Moved complete example to appear **before** detailed rules, so users can:
- See the format in action immediately
- Understand context before diving into specifics
- Reference a working example while reading rules

### 3. Categorized Rules

Grouped format rules into logical categories:
- **STRUCTURE**: Workout organization and headers
- **SETS FORMAT**: How to write set notation
- **SUPERSETS**: Special formatting for supersets
- **MODIFIERS**: Optional annotations

### 4. Improved Scannability

- Used bullet points (•) for better visual distinction
- Added inline examples: "weight x reps" → 225 x 5
- Included clear labels: (required), (optional)
- Added explanatory text in parentheses

### 5. Clearer Task Instruction

Changed ending from:
```
Generate a [workout type] workout with [specific requirements].
```

To:
```
=== YOUR TASK ===

Create a [workout type] workout with [specific requirements].
Follow LMWF format exactly as shown above.
```

This makes it clear that:
- This is the instruction to follow
- The format must be followed exactly
- Reference the examples above

## Benefits

### For AI Assistants:
- **Better context**: Example comes first, establishing pattern
- **Clearer hierarchy**: Sections clearly delineate information types
- **Easier parsing**: Categorized rules are easier to reference
- **Reduced ambiguity**: Clear separation of required vs. optional

### For Users:
- **Faster scanning**: Visual sections make it easy to find information
- **Better understanding**: Example-first approach builds intuition
- **Copy-paste friendly**: Organized structure works well when copied to AI chats
- **Reference guide**: Categorized rules serve as a quick reference

## Testing

### Validation:
- ✅ Syntax validated (no TypeScript errors)
- ✅ All sections present and properly formatted
- ✅ Example matches format rules
- ✅ Instructions are clear and actionable

### Expected Outcomes:
1. AI assistants generate more accurate LMWF-formatted workouts
2. Users spend less time correcting AI output
3. Fewer parsing errors when importing AI-generated workouts
4. Better understanding of LMWF format by users

## Metrics to Track

Consider tracking these metrics to validate improvements:
1. **Parse success rate**: % of AI-generated workouts that parse without errors
2. **Import time**: Time from prompt copy to successful import
3. **User edits**: Number of manual corrections needed after AI generation
4. **User feedback**: Qualitative feedback on prompt clarity

## Future Enhancements

Potential improvements for future iterations:

1. **Version-specific prompts**: Different prompts for different AI models
2. **Template library**: Pre-built prompts for common workout types
3. **Interactive examples**: Show different variations (bodyweight, timed, etc.)
4. **Validation hints**: Add common mistakes to avoid
5. **Progressive disclosure**: Basic prompt with "advanced options" section

## Related Files

- `app/modal/import.tsx` - Import modal with prompt
- `src/services/MarkdownParser.ts` - LMWF parser implementation
- `docs/MARKDOWN_SPEC.md` - Full LMWF specification

---

**Date**: 2026-01-11
**Author**: nux (liftmark polecat)
**Status**: Implemented and ready for testing
