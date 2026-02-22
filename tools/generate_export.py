#!/usr/bin/env python3
"""Generate valid LiftMark JSON export fixtures.

Usage:
    python tools/generate_export.py
    python tools/generate_export.py --single
    python tools/generate_export.py --sessions 5 --exercises 6 --sets 4
    python tools/generate_export.py -o output.json
"""

import argparse
import json
import random
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

EXERCISE_POOL = [
    ("Bench Press", "barbell"),
    ("Squat", "barbell"),
    ("Deadlift", "barbell"),
    ("Overhead Press", "barbell"),
    ("Barbell Row", "barbell"),
    ("Incline Dumbbell Press", "dumbbell"),
    ("Dumbbell Curl", "dumbbell"),
    ("Lateral Raise", "dumbbell"),
    ("Tricep Pushdown", "cable"),
    ("Lat Pulldown", "cable"),
    ("Cable Row", "cable"),
    ("Leg Press", "machine"),
    ("Leg Curl", "machine"),
    ("Leg Extension", "machine"),
    ("Pull-ups", None),
    ("Dips", None),
    ("Plank", None),
    ("Romanian Deadlift", "barbell"),
    ("Front Squat", "barbell"),
    ("Bulgarian Split Squat", "dumbbell"),
]

WORKOUT_NAMES = [
    "Push Day",
    "Pull Day",
    "Leg Day",
    "Upper Body",
    "Lower Body",
    "Full Body",
    "Chest & Triceps",
    "Back & Biceps",
    "Shoulders & Arms",
    "Strength A",
    "Strength B",
    "Hypertrophy A",
]

# Plausible weight ranges by exercise type
WEIGHT_RANGES = {
    "barbell": (45, 315),
    "dumbbell": (10, 100),
    "cable": (20, 200),
    "machine": (50, 400),
}


def generate_set(order_index: int, equipment_type: str | None) -> dict:
    weight_range = WEIGHT_RANGES.get(equipment_type or "", (0, 0))
    has_weight = weight_range[1] > 0

    if has_weight:
        target_weight = round(random.randrange(weight_range[0], weight_range[1] + 1, 5))
        actual_weight = target_weight
        unit = random.choice(["lbs", "lbs", "lbs", "kg"])  # bias toward lbs
    else:
        target_weight = None
        actual_weight = None
        unit = None

    target_reps = random.choice([5, 6, 8, 10, 12, 15])
    actual_reps = target_reps + random.randint(-2, 1)
    if actual_reps < 1:
        actual_reps = 1

    return {
        "orderIndex": order_index,
        "targetWeight": target_weight,
        "targetWeightUnit": unit,
        "targetReps": target_reps,
        "targetTime": None,
        "targetRpe": None,
        "restSeconds": random.choice([60, 90, 120, 180]),
        "actualWeight": actual_weight,
        "actualWeightUnit": unit,
        "actualReps": actual_reps,
        "actualTime": None,
        "actualRpe": random.choice([None, 6, 7, 8, 9]),
        "completedAt": datetime.now(timezone.utc).isoformat(),
        "status": "completed",
        "notes": None,
        "tempo": None,
        "isDropset": False,
        "isPerSide": False,
    }


def generate_exercise(order_index: int, num_sets: int) -> dict:
    name, equipment = random.choice(EXERCISE_POOL)
    return {
        "exerciseName": name,
        "orderIndex": order_index,
        "notes": None,
        "equipmentType": equipment,
        "groupType": None,
        "groupName": None,
        "status": "completed",
        "sets": [generate_set(i, equipment) for i in range(num_sets)],
    }


def generate_session(
    num_exercises: int, num_sets: int, base_date: datetime
) -> dict:
    start = base_date.replace(
        hour=random.randint(6, 19),
        minute=random.choice([0, 15, 30, 45]),
        tzinfo=timezone.utc,
    )
    duration = random.randint(2400, 5400)  # 40-90 minutes
    end = start + timedelta(seconds=duration)

    return {
        "name": random.choice(WORKOUT_NAMES),
        "date": start.strftime("%Y-%m-%d"),
        "startTime": start.isoformat(),
        "endTime": end.isoformat(),
        "duration": duration,
        "notes": None,
        "status": "completed",
        "exercises": [
            generate_exercise(i, num_sets) for i in range(num_exercises)
        ],
    }


def generate_export(
    single: bool = False,
    num_sessions: int = 3,
    num_exercises: int = 4,
    num_sets: int = 3,
) -> dict:
    base_date = datetime.now(timezone.utc)

    if single:
        session = generate_session(num_exercises, num_sets, base_date)
        return {
            "exportedAt": datetime.now(timezone.utc).isoformat(),
            "appVersion": "1.5.0",
            "session": session,
        }
    else:
        sessions = []
        for i in range(num_sessions):
            day = base_date - timedelta(days=i * random.randint(1, 3))
            sessions.append(generate_session(num_exercises, num_sets, day))
        return {
            "exportedAt": datetime.now(timezone.utc).isoformat(),
            "appVersion": "1.5.0",
            "sessions": sessions,
        }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Generate valid LiftMark JSON export fixtures."
    )
    parser.add_argument(
        "--single", action="store_true", help="Generate single-session export"
    )
    parser.add_argument(
        "--sessions", type=int, default=3, help="Number of sessions (multi only)"
    )
    parser.add_argument(
        "--exercises", type=int, default=4, help="Exercises per session"
    )
    parser.add_argument("--sets", type=int, default=3, help="Sets per exercise")
    parser.add_argument("-o", "--output", help="Output file (default: stdout)")
    parser.add_argument(
        "--seed", type=int, help="Random seed for reproducible output"
    )
    args = parser.parse_args(argv)

    if args.seed is not None:
        random.seed(args.seed)

    data = generate_export(
        single=args.single,
        num_sessions=args.sessions,
        num_exercises=args.exercises,
        num_sets=args.sets,
    )

    # Self-check: validate against schema
    from validate_export import load_schema, validate, SINGLE_SCHEMA_PATH, MULTI_SCHEMA_PATH

    fmt = "single" if args.single else "multi"
    schema_path = SINGLE_SCHEMA_PATH if args.single else MULTI_SCHEMA_PATH
    schema = load_schema(schema_path)
    errors = validate(data, schema)
    if errors:
        print("ERROR: Generated data fails schema validation!", file=sys.stderr)
        for err in errors:
            print(err, file=sys.stderr)
        return 1

    output = json.dumps(data, indent=2)

    if args.output:
        Path(args.output).write_text(output + "\n")
        print(f"Written to {args.output} ({fmt} format)", file=sys.stderr)
    else:
        print(output)

    return 0


if __name__ == "__main__":
    sys.exit(main())
