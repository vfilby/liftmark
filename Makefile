# LiftMark Multi-Platform Build

.PHONY: help react-install react-test react-ios react-server swift-build swift-test test-all test-react-e2e test-swift-e2e

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
	@echo "  make swift-test       - Run Swift tests"
	@echo ""
	@echo "Cross-platform:"
	@echo "  make test-all         - Run all test suites"
	@echo "  make test-react-e2e   - Detox E2E against React app"
	@echo "  make test-swift-e2e   - XCUITest against Swift app"

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

test-all: react-test swift-test

test-react-e2e:
	cd react-ios && npm run e2e:test

test-swift-e2e:
	cd swift-ios && make uitest
