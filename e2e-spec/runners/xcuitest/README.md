# XCUITest Runner

Reads the shared YAML E2E scenario files and executes them as XCUITest tests against the Swift iOS app.

## Files

- **YAMLParser.swift** — Lightweight YAML parser handling the subset used by scenario files (mappings, sequences, scalars). No external dependencies.
- **ActionAdapter.swift** — Maps each YAML action type (`tap`, `waitFor`, `expect`, etc.) to XCUITest API calls.
- **TestSpecRunner.swift** — Loads scenario YAML files, parses them into `TestScenario` models, and orchestrates execution via `ActionAdapter`.

## Integration

These files are consumed by the XCUITest target at `mobile-apps/ios/LiftMarkUITests/`. To add them to an Xcode project:

1. Add all three `.swift` files to the UI test target
2. Ensure the test target can access `e2e-spec/scenarios/` and `e2e-spec/fixtures/` at runtime
3. Set the `PROJECT_DIR` environment variable in the test scheme, or rely on `#filePath` resolution

For SPM-based projects, add a `.testTarget` in `Package.swift` — see the main `mobile-apps/ios/Package.swift` for the configured target.

## No External Dependencies

The YAML parser is built-in and handles the subset of YAML used by our scenario files:
- Mappings (key: value)
- Sequences (- item)
- Scalars (strings, integers, booleans)
- Inline flow arrays ([a, b, c])
- Comments (# ...)

No need for the Yams SPM package.
