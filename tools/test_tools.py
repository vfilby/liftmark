"""Tests for LiftMark export validation and generation tools."""

import json
import copy
import tempfile
from pathlib import Path

import pytest

from validate_export import (
    detect_format,
    load_schema,
    validate,
    SINGLE_SCHEMA_PATH,
    MULTI_SCHEMA_PATH,
    main as validate_main,
)
from generate_export import generate_export


# --- Fixtures ---


@pytest.fixture
def single_export():
    return generate_export(single=True, num_sessions=1, num_exercises=2, num_sets=2)


@pytest.fixture
def multi_export():
    return generate_export(single=False, num_sessions=3, num_exercises=2, num_sets=2)


@pytest.fixture
def single_schema():
    return load_schema(SINGLE_SCHEMA_PATH)


@pytest.fixture
def multi_schema():
    return load_schema(MULTI_SCHEMA_PATH)


# --- Format Detection ---


class TestFormatDetection:
    def test_detects_single(self, single_export):
        assert detect_format(single_export) == "single"

    def test_detects_multi(self, multi_export):
        assert detect_format(multi_export) == "multi"

    def test_unknown_format(self):
        assert detect_format({"foo": "bar"}) == "unknown"

    def test_both_keys_is_unknown(self):
        assert detect_format({"session": {}, "sessions": []}) == "unknown"


# --- Generated Fixtures Pass Validation ---


class TestGeneratedFixtures:
    def test_single_export_valid(self, single_export, single_schema):
        errors = validate(single_export, single_schema)
        assert errors == [], f"Validation errors: {errors}"

    def test_multi_export_valid(self, multi_export, multi_schema):
        errors = validate(multi_export, multi_schema)
        assert errors == [], f"Validation errors: {errors}"

    def test_single_with_many_exercises(self):
        data = generate_export(single=True, num_exercises=10, num_sets=5)
        schema = load_schema(SINGLE_SCHEMA_PATH)
        assert validate(data, schema) == []

    def test_multi_with_many_sessions(self):
        data = generate_export(single=False, num_sessions=10, num_exercises=2, num_sets=2)
        schema = load_schema(MULTI_SCHEMA_PATH)
        assert validate(data, schema) == []

    def test_reproducible_with_seed(self):
        import random

        random.seed(42)
        a = generate_export(single=True, num_exercises=3, num_sets=3)
        random.seed(42)
        b = generate_export(single=True, num_exercises=3, num_sets=3)
        # Structure should match (timestamps will differ but shape is the same)
        assert len(a["session"]["exercises"]) == len(b["session"]["exercises"])


# --- Known-Bad JSON Fails ---


class TestInvalidData:
    def test_missing_exported_at(self, single_schema):
        data = {"appVersion": "1.0.0", "session": _minimal_session()}
        errors = validate(data, single_schema)
        assert any("exportedAt" in e for e in errors)

    def test_missing_app_version(self, single_schema):
        data = {"exportedAt": "2026-01-01T00:00:00Z", "session": _minimal_session()}
        errors = validate(data, single_schema)
        assert any("appVersion" in e for e in errors)

    def test_missing_session(self, single_schema):
        data = {"exportedAt": "2026-01-01T00:00:00Z", "appVersion": "1.0.0"}
        errors = validate(data, single_schema)
        assert any("session" in e for e in errors)

    def test_missing_sessions(self, multi_schema):
        data = {"exportedAt": "2026-01-01T00:00:00Z", "appVersion": "1.0.0"}
        errors = validate(data, multi_schema)
        assert any("sessions" in e for e in errors)

    def test_extra_top_level_field(self, single_schema):
        data = {
            "exportedAt": "2026-01-01T00:00:00Z",
            "appVersion": "1.0.0",
            "session": _minimal_session(),
            "extraField": "bad",
        }
        errors = validate(data, single_schema)
        assert len(errors) > 0

    def test_session_missing_name(self, single_schema):
        session = _minimal_session()
        del session["name"]
        data = {
            "exportedAt": "2026-01-01T00:00:00Z",
            "appVersion": "1.0.0",
            "session": session,
        }
        errors = validate(data, single_schema)
        assert any("name" in e for e in errors)

    def test_session_missing_exercises(self, single_schema):
        session = _minimal_session()
        del session["exercises"]
        data = {
            "exportedAt": "2026-01-01T00:00:00Z",
            "appVersion": "1.0.0",
            "session": session,
        }
        errors = validate(data, single_schema)
        assert any("exercises" in e for e in errors)

    def test_exercise_missing_name(self, single_schema):
        session = _minimal_session()
        del session["exercises"][0]["exerciseName"]
        data = {
            "exportedAt": "2026-01-01T00:00:00Z",
            "appVersion": "1.0.0",
            "session": session,
        }
        errors = validate(data, single_schema)
        assert len(errors) > 0

    def test_set_missing_status(self, single_schema):
        session = _minimal_session()
        del session["exercises"][0]["sets"][0]["status"]
        data = {
            "exportedAt": "2026-01-01T00:00:00Z",
            "appVersion": "1.0.0",
            "session": session,
        }
        errors = validate(data, single_schema)
        assert len(errors) > 0

    def test_wrong_weight_unit(self, single_schema):
        session = _minimal_session()
        session["exercises"][0]["sets"][0]["targetWeightUnit"] = "pounds"
        data = {
            "exportedAt": "2026-01-01T00:00:00Z",
            "appVersion": "1.0.0",
            "session": session,
        }
        errors = validate(data, single_schema)
        assert len(errors) > 0

    def test_wrong_group_type(self, single_schema):
        session = _minimal_session()
        session["exercises"][0]["groupType"] = "circuit"
        data = {
            "exportedAt": "2026-01-01T00:00:00Z",
            "appVersion": "1.0.0",
            "session": session,
        }
        errors = validate(data, single_schema)
        assert len(errors) > 0

    def test_negative_reps(self, single_schema):
        session = _minimal_session()
        session["exercises"][0]["sets"][0]["targetReps"] = -5
        data = {
            "exportedAt": "2026-01-01T00:00:00Z",
            "appVersion": "1.0.0",
            "session": session,
        }
        errors = validate(data, single_schema)
        assert len(errors) > 0


