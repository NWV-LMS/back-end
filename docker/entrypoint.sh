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

# Run database migrations
echo "=== Running Prisma migrations ==="
npx prisma migrate deploy

# Run database seed
echo "=== Running database seed ==="
node dist/prisma/seed.js

# Start the application
echo "=== Migrations completed, starting app ==="
exec npm run start:prod
