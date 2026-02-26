Follow these steps in order:

1. **Update the spec first.** Before writing any code, update the relevant spec file(s) in `spec/` to reflect the correct behavior. The spec is the source of truth.

2. **Update E2E test coverage.** Ensure the E2E scenarios in `e2e-spec/scenarios/` cover the spec changes so the fix can be validated automatically. Create new scenarios or update existing ones as needed. Check that fixtures in `e2e-spec/fixtures/` support the tests.

3. **Implement the code changes.** Make changes to the Swift app in `swift-ios/` to match the updated spec. Audit your changes against the spec before moving on.

4. **All unit tests must pass.** Run `xcodebuild test -scheme LiftMark -project LiftMark.xcodeproj -destination 'platform=iOS Simulator,name=iPhone 16 Pro,OS=18.2' -only-testing:LiftMarkTests` and confirm 0 failures.

5. **All E2E UI tests must pass.** Run the full E2E suite with `-only-testing:LiftMarkUITests` and confirm 0 failures across all tests. This is the ultimate validation.

**Rules:**
- Do not skip or remove any existing tests without my explicit permission.
- Do not assume a failure is "pre-existing" — investigate every failure and fix it.
- If your code changes break other tests, fix those too before declaring done.
- Do not declare done until every test passes with 0 failures.
