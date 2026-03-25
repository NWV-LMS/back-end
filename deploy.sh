#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

# Log colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Starting Deployment ===${NC}"

# 1. Update source code from GitHub
echo -e "${BLUE}1. Pulling latest changes from develop...${NC}"
git checkout develop
git pull origin develop

# 2. Rebuild and restart Docker containers
# --build: forces rebuild of images
# --remove-orphans: cleans up containers for services not defined in compose.yaml
echo -e "${BLUE}2. Rebuilding and starting Docker services...${NC}"
docker compose up -d --build --remove-orphans

# 3. Clean up unused images and build cache to save disk space
echo -e "${BLUE}3. Pruning old Docker images...${NC}"
docker image prune -f

# 4. Verify service health (Optional but recommended)
echo -e "${BLUE}4. Checking container status...${NC}"
docker compose ps

echo -e "${GREEN}=== Deployment Successful! ===${NC}"