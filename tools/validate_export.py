#!/usr/bin/env python3
"""Validate a LiftMark JSON export file against the schema.

Usage:
    python tools/validate_export.py <file.json>
    python tools/validate_export.py --single <file.json>
    python tools/validate_export.py --multi <file.json>
    python tools/validate_export.py --unified <file.json>

Exit codes:
    0 = valid
    1 = invalid or error
"""

import argparse
import json
import sys
from pathlib import Path

from jsonschema import Draft202012Validator

SCHEMA_DIR = Path(__file__).resolve().parent.parent / "spec" / "data" / "schemas"
SINGLE_SCHEMA_PATH = SCHEMA_DIR / "liftmark-export-single.schema.json"
MULTI_SCHEMA_PATH = SCHEMA_DIR / "liftmark-export-multi.schema.json"
UNIFIED_SCHEMA_PATH = SCHEMA_DIR / "liftmark-export-unified.schema.json"


def load_schema(path: Path) -> dict:
    with open(path) as f:
        return json.load(f)


def detect_format(data: dict) -> str:
    """Detect whether data is single, multi, or unified export format.

    Returns 'single', 'multi', 'unified', or 'unknown'.
    """
    if "formatVersion" in data:
        return "unified"
    if "session" in data and "sessions" not in data:
        return "single"
    if "sessions" in data and "session" not in data:
        return "multi"
    return "unknown"


def validate(data: dict, schema: dict) -> list[str]:
    """Validate data against schema. Returns list of error messages."""
    validator = Draft202012Validator(schema)
    errors = []
    for error in sorted(validator.iter_errors(data), key=lambda e: list(e.absolute_path)):
        path = ".".join(str(p) for p in error.absolute_path) or "(root)"
        errors.append(f"  {path}: {error.message}")
    return errors


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Validate a LiftMark JSON export file against the schema."
    )
    parser.add_argument("file", help="Path to JSON export file")
    format_group = parser.add_mutually_exclusive_group()
    format_group.add_argument(
        "--single", action="store_true", help="Force single-session schema"
    )
    format_group.add_argument(
        "--multi", action="store_true", help="Force multi-session schema"
    )
    format_group.add_argument(
        "--unified", action="store_true", help="Force unified export schema"
    )
    args = parser.parse_args(argv)

    file_path = Path(args.file)
    if not file_path.exists():
        print(f"Error: File not found: {file_path}", file=sys.stderr)
        return 1

    try:
        with open(file_path) as f:
            data = json.load(f)
    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON: {e}", file=sys.stderr)
        return 1

    if args.single:
        fmt = "single"
    elif args.multi:
        fmt = "multi"
    elif args.unified:
        fmt = "unified"
    else:
        fmt = detect_format(data)

    if fmt == "unknown":
        print(
            "Error: Cannot detect format. File must have 'formatVersion' (unified), "
            "'session' (single), or 'sessions' (multi) key. "
            "Use --single, --multi, or --unified to force.",
            file=sys.stderr,
        )
        return 1

    schema_paths = {
        "single": SINGLE_SCHEMA_PATH,
        "multi": MULTI_SCHEMA_PATH,
        "unified": UNIFIED_SCHEMA_PATH,
    }
    schema_path = schema_paths[fmt]
    schema = load_schema(schema_path)
    errors = validate(data, schema)

    if errors:
        print(f"INVALID ({fmt} format) — {len(errors)} error(s):")
        for err in errors:
            print(err)
        return 1
    else:
        print(f"VALID ({fmt} format)")
        return 0


if __name__ == "__main__":
    sys.exit(main())
