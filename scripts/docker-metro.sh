#!/bin/bash
# Start Metro in Docker with dynamic port mapping
# Usage: ./scripts/docker-metro.sh [PORT]
# Default port: 54100

PORT=${1:-54100}

echo "🐳 Building Docker image for Metro server..."
docker build -t liftmark-metro -f Dockerfile.metro .

echo "🚀 Starting Metro in Docker container on host port $PORT..."
echo "   Container port: 8081"
echo "   Host port: $PORT"
echo ""
echo "To stop: Press Ctrl+C or run 'docker stop' with the container ID"
echo ""

docker run --rm -p $PORT:8081 -v $(pwd):/app liftmark-metro
