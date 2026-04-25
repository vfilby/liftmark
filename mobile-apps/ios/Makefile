.PHONY: build test test-unit test-ui clean resolve generate release-alpha

SCHEME = LiftMark
PROJECT = LiftMark.xcodeproj
DESTINATION = 'platform=iOS Simulator,name=iPhone 17 Pro,OS=26.0'

resolve:
	swift package resolve

generate: Config/Sentry.xcconfig
	xcodegen generate

# Auto-copy the example xcconfig on first generate so fresh checkouts work.
# Contributors should replace the placeholder DSN with their own for Sentry to
# send events — see spec/services/sentry.md.
Config/Sentry.xcconfig:
	@cp Config/Sentry.xcconfig.example Config/Sentry.xcconfig
	@echo "Created Config/Sentry.xcconfig from .example — edit it to add your Sentry DSN if you want crash reports."

build:
	xcodebuild -scheme $(SCHEME) -project $(PROJECT) -destination $(DESTINATION) build

# Run all tests (unit + UI)
test:
	xcodebuild test -scheme $(SCHEME) -project $(PROJECT) -destination $(DESTINATION)

# Run unit tests only (fast, no simulator UI needed)
test-unit:
	xcodebuild test -scheme $(SCHEME) -project $(PROJECT) \
		-only-testing:LiftMarkTests \
		-destination $(DESTINATION)

# Run UI tests only
test-ui:
	xcodebuild test -scheme $(SCHEME) -project $(PROJECT) \
		-only-testing:LiftMarkUITests \
		-destination $(DESTINATION)

clean:
	xcodebuild clean -scheme $(SCHEME)
	rm -rf .build build

# Manually re-trigger the release pipeline against current main.
# Pushes to main also trigger it automatically; use this to re-run without an empty commit.
release-alpha:
	@echo "Triggering release pipeline..."
	gh workflow run "[iOS] Release Pipeline" --ref main
	@echo "Workflow triggered. Monitor at: https://github.com/$$(gh repo view --json nameWithOwner -q .nameWithOwner)/actions"
