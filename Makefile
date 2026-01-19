# LiftMark Development Makefile

# Dynamic port allocation for parallel workers (range: 54100-54199)
#EXPO_PORT := $(shell for p in $$(seq 54100 54199); do \
#  lsof -i :$$p -sTCP:LISTEN >/dev/null 2>&1 || { echo $$p; break; }; done)
EXPO_PORT := 8081

.PHONY: help server server-go server-bg server-tmux server-stop ios prebuild rebuild-native rebuild-ios android web test test-coverage test-coverage-open test-coverage-watch typecheck lint clean install build logs logs-file logs-tail logs-view logs-clean list-sims create-polecat-sims ios-polecat1 ios-polecat2 ios-polecat3 kill-all-sims release-alpha release-beta release-production release-cleanup-alpha release-cleanup-beta release-cleanup-production

# Default target
help:
	@echo "LiftMark Development Commands:"
	@echo ""
	@echo "Development servers:"
	@echo "  make server     - Start Expo dev server (interactive + file logging)"
	@echo "  make server-go  - Start Expo dev server for Expo Go (interactive + file logging)"
	@echo "  make server-bg  - Start Expo dev server in background (file logging only)"
	@echo "  make server-tmux - Start Expo dev server in tmux (full colors + logging)"
	@echo "  make logs-file  - Start Expo dev server (interactive + file logging)"
	@echo "  make server-stop - Stop background Expo servers"
	@echo "  make ios        - Run development build on iOS simulator"
	@echo "  make android    - Run development build on Android emulator"
	@echo "  make web        - Start web development server"
	@echo ""
	@echo "Parallel development (multi-agent workflows):"
	@echo "  make list-sims          - List all available iOS simulators"
	@echo "  make create-polecat-sims - Create named simulators for polecats"
	@echo "  make ios-polecat1       - Run on Polecat 1 simulator (port 54100)"
	@echo "  make ios-polecat2       - Run on Polecat 2 simulator (port 54101)"
	@echo "  make ios-polecat3       - Run on Polecat 3 simulator (port 54102)"
	@echo "  make kill-all-sims      - Close all running simulators"
	@echo ""
	@echo "Native builds:"
	@echo "  make prebuild       - Generate native projects (ios/android)"
	@echo "  make rebuild-native - Clean and regenerate native projects"
	@echo "  make rebuild-ios    - Prebuild and run on iOS simulator"
	@echo ""
	@echo "  make test              - Run full test suite (audit + typecheck + tests)"
	@echo "  make test-watch        - Run tests in watch mode"
	@echo "  make test-coverage     - Run tests with coverage report"
	@echo "  make test-coverage-open - Run coverage tests and open HTML report"
	@echo "  make test-coverage-watch - Run coverage tests in watch mode"
	@echo "  make typecheck  - Run TypeScript type checking only"
	@echo ""
	@echo "  make install    - Install dependencies"
	@echo "  make clean      - Clean cache and dependencies"
	@echo "  make build      - Build for production"
	@echo ""
	@echo "  make ci         - Run CI pipeline (audit, typecheck, test)"
	@echo ""
	@echo "Logging & Monitoring:"
	@echo "  make logs       - Show current Expo logs"
	@echo "  make logs-tail  - Follow logs in real time"
	@echo "  make logs-view  - View current log file contents"
	@echo "  make logs-clean - Clean all log files"
	@echo ""
	@echo "Release commands:"
	@echo "  make release-alpha             - Create alpha release (auto-cleanup on conflict)"
	@echo "  make release-beta              - Create beta release (auto-cleanup on conflict)"
	@echo "  make release-production        - Create production release (auto-cleanup on conflict)"
	@echo "  make release-cleanup-alpha     - Manually cleanup failed alpha release"
	@echo "  make release-cleanup-beta      - Manually cleanup failed beta release"
	@echo "  make release-cleanup-production - Manually cleanup failed production release"

# Development servers
server:
	@echo "🚀 Starting Expo development server with dev client on port $(EXPO_PORT)..."
	@mkdir -p logs
	script -q logs/expo.log npx expo start --dev-client --port $(EXPO_PORT)

server-go:
	@echo "📱 Starting Expo development server for Expo Go on port $(EXPO_PORT)..."
	@mkdir -p logs
	script -q logs/expo.log npx expo start --port $(EXPO_PORT)

ios:
	@echo "📱 Running development build on iOS simulator..."
	npx expo run:ios

