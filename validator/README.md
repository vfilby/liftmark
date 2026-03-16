# LMWF Validator

Validation service for the [LiftMark Workout Format (LMWF)](../liftmark-workout-format/MARKDOWN_SPEC.md). Accepts workout markdown and returns structured validation results.

**Live endpoint:** `https://validate.liftmark.app/validate`

## Usage

### JSON request

```bash
curl -X POST https://validate.liftmark.app/validate \
  -H "Content-Type: application/json" \
  -d '{
    "markdown": "# Push Day\n@units: lbs\n\n## Bench Press [barbell]\n- 225 x 5\n- 245 x 3"
  }'
```

### Send a file

```bash
curl -X POST https://validate.liftmark.app/validate \
  -H "Content-Type: text/markdown" \
  --data-binary @my-workout.md
```

### Response (valid)

```json
{
  "success": true,
  "summary": {
    "workoutName": "Push Day",
    "defaultWeightUnit": "lbs",
    "tags": [],
    "exerciseCount": 1,
    "totalSetCount": 2,
    "exercises": [
      {
        "name": "Bench Press [barbell]",
        "setCount": 2,
        "groupType": null,
        "groupName": null,
        "parentExerciseId": null
      }
    ]
  },
  "errors": [],
  "warnings": []
}
```

### Response (invalid)

```json
{
  "success": false,
  "summary": null,
  "errors": [
    "No workout header found. Must have a header (# Workout Name) with exercises below it."
  ],
  "warnings": []
}
```

### Using with AI agents

POST the markdown as JSON, check `success` in the response, and iterate on any `errors`:

```
1. Generate workout markdown
2. POST to https://validate.liftmark.app/validate
3. If success: done
4. If errors: fix the issues and retry from step 2
```

## Format reference

See the full [LMWF Markdown Specification](../liftmark-workout-format/MARKDOWN_SPEC.md) for the workout format.

Quick example:

```markdown
# Push Day
@tags: strength, upper
@units: lbs

## Bench Press [barbell]
- 135 x 8 @rest: 90s
- 185 x 5 @rest: 120s
- 225 x 3 @rest: 180s

## Overhead Press [barbell]
- 95 x 8
- 115 x 5

## Lateral Raises [dumbbell]
- 20 x 12
- 20 x 12
```

## Development

```bash
# Install dependencies
make install
make install-cdk

# Run tests (97 tests)
make test

# Type check
make typecheck

# Deploy (requires AWS credentials)
AWS_PROFILE=liftmark make deploy
```

## Infrastructure

- **Runtime:** Node.js 20 on AWS Lambda (arm64, 256MB)
- **API:** API Gateway v2 (HTTP API) with CORS
- **Domain:** `validate.liftmark.app` (ACM cert + Route 53)
- **Throttle:** 100 burst / 50 sustained requests per second
- **IaC:** AWS CDK (see `cdk/`)
