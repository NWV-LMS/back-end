# =============================================================================
# Multi-stage Dockerfile for NestJS + Prisma Production Build
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Builder - Install dependencies and build the application
# -----------------------------------------------------------------------------
# node:20-slim (debian-slim) keeps glibc compatibility so Prisma's native
# engines match the runtime. Alpine uses musl and causes engine mismatches.
FROM node:20-slim AS builder

WORKDIR /app

# Copy dependency files first for better layer caching
COPY package*.json ./
COPY prisma ./prisma/

# Install all dependencies (including devDependencies for build)
# --ignore-scripts skips postinstall (seed needs DATABASE_URL, unavailable at build time)
RUN npm ci --ignore-scripts

# Copy source code and build
COPY . .
RUN npx prisma generate
RUN npm run build
# Compile seed script
RUN npx tsc prisma/seed.ts --outDir dist --module commonjs --target ES2021 --skipLibCheck

# -----------------------------------------------------------------------------
# Stage 2: Runner - Production image with minimal footprint
# -----------------------------------------------------------------------------
FROM node:20-slim AS runner

# Install OpenSSL for Prisma engine compatibility
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install production dependencies only (skip postinstall)
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts

# Install Prisma CLI for migrations (required in production)
RUN npm install prisma @prisma/config dotenv --save --ignore-scripts

# Copy Prisma files and generated clients from builder
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/generated ./generated

# Copy the Prisma generated client from node_modules (this is the critical fix!)
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client

# Copy built application
COPY --from=builder /app/dist ./dist

# Copy Docker-specific configuration files
COPY docker/prisma.config.js ./prisma.config.js
COPY docker/entrypoint.sh ./entrypoint.sh

# Ensure entrypoint is executable
RUN chmod +x ./entrypoint.sh

# Set environment variables
ENV NODE_ENV=production

# Create uploads dir and run as non-root for security.
RUN mkdir -p /app/uploads/logos && \
    groupadd --system nestjs && \
    useradd --system --gid nestjs --no-create-home nestjs && \
    chown -R nestjs:nestjs /app

USER nestjs

# Expose application port
EXPOSE 3001

# Start application via entrypoint script
CMD ["./entrypoint.sh"]
