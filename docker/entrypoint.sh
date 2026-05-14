#!/bin/sh
set -e

echo "=== Starting application ==="
echo "Current directory: $(pwd)"

# Validate DATABASE_URL
if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL is not set"
  exit 1
fi
echo "DATABASE_URL is set: YES"

# LD_LIBRARY_PATH will be handled by the OS in standard locations

# Run database migrations
echo "=== Running Prisma migrations ==="
npx prisma migrate deploy

# Run database seed (only when explicitly requested)
if [ "${RUN_SEED:-false}" = "true" ]; then
  echo "=== Running database seed (RUN_SEED=true) ==="
  node dist/prisma/seed.js
else
  echo "=== Skipping seed (set RUN_SEED=true to run) ==="
fi

# Start the application
echo "=== Migrations completed, starting app ==="
exec npm run start:prod
