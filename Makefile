# LiftMark Development Makefile

.PHONY: all help server server-go server-bg server-tmux server-stop ios prebuild rebuild-native rebuild-ios android web test test-coverage test-coverage-open test-coverage-watch typecheck lint clean build logs logs-file logs-tail logs-view logs-clean list-sims kill-all-sims load-db

# Dependency tracking - node_modules is rebuilt when package files change
node_modules: package.json package-lock.json
	@echo "📦 Installing dependencies..."
	npm install
	@touch node_modules

# Default target - Full build (install deps + prebuild + dev client)
all: node_modules prebuild
	@echo "✅ Build complete! Native projects generated."
	@echo ""
	@echo "Next steps:"
	@echo "  make ios     - Run on iOS simulator"
	@echo "  make android - Run on Android emulator"
	@echo "  make server  - Start dev server only"

help:
	@echo "LiftMark Development Commands:"
	@echo ""
	@echo "Quick start:"
	@echo "  make            - Full build (auto-installs deps + prebuild native projects)"
	@echo "  make ios        - Run on iOS (auto-installs deps if package.json changed)"
	@echo "  make clean      - Clean everything (native builds, node_modules, cache)"
	@echo "  make clean && make - Complete rebuild from scratch"
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
	@echo "Simulator management:"
	@echo "  make list-sims     - List all available iOS simulators"
	@echo "  make kill-all-sims - Close all running simulators"
	@echo ""
	@echo "Native builds:"
	@echo "  make prebuild       - Generate native projects (ios/android)"
	@echo "  make rebuild-native - Clean and regenerate native projects"
	@echo "  make rebuild-ios    - Prebuild and run on iOS simulator"
	@echo ""
	@echo "  make test              - Run test suite"
	@echo "  make test-watch        - Run tests in watch mode"
	@echo "  make test-coverage     - Run tests with coverage report"
	@echo "  make test-coverage-open - Run coverage tests and open HTML report"
	@echo "  make test-coverage-watch - Run coverage tests in watch mode"
	@echo "  make typecheck  - Run TypeScript type checking"
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
	@echo "Database utilities:"
	@echo "  make load-db DB=<path> - Load database into booted simulator (backs up existing)"
	@echo ""
	@echo "Release commands:"
	@echo "  make release-alpha      - Create alpha release"
	@echo "  make release-beta       - Create beta release" 
	@echo "  make release-production - Create production release"

# Development servers
server: node_modules
	@echo "🚀 Starting Expo development server with dev client..."
	@mkdir -p logs
	script -q logs/expo.log npx expo start --dev-client

server-go: node_modules
	@echo "📱 Starting Expo development server for Expo Go..."
	@mkdir -p logs
	script -q logs/expo.log npx expo start

ios: node_modules
	@echo "📱 Running development build on iOS simulator..."
	npx expo run:ios

prebuild: node_modules
	@echo "🔧 Generating native projects..."
	npx expo prebuild

rebuild-native:
	@echo "🧹 Cleaning native directories..."
	rm -rf ios android
	@echo "🔧 Regenerating native projects..."
	npx expo prebuild
	@echo "✅ Native projects rebuilt. Run 'make ios' or 'make android' to build."

rebuild-ios: node_modules
	@echo "🔄 Rebuilding iOS dev client (prebuild + run)..."
	npx expo prebuild && npx expo run:ios

android: node_modules
	@echo "🤖 Running development build on Android emulator..."
	npx expo run:android

web: node_modules
	@echo "🌐 Starting web development server..."
	npx expo start --web

# Testing
test: node_modules
	@echo "🔒 Running security audit..."
	npm audit || true
	@echo ""
	@echo "🔍 Running TypeScript type checking..."
	npm run typecheck
	@echo ""
	@echo "🧪 Running unit tests..."
	npm run test

test-watch: node_modules
	@echo "👀 Running tests in watch mode..."
	npm run test:watch

test-coverage: node_modules
	@echo "📊 Running tests with coverage report..."
	npm run test:coverage

