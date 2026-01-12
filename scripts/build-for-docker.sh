#!/bin/bash
# Build iOS dev client for Docker Metro
# Usage: ./scripts/build-for-docker.sh [PORT]
# Default port: 54100

PORT=${1:-54100}

echo "📱 Building iOS development client for Docker Metro..."
echo "   Metro will be accessible at: http://host.docker.internal:$PORT"
echo ""
echo "This will:"
echo "  1. Configure the dev client to connect to Metro on host port $PORT"
echo "  2. Build the iOS app with development client"
echo "  3. Install on simulator"
echo ""
echo "After building, start Metro with: ./scripts/docker-metro.sh $PORT"
echo ""

# Set environment variable for packager proxy
export EXPO_PACKAGER_PROXY_URL=http://host.docker.internal:$PORT

# Build iOS dev client
npx expo run:ios
