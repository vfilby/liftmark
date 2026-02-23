# Common Exercises List

## Purpose

Canonical list of common exercises displayed in the Exercise Picker when the user has no matching history. This list provides a starting point for new users and a fallback for the exercise search.

## Exercise List

The following 18 exercises are displayed in the picker in this order:

1. Squat
2. Deadlift
3. Bench Press
4. Overhead Press
5. Barbell Row
6. Pull-Up
7. Dip
8. Leg Press
9. Romanian Deadlift
10. Front Squat
11. Incline Bench Press
12. Lat Pulldown
13. Cable Row
14. Leg Curl
15. Leg Extension
16. Lateral Raise
17. Bicep Curl
18. Tricep Pushdown

## Exercise Picker Merge Logic

The Exercise Picker combines user history exercises with the common exercises list using the following rules:

1. **Fetch user exercises** from the database — all distinct exercise names the user has performed, ordered by most recent use.
2. **Deduplicate** against the common exercises list using case-insensitive comparison.
3. **Display order:**
   - User history exercises first (most recently used at top).
   - Common exercises that are not already in the user's history, in the order listed above.
4. **Free entry:** If the user's search text does not exactly match (case-insensitive) any exercise in the merged list, show an "Add {searchText}" option at the top of the results. This allows users to create exercises with any name.
5. **Search filtering:** Both user exercises and common exercises are filtered by case-insensitive substring match against the search text.
