# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies (including devDependencies for building)
COPY package*.json ./
COPY prisma ./prisma/
RUN npm install

# Copy source code and build
COPY . .
RUN npx prisma generate
RUN npm run build

# Stage 2: Runner
FROM node:20-alpine AS runner

WORKDIR /app

# Copy package.json and install only production dependencies
COPY package*.json ./
RUN npm install --omit=dev

# Install Prisma CLI and dependencies for migrations (needed in production)
RUN npm install prisma @prisma/config ts-node dotenv --save

# Copy built files from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/generated ./generated

# Always create prisma.config.js (required for Prisma 7 migrate deploy)
# Create config file that will be evaluated at runtime when DATABASE_URL is available
RUN printf '%s\n' \
  "require('dotenv/config');" \
  "const { defineConfig, env } = require('prisma/config');" \
  "module.exports = defineConfig({" \
  "  schema: 'prisma/schema.prisma'," \
  "  migrations: { path: 'prisma/migrations' }," \
  "  datasource: { url: env('DATABASE_URL') || process.env.DATABASE_URL }" \
  "});" > prisma.config.js && \
  echo "Created prisma.config.js" && \
  echo "Config file structure:" && \
  cat prisma.config.js

# Set environment variables
ENV NODE_ENV=production

# Expose port
EXPOSE 3000

# Create entrypoint script with config verification
RUN printf '%s\n' \
  '#!/bin/sh' \
  'set -e' \
  'echo "=== Starting migration ==="' \
  'echo "Current directory: $(pwd)"' \
  'echo "DATABASE_URL is set: $([ -n "$DATABASE_URL" ] && echo YES || echo NO)"' \
  'if [ -z "$DATABASE_URL" ]; then' \
  '  echo "ERROR: DATABASE_URL is not set"' \
  '  exit 1' \
  'fi' \
  'echo "=== Verifying prisma.config.js ==="' \
  'if [ -f prisma.config.js ]; then' \
  '  echo "prisma.config.js exists"' \
  '  echo "Config file content:"' \
  '  cat prisma.config.js' \
  '  echo ""' \
  '  echo "Testing config load:"' \
  '  node -e "require(\"dotenv/config\"); const config = require(\"./prisma.config.js\"); console.log(\"Config loaded:\", JSON.stringify(config, null, 2)); console.log(\"Has datasource:\", !!config.datasource); console.log(\"Datasource URL:\", config.datasource?.url || \"UNDEFINED\");" || echo "Config load failed"' \
  'else' \
  '  echo "ERROR: prisma.config.js not found"' \
  '  exit 1' \
  'fi' \
  'echo "=== Running prisma migrate deploy ==="' \
  'npx prisma migrate deploy' \
  'echo "=== Migrations completed, starting app ==="' \
  'exec npm run start:prod' > /app/entrypoint.sh && chmod +x /app/entrypoint.sh

# Run migrations and start the application
CMD ["/app/entrypoint.sh"]
