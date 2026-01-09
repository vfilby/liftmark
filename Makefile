# LiftMark Development Makefile

.PHONY: help server server-go server-bg server-tmux server-stop ios prebuild rebuild-native rebuild-ios android web test typecheck lint clean install build logs logs-file logs-tail logs-view logs-clean

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
	@echo "Native builds:"
	@echo "  make prebuild       - Generate native projects (ios/android)"
	@echo "  make rebuild-native - Clean and regenerate native projects"
	@echo "  make rebuild-ios    - Prebuild and run on iOS simulator"
	@echo ""
	@echo "  make test       - Run test suite"
	@echo "  make test-watch - Run tests in watch mode"
	@echo "  make test-coverage - Run tests with coverage report"
	@echo "  make typecheck  - Run TypeScript type checking"
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
	@echo "  make release-alpha      - Create alpha release"
	@echo "  make release-beta       - Create beta release" 
	@echo "  make release-production - Create production release"

# Development servers
server:
	@echo "🚀 Starting Expo development server with dev client..."
	@mkdir -p logs
	script -q logs/expo.log npx expo start --dev-client

server-go:
	@echo "📱 Starting Expo development server for Expo Go..."
	@mkdir -p logs
	script -q logs/expo.log npx expo start

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
	@echo "🌐 Starting web development server..."
	npx expo start --web

# Testing
test:
	@echo "🧪 Running tests..."
	npm run test

test-watch:
	@echo "👀 Running tests in watch mode..."
	npm run test:watch

test-coverage:
	@echo "📊 Running tests with coverage report..."
	npm run test:coverage

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
	@echo "🚀 Creating alpha release..."
	npm run release:alpha

release-beta:
	@echo "🚀 Creating beta release..."
	npm run release:beta

release-production:
	@echo "🚀 Creating production release..."
	npm run release:production

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
	@echo "🚀 Starting Expo dev server in background with file logging..."
	@mkdir -p logs
	nohup npx expo start --dev-client > logs/expo.log 2>&1 &
	@echo "✅ Server running in background"
	@echo "📝 Logs: logs/expo.log (background only)"
	@echo "🔍 Monitor: make logs-tail"
	@echo "🛑 Stop: make server-stop"

server-tmux:
	@echo "🚀 Starting Expo dev server in tmux session with logging..."
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

tunnel:
	@echo "🌍 Starting Expo with tunnel connection..."
	npx expo start --tunnel

clear-cache:
	@echo "🗑️ Clearing Expo and Metro cache..."
	npx expo start --clear

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