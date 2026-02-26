# LiftMark Multi-Platform Build

.PHONY: help react-install react-test react-ios react-server swift-build swift-test swift-test-unit swift-test-ui swift-generate swift-release-alpha test-all test-react-e2e test-swift-e2e tools-test tools-validate tools-generate

help:
	@echo "LiftMark Multi-Platform Build"
	@echo ""
	@echo "React Native (react-ios/):"
	@echo "  make react-install    - Install dependencies"
	@echo "  make react-test       - Run React test suite"
	@echo "  make react-ios        - Run on iOS simulator"
	@echo "  make react-server     - Start dev server"
	@echo ""
	@echo "Swift (swift-ios/):"
	@echo "  make swift-build      - Build Swift app"
	@echo "  make swift-test       - Run all Swift tests"
	@echo "  make swift-test-unit  - Run Swift unit tests only"
	@echo "  make swift-test-ui    - Run Swift UI tests only"
	@echo "  make swift-generate   - Regenerate Xcode project"
	@echo "  make swift-release-alpha - Trigger TestFlight build"
	@echo ""
	@echo "Cross-platform:"
	@echo "  make test-all         - Run all test suites"
	@echo "  make test-react-e2e   - Detox E2E against React app"
	@echo "  make test-swift-e2e   - XCUITest against Swift app"
	@echo ""
	@echo "Tools:"
	@echo "  make tools-test       - Run tools tests"
	@echo "  make tools-validate   - Validate JSON export (FILE=path.json)"
	@echo "  make tools-generate   - Generate export fixture (ARGS='--single -o out.json')"

react-install:
	cd react-ios && npm install

react-test:
	cd react-ios && make test

react-ios:
	cd react-ios && make ios

react-server:
	cd react-ios && make server

swift-build:
	cd swift-ios && make build

swift-test:
	cd swift-ios && make test

swift-test-unit:
	cd swift-ios && make test-unit

swift-test-ui:
	cd swift-ios && make test-ui

swift-generate:
	cd swift-ios && make generate

swift-release-alpha:
	cd swift-ios && make release-alpha

test-all: react-test swift-test

test-react-e2e:
	cd react-ios && npm run e2e:test

test-swift-e2e:
	cd swift-ios && make uitest

# Tools
tools-test:
	cd tools && make test

tools-validate:
	@if [ -z "$(FILE)" ]; then echo "Usage: make tools-validate FILE=path/to/file.json"; exit 1; fi
	python tools/validate_export.py $(FILE)

tools-generate:
	python tools/generate_export.py $(ARGS)