# --- Empty / Edge Cases ---


class TestEdgeCases:
    def test_empty_exercises_array(self, single_schema):
        session = _minimal_session()
        session["exercises"] = []
        data = {
            "exportedAt": "2026-01-01T00:00:00Z",
            "appVersion": "1.0.0",
            "session": session,
        }
        errors = validate(data, single_schema)
        assert errors == []  # Empty exercises is valid

    def test_empty_sets_array(self, single_schema):
        session = _minimal_session()
        session["exercises"][0]["sets"] = []
        data = {
            "exportedAt": "2026-01-01T00:00:00Z",
            "appVersion": "1.0.0",
            "session": session,
        }
        errors = validate(data, single_schema)
        assert errors == []  # Empty sets is valid

    def test_empty_sessions_array(self, multi_schema):
        data = {
            "exportedAt": "2026-01-01T00:00:00Z",
            "appVersion": "1.0.0",
            "sessions": [],
        }
        errors = validate(data, multi_schema)
        assert errors == []  # Empty sessions is valid

    def test_all_nullable_fields_null(self, single_schema):
        session = {
            "name": "Test",
            "date": "2026-01-01",
            "startTime": None,
            "endTime": None,
            "duration": None,
            "notes": None,
            "status": "completed",
            "exercises": [
                {
                    "exerciseName": "Squat",
                    "orderIndex": 0,
                    "notes": None,
                    "equipmentType": None,
                    "groupType": None,
                    "groupName": None,
                    "status": "completed",
                    "sets": [
                        {
                            "orderIndex": 0,
                            "targetWeight": None,
                            "targetWeightUnit": None,
                            "targetReps": None,
                            "targetTime": None,
                            "targetRpe": None,
                            "restSeconds": None,
                            "actualWeight": None,
                            "actualWeightUnit": None,
                            "actualReps": None,
                            "actualTime": None,
                            "actualRpe": None,
                            "completedAt": None,
                            "status": "completed",
                            "notes": None,
                            "tempo": None,
                            "isDropset": None,
                            "isPerSide": None,
                        }
                    ],
                }
            ],
        }
        data = {
            "exportedAt": "2026-01-01T00:00:00Z",
            "appVersion": "1.0.0",
            "session": session,
        }
        errors = validate(data, single_schema)
        assert errors == []


# --- CLI Integration ---


class TestCLI:
    def test_valid_file_exits_0(self, single_export):
        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
            json.dump(single_export, f)
            f.flush()
            result = validate_main([f.name])
        assert result == 0

    def test_invalid_file_exits_1(self):
        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
            json.dump({"bad": "data"}, f)
            f.flush()
            result = validate_main([f.name])
        assert result == 1

    def test_nonexistent_file_exits_1(self):
        result = validate_main(["/tmp/nonexistent_liftmark_test.json"])
        assert result == 1

    def test_invalid_json_exits_1(self):
        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
            f.write("not json {{{")
            f.flush()
            result = validate_main([f.name])
        assert result == 1

    def test_force_single(self, single_export):
        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
            json.dump(single_export, f)
            f.flush()
            result = validate_main(["--single", f.name])
        assert result == 0

    def test_force_multi(self, multi_export):
        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
            json.dump(multi_export, f)
            f.flush()
            result = validate_main(["--multi", f.name])
        assert result == 0


# --- Helpers ---


def _minimal_session() -> dict:
    return {
        "name": "Test Workout",
        "date": "2026-01-01",
        "startTime": None,
        "endTime": None,
        "duration": None,
        "notes": None,
        "status": "completed",
        "exercises": [
            {
                "exerciseName": "Bench Press",
                "orderIndex": 0,
                "notes": None,
                "equipmentType": "barbell",
                "groupType": None,
                "groupName": None,
                "status": "completed",
                "sets": [
                    {
                        "orderIndex": 0,
                        "targetWeight": 135,
                        "targetWeightUnit": "lbs",
                        "targetReps": 10,
                        "targetTime": None,
                        "targetRpe": None,
                        "restSeconds": 90,
                        "actualWeight": 135,
                        "actualWeightUnit": "lbs",
                        "actualReps": 10,
                        "actualTime": None,
                        "actualRpe": 7,
                        "completedAt": "2026-01-01T10:00:00Z",
                        "status": "completed",
                        "notes": None,
                        "tempo": None,
                        "isDropset": False,
                        "isPerSide": False,
                    }
                ],
            }
        ],
    }