prebuild:
	@echo "🔧 Generating native projects..."
	npx expo prebuild

rebuild-native:
	@echo "🧹 Cleaning native directories..."
	rm -rf ios android
	@echo "🔧 Regenerating native projects..."
	npx expo prebuild
	@echo "✅ Native projects rebuilt. Run 'make ios' or 'make android' to build."

rebuild-ios:
	@echo "🔄 Rebuilding iOS dev client (prebuild + run)..."
	npx expo prebuild && npx expo run:ios

android:
	@echo "🤖 Running development build on Android emulator..."
	npx expo run:android

web:
	@echo "🌐 Starting web development server on port $(EXPO_PORT)..."
	npx expo start --web --port $(EXPO_PORT)

# Testing
test:
	@echo "🧪 Running full test suite (audit + typecheck + tests)..."
	npm run ci

test-watch:
	@echo "👀 Running tests in watch mode..."
	npm run test:watch

test-coverage:
	@echo "📊 Running tests with coverage report..."
	npm run test:coverage

test-coverage-open:
	@echo "📊 Running tests with coverage and opening report..."
	npm run test:coverage
	@if [ -f coverage/lcov-report/index.html ]; then \
		echo "🌐 Opening coverage report in browser..."; \
		open coverage/lcov-report/index.html; \
	else \
		echo "❌ Coverage report not found. Make sure tests ran successfully."; \
	fi

test-coverage-watch:
	@echo "👀 Running tests with coverage in watch mode..."
	npm run test:coverage:watch

typecheck:
	@echo "🔍 Running TypeScript type checking..."
	npm run typecheck

# Development utilities
install:
	@echo "📦 Installing dependencies..."
	npm install

clean:
	@echo "🧹 Cleaning cache, dependencies, and logs..."
	npx expo install --fix
	npm cache clean --force
	rm -rf node_modules
	rm -rf logs
	npm install

build:
	@echo "🏗️ Building for production..."
	npx expo build

# CI/CD
ci:
	@echo "🔄 Running CI pipeline..."
	npm run ci

# Release commands
release-alpha:
	@echo "🚀 Creating alpha release and triggering TestFlight deployment..."
	@npm run release:alpha
	@echo "📲 Triggering TestFlight deployment..."
	@gh workflow run "Deploy to TestFlight" --field profile=preview

release-beta:
	@echo "🚀 Creating beta release and triggering TestFlight deployment..."
	@npm run release:beta
	@echo "📲 Triggering TestFlight deployment..."
	@gh workflow run "Deploy to TestFlight" --field profile=preview

release-production:
	@echo "🚀 Creating production release and triggering TestFlight deployment..."
	@npm run release:production
	@echo "📲 Triggering TestFlight deployment..."
	@gh workflow run "Deploy to TestFlight" --field profile=production

# Release cleanup commands
release-cleanup-alpha:
	@echo "🗑️  Cleaning up failed alpha release..."
	@npm run release:cleanup:alpha

release-cleanup-beta:
	@echo "🗑️  Cleaning up failed beta release..."
	@npm run release:cleanup:beta

release-cleanup-production:
	@echo "🗑️  Cleaning up failed production release..."
	@npm run release:cleanup:production

# Additional useful targets
logs:
	@echo "📋 Showing Expo logs..."
	npx expo logs

logs-file:
	@echo "📝 Starting Expo server with console + file logging on port $(EXPO_PORT)..."
	@mkdir -p logs
	script -q logs/expo.log npx expo start --dev-client --port $(EXPO_PORT)

logs-tail:
	@echo "👀 Following Expo logs in real time (Ctrl+C to stop)..."
	tail -f logs/expo.log

logs-view:
	@echo "📖 Current Expo logs:"
	@echo "===================="
	cat logs/expo.log

server-bg:
	@echo "🚀 Starting Expo dev server in background on port $(EXPO_PORT)..."
	@mkdir -p logs
	nohup npx expo start --dev-client --port $(EXPO_PORT) > logs/expo.log 2>&1 &
	@echo "✅ Server running in background on port $(EXPO_PORT)"
	@echo "📝 Logs: logs/expo.log (background only)"
	@echo "🔍 Monitor: make logs-tail"
	@echo "🛑 Stop: make server-stop"

