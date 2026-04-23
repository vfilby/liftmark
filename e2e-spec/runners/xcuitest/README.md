# XCUITest Runner

Reads the shared YAML E2E scenario files and executes them as XCUITest tests against the Swift iOS app.

## Files

- **TestSpecRunner.swift** — Loads scenario YAML files, parses them into `TestScenario` models via [Yams](https://github.com/jpsim/Yams), and orchestrates execution via `ActionAdapter`. Embeds a small `YAMLValue` wrapper that preserves the keyed-subscript API used throughout the runner.
- **ActionAdapter.swift** — Maps each YAML action type (`tap`, `waitFor`, `expect`, etc.) to XCUITest API calls.

## Integration

These files are consumed by the XCUITest target at `mobile-apps/ios/LiftMarkUITests/` (via symlinks). To add them to an Xcode project:

1. Add both `.swift` files to the UI test target.
2. Add the Yams SPM package as a **test-target-only** dependency (do not link it from the app target).
3. Ensure the test target can access `e2e-spec/scenarios/` and `e2e-spec/fixtures/` at runtime.
4. Set the `PROJECT_DIR` environment variable in the test scheme, or rely on `#filePath` resolution.

## Dependencies

YAML parsing is delegated to [Yams](https://github.com/jpsim/Yams) — a libyaml-backed Swift library used by SwiftLint and SourceKitten. It handles the full YAML 1.1 core schema (mappings, sequences, scalars, flow arrays, comments, quoted strings) with battle-tested behavior.

Yams is scoped to the UI test target only; the app binary does not link it.
