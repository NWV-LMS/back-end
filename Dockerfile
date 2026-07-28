# =============================================================================
# Multi-stage Dockerfile for NestJS + Prisma Production Build
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Builder - Install dependencies and build the application
# -----------------------------------------------------------------------------
FROM node:20-slim AS builder

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

# --ignore-scripts: postinstall runs seed which needs DATABASE_URL (unavailable at build time)
RUN npm ci --ignore-scripts

COPY . .
RUN npx prisma generate
RUN npm run build
RUN npx tsc prisma/seed.ts --outDir dist --module commonjs --target ES2021 --skipLibCheck

# Prune devDependencies so we can copy a clean production node_modules
RUN npm prune --omit=dev

# -----------------------------------------------------------------------------
# Stage 2: Runner - Production image with minimal footprint
# -----------------------------------------------------------------------------
FROM node:20-slim AS runner

RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy pruned production node_modules from builder (includes prisma, dotenv, etc.)
COPY --from=builder /app/node_modules ./node_modules

# Copy Prisma generated client (lives outside regular node_modules tree)
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Copy Prisma schema + migrations
COPY --from=builder /app/prisma ./prisma

# Copy built application
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json

# Copy Docker-specific configuration files
COPY docker/prisma.config.js ./prisma.config.js
COPY docker/entrypoint.sh ./entrypoint.sh

RUN chmod +x ./entrypoint.sh

ENV NODE_ENV=production

RUN mkdir -p /app/uploads/logos && \
    groupadd --system nestjs && \
    useradd --system --gid nestjs --no-create-home nestjs && \
    chown -R nestjs:nestjs /app

USER nestjs

EXPOSE 3001

CMD ["./entrypoint.sh"]
