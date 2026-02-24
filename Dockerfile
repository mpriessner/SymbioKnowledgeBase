# ──────────────────────────────────────────────────────────
# Stage 1: Install dependencies
# ──────────────────────────────────────────────────────────
FROM node:22-alpine AS deps

RUN apk add --no-cache libc6-compat openssl

WORKDIR /app

# Copy dependency manifests
COPY package.json package-lock.json ./
COPY prisma ./prisma/
COPY prisma.config.ts ./

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Generate Prisma Client
RUN npx prisma generate

# ──────────────────────────────────────────────────────────
# Stage 2: Build the application
# ──────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

RUN apk add --no-cache libc6-compat openssl

WORKDIR /app

# Copy dependencies from stage 1
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build Next.js (standalone output)
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ──────────────────────────────────────────────────────────
# Stage 3: Production runner
# ──────────────────────────────────────────────────────────
FROM node:22-alpine AS runner

RUN apk add --no-cache libc6-compat openssl

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy static assets
COPY --from=builder /app/public ./public

# Copy standalone output
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy Prisma schema and migrations (needed for migrate deploy)
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts

# Copy all node_modules (needed for Prisma CLI, seed script, and their transitive deps)
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/src/generated ./src/generated

# Copy entrypoint script
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "server.js"]
