#!/bin/bash
# =============================================================================
# Server-side deploy for the Timeweb VPS.
# Pulls BOTH repos, rebuilds images, restarts the stack.
#
# Layout (siblings):
#   /opt/bilimnuru/back-end   <- this script + compose.yaml
#   /opt/bilimnuru/front-end  <- built by compose as ../front-end
#
# Called by GitHub Actions (.github/workflows/deploy.yml) over SSH, or run
# manually: `bash deploy.sh`. FRONT_BRANCH can be overridden by the caller.
# =============================================================================
set -e

GREEN='\033[0;32m'; BLUE='\033[0;34m'; NC='\033[0m'

BACK_DIR="$(cd "$(dirname "$0")" && pwd)"
FRONT_DIR="$(cd "$BACK_DIR/../front-end" && pwd)"
FRONT_BRANCH="${FRONT_BRANCH:-main}"

echo -e "${BLUE}1. Pull back-end (master)...${NC}"
cd "$BACK_DIR"
git fetch origin master
git checkout master
git reset --hard origin/master      # deploy target: discard local drift (.env is gitignored, kept)

echo -e "${BLUE}2. Pull front-end (${FRONT_BRANCH})...${NC}"
cd "$FRONT_DIR"
git fetch origin "$FRONT_BRANCH"
git checkout "$FRONT_BRANCH"
git reset --hard "origin/${FRONT_BRANCH}"

echo -e "${BLUE}3. Build + restart (migrations auto-run via entrypoint)...${NC}"
cd "$BACK_DIR"
docker compose up -d --build --remove-orphans

echo -e "${BLUE}4. Prune old images...${NC}"
docker image prune -f

echo -e "${BLUE}5. Status:${NC}"
docker compose ps

echo -e "${GREEN}=== Deployment Successful! ===${NC}"
