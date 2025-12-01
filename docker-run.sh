#!/bin/bash
# Quick script to run IFC Clash Detection with Docker

set -e

echo "🐳 Building and starting IFC Clash Detection with Docker..."
echo ""

# Stop any existing containers using port 8080
echo "Checking for existing containers on port 8080..."
EXISTING=$(docker ps -a --filter "publish=8080" --format "{{.ID}}" | head -1)
if [ ! -z "$EXISTING" ]; then
    echo "Stopping existing container $EXISTING..."
    docker stop $EXISTING 2>/dev/null || true
    docker rm $EXISTING 2>/dev/null || true
fi

# Clean up any stopped containers
docker-compose down 2>/dev/null || true

# Build and start with docker-compose
docker-compose up --build

