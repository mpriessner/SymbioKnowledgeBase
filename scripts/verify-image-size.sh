#!/bin/bash
set -euo pipefail

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Verify production Docker image size is under 500MB
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

MAX_SIZE_MB=500
IMAGE_NAME="symbioknowledgebase-app"

echo "Building production image..."
docker compose -f docker-compose.prod.yml build app

# Get image size in bytes
SIZE_BYTES=$(docker image inspect "$IMAGE_NAME" --format='{{.Size}}' 2>/dev/null)

if [ -z "$SIZE_BYTES" ]; then
  echo "ERROR: Could not find image: $IMAGE_NAME"
  echo "       Make sure to build with: docker compose -f docker-compose.prod.yml build"
  exit 1
fi

SIZE_MB=$((SIZE_BYTES / 1024 / 1024))

echo ""
echo "Image: $IMAGE_NAME"
echo "Size:  ${SIZE_MB}MB"
echo "Limit: ${MAX_SIZE_MB}MB"
echo ""

if [ "$SIZE_MB" -gt "$MAX_SIZE_MB" ]; then
  echo "FAIL: Image size (${SIZE_MB}MB) exceeds limit (${MAX_SIZE_MB}MB)."
  echo ""
  echo "Debug: Check which layers are largest:"
  echo "  docker history $IMAGE_NAME"
  exit 1
fi

echo "PASS: Image size (${SIZE_MB}MB) is within limit (${MAX_SIZE_MB}MB)."
