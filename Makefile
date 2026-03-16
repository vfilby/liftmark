# LiftMark Build

.PHONY: help build test test-unit test-ui generate release-alpha tools-test tools-validate tools-generate

help:
	@echo "LiftMark Build"
	@echo ""
	@echo "App (mobile-apps/ios/):"
	@echo "  make build          - Build the app"
	@echo "  make test           - Run all tests"
	@echo "  make test-unit      - Run unit tests only"
	@echo "  make test-ui        - Run UI tests only"
	@echo "  make generate       - Regenerate Xcode project"
	@echo "  make release-alpha  - Trigger TestFlight build"
	@echo ""
	@echo "Tools:"
	@echo "  make tools-test       - Run tools tests"
	@echo "  make tools-validate   - Validate JSON export (FILE=path.json)"
	@echo "  make tools-generate   - Generate export fixture (ARGS='--single -o out.json')"

build:
	cd mobile-apps/ios && make build

test:
	cd mobile-apps/ios && make test

test-unit:
	cd mobile-apps/ios && make test-unit

test-ui:
	cd mobile-apps/ios && make test-ui

generate:
	cd mobile-apps/ios && make generate

release-alpha:
	cd mobile-apps/ios && make release-alpha

# Tools
tools-test:
	cd tools && make test

tools-validate:
	@if [ -z "$(FILE)" ]; then echo "Usage: make tools-validate FILE=path/to/file.json"; exit 1; fi
	python tools/validate_export.py $(FILE)

tools-generate:
	python tools/generate_export.py $(ARGS)