server-tmux:
	@echo "🚀 Starting Expo dev server in tmux session on port $(EXPO_PORT)..."
	@if ! command -v tmux >/dev/null 2>&1; then \
		echo "❌ tmux not installed. Install with: brew install tmux"; \
		exit 1; \
	fi
	@mkdir -p logs
	@tmux has-session -t expo 2>/dev/null && tmux kill-session -t expo || true
	@tmux new-session -d -s expo -x 120 -y 30
	@tmux send-keys -t expo "script -f -q logs/expo.log npx expo start --dev-client --port $(EXPO_PORT)" Enter
	@echo "✅ Expo server running in tmux session 'expo' on port $(EXPO_PORT)"
	@echo "📺 Attach: tmux attach -t expo"
	@echo "📝 Logs: logs/expo.log (real-time)"
	@echo "🛑 Stop: tmux kill-session -t expo"

server-stop:
	@echo "🛑 Stopping background Expo servers..."
	pkill -f "expo start" || echo "No Expo servers found"
	@echo "✅ Stopped"

logs-clean:
	@echo "🗑️ Cleaning log files..."
	rm -rf logs
	@echo "✅ Logs cleaned"

tunnel:
	@echo "🌍 Starting Expo with tunnel connection on port $(EXPO_PORT)..."
	npx expo start --tunnel --port $(EXPO_PORT)

clear-cache:
	@echo "🗑️ Clearing Expo and Metro cache on port $(EXPO_PORT)..."
	npx expo start --clear --port $(EXPO_PORT)

doctor:
	@echo "🩺 Running Expo doctor..."
	npx expo doctor

# iOS specific commands
ios-device:
	@echo "📱 Running on connected iOS device..."
	npx expo run:ios --device

ios-simulator-list:
	@echo "📋 Listing available iOS simulators..."
	xcrun simctl list devices available | grep "iPhone"

# Parallel development support (multi-agent workflows)
# See docs/parallel-expo-workflow.md for details
list-sims:
	@echo "📋 Available iOS Simulators:"
	@echo "============================"
	@xcrun simctl list devices available | grep "iPhone" || echo "No simulators found"

create-polecat-sims:
	@echo "🏗️ Creating named simulators for polecats..."
	@echo "Note: This creates iPhone 15 Pro simulators with iOS 17.0"
	@echo ""
	@xcrun simctl create "iPhone 15 Pro - Polecat 1" "com.apple.CoreSimulator.SimDeviceType.iPhone-15-Pro" "com.apple.CoreSimulator.SimRuntime.iOS-17-0" 2>/dev/null || echo "✓ Polecat 1 simulator already exists"
	@xcrun simctl create "iPhone 15 Pro - Polecat 2" "com.apple.CoreSimulator.SimDeviceType.iPhone-15-Pro" "com.apple.CoreSimulator.SimRuntime.iOS-17-0" 2>/dev/null || echo "✓ Polecat 2 simulator already exists"
	@xcrun simctl create "iPhone 15 Pro - Polecat 3" "com.apple.CoreSimulator.SimDeviceType.iPhone-15-Pro" "com.apple.CoreSimulator.SimRuntime.iOS-17-0" 2>/dev/null || echo "✓ Polecat 3 simulator already exists"
	@echo ""
	@echo "✅ Simulators created. Use 'make list-sims' to verify."
	@echo "📚 See docs/parallel-expo-workflow.md for usage instructions."

ios-polecat1:
	@echo "📱 Running on Polecat 1 simulator (port 54100)..."
	EXPO_PORT=54100 npx expo run:ios --device "iPhone 15 Pro - Polecat 1"

ios-polecat2:
	@echo "📱 Running on Polecat 2 simulator (port 54101)..."
	EXPO_PORT=54101 npx expo run:ios --device "iPhone 15 Pro - Polecat 2"

ios-polecat3:
	@echo "📱 Running on Polecat 3 simulator (port 54102)..."
	EXPO_PORT=54102 npx expo run:ios --device "iPhone 15 Pro - Polecat 3"

kill-all-sims:
	@echo "🛑 Closing all running simulators..."
	@killall "Simulator" 2>/dev/null || echo "No simulators running"
	@echo "✅ All simulators closed"

# Android specific commands  
android-device:
	@echo "🤖 Running on connected Android device..."
	npx expo run:android --device

android-emulator-list:
	@echo "📋 Listing available Android emulators..."
	emulator -list-avds

# Git helpers
commit:
	@echo "💾 Adding and committing changes..."
	git add -A
	git commit

push:
	@echo "⬆️ Pushing to remote..."
	git push

pull:
	@echo "⬇️ Pulling from remote..."
	git pull

status:
	@echo "📊 Git status..."
	git status --short