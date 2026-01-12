#!/bin/bash
# Build iOS dev client for Docker Metro
# Usage: ./scripts/build-for-docker.sh [PORT]
# Default port: 54100
#
# IMPORTANT: Start Docker Metro BEFORE running this script:
#   ./scripts/docker-metro.sh [PORT]

PORT=${1:-54100}

echo "📱 Building iOS development client for Docker Metro..."
echo "   Metro should be running at: http://host.docker.internal:$PORT"
echo ""
echo "⚠️  Make sure Docker Metro is already running!"
echo "   If not, start it first: ./scripts/docker-metro.sh $PORT"
echo ""
echo "This will:"
echo "  1. Configure the dev client to connect to Metro on host port $PORT"
echo "  2. Build the iOS app WITHOUT starting its own Metro (--no-bundler)"
echo "  3. Install on simulator"
echo "  4. App will connect to the Docker Metro you started"
echo ""

# Check if Metro is accessible
if ! curl -s http://localhost:$PORT/status > /dev/null 2>&1; then
    echo "❌ WARNING: No Metro detected on port $PORT"
    echo "   Start Docker Metro first: ./scripts/docker-metro.sh $PORT"
    echo ""
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Set environment variable for packager proxy
export EXPO_PACKAGER_PROXY_URL=http://host.docker.internal:$PORT

# Build iOS dev client WITHOUT starting Metro bundler
npx expo run:ios --no-bundler