test-coverage-open: node_modules
	@echo "📊 Running tests with coverage and opening report..."
	npm run test:coverage
	@if [ -f coverage/lcov-report/index.html ]; then \
		echo "🌐 Opening coverage report in browser..."; \
		open coverage/lcov-report/index.html; \
	else \
		echo "❌ Coverage report not found. Make sure tests ran successfully."; \
	fi

test-coverage-watch: node_modules
	@echo "👀 Running tests with coverage in watch mode..."
	npm run test:coverage:watch

typecheck: node_modules
	@echo "🔍 Running TypeScript type checking..."
	npm run typecheck

# Development utilities
install: node_modules
	@echo "✅ Dependencies installed"

clean:
	@echo "🧹 Cleaning everything (cache, dependencies, native builds, logs)..."
	@echo "  → Removing native projects..."
	rm -rf ios android
	@echo "  → Removing node_modules..."
	rm -rf node_modules
	@echo "  → Removing logs..."
	rm -rf logs
	@echo "  → Cleaning npm cache..."
	npm cache clean --force
	@echo "✅ Clean complete! Run 'make' or 'make all' to rebuild."

build: node_modules
	@echo "🏗️ Building for production..."
	npx expo build

# CI/CD
ci: node_modules
	@echo "🔄 Running CI pipeline..."
	npm run ci

# Release commands
release-alpha:
	@echo "🚀 Creating alpha release and triggering TestFlight deployment..."
	npm run release:alpha
	gh workflow run "Deploy to TestFlight" --field profile=preview

release-beta:
	@echo "🚀 Creating beta release and triggering TestFlight deployment..."
	npm run release:beta
	gh workflow run "Deploy to TestFlight" --field profile=preview

release-production:
	@echo "🚀 Creating production release and triggering TestFlight deployment..."
	npm run release:production
	gh workflow run "Deploy to TestFlight" --field profile=production

# Additional useful targets
logs:
	@echo "📋 Showing Expo logs..."
	npx expo logs

logs-file:
	@echo "📝 Starting Expo server with console + file logging..."
	@mkdir -p logs
	script -q logs/expo.log npx expo start --dev-client

logs-tail:
	@echo "👀 Following Expo logs in real time (Ctrl+C to stop)..."
	tail -f logs/expo.log

logs-view:
	@echo "📖 Current Expo logs:"
	@echo "===================="
	cat logs/expo.log

server-bg:
	@echo "🚀 Starting Expo dev server in background..."
	@mkdir -p logs
	nohup npx expo start --dev-client > logs/expo.log 2>&1 &
	@echo "✅ Server running in background"
	@echo "📝 Logs: logs/expo.log (background only)"
	@echo "🔍 Monitor: make logs-tail"
	@echo "🛑 Stop: make server-stop"

server-tmux:
	@echo "🚀 Starting Expo dev server in tmux session..."
	@if ! command -v tmux >/dev/null 2>&1; then \
		echo "❌ tmux not installed. Install with: brew install tmux"; \
		exit 1; \
	fi
	@mkdir -p logs
	@tmux has-session -t expo 2>/dev/null && tmux kill-session -t expo || true
	@tmux new-session -d -s expo -x 120 -y 30
	@tmux send-keys -t expo "script -f -q logs/expo.log npx expo start --dev-client" Enter
	@echo "✅ Expo server running in tmux session 'expo'"
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

# iOS specific commands
ios-device:
	@echo "📱 Running on connected iOS device..."
	npx expo run:ios --device

ios-simulator-list:
	@echo "📋 Listing available iOS simulators..."
	xcrun simctl list devices available | grep "iPhone"

# Simulator management
list-sims:
	@echo "📋 Available iOS Simulators:"
	@echo "============================"
	@xcrun simctl list devices available | grep "iPhone" || echo "No simulators found"

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

# Database utilities
load-db:
	@if [ -z "$(DB)" ]; then \
		echo "Usage: make load-db DB=<path-to-database>"; \
		echo ""; \
		echo "Example:"; \
		echo "  make load-db DB=~/Downloads/liftmark.db"; \
		exit 1; \
	fi
	@bash scripts/load-db.sh "$(DB)"