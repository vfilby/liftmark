# LiftMark Development Makefile

.PHONY: help server server-go ios android web test typecheck lint clean install build

# Default target
help:
	@echo "LiftMark Development Commands:"
	@echo ""
	@echo "Development servers:"
	@echo "  make server     - Start Expo dev server for development builds"
	@echo "  make server-go  - Start Expo dev server for Expo Go"
	@echo "  make ios        - Run development build on iOS simulator"
	@echo "  make android    - Run development build on Android emulator"
	@echo "  make web        - Start web development server"
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
	@echo "Release commands:"
	@echo "  make release-alpha      - Create alpha release"
	@echo "  make release-beta       - Create beta release" 
	@echo "  make release-production - Create production release"

# Development servers
server:
	@echo "🚀 Starting Expo development server with dev client..."
	npx expo start --dev-client

server-go:
	@echo "📱 Starting Expo development server for Expo Go..."
	npx expo start

ios:
	@echo "📱 Running development build on iOS simulator..."
	npx expo run:ios

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
	@echo "🧹 Cleaning cache and dependencies..."
	npx expo install --fix
	npm cache clean --force
	rm -rf node_modules
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