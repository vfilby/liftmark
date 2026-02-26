.PHONY: build test test-unit test-ui clean resolve generate release-alpha

SCHEME = LiftMark
PROJECT = LiftMark.xcodeproj
DESTINATION = 'platform=iOS Simulator,name=iPhone 16 Pro,OS=18.2'

resolve:
	swift package resolve

generate:
	xcodegen generate

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

# Trigger TestFlight deploy via GitHub Actions
release-alpha:
	@echo "Triggering Swift TestFlight build..."
	gh workflow run "Deploy Swift to TestFlight" --ref main --field bump=build
	@echo "Workflow triggered. Monitor at: https://github.com/$$(gh repo view --json nameWithOwner -q .nameWithOwner)/actions"
