# ==============================================================
# Dockerfile for "زاد الأنصاري" (مشورة إب)
# Multi-stage build for minimal production image size
# ==============================================================

# Stage 1: Build static web bundle
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies needed for native modules build if any
RUN apk add --no-cache libc6-compat

# Copy package files
COPY package*.json ./

# Install all dependencies
RUN npm ci --legacy-peer-deps || npm install

# Copy application source
COPY . .

# Build production web bundle
RUN npm run build:web

# Stage 2: Production runtime environment
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Copy minimal production dependencies
COPY package*.json ./
RUN npm ci --only=production --legacy-peer-deps || npm install --production

# Copy server and built static assets
COPY server.js ./
COPY --from=builder /app/dist ./dist

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 zadapp && \
    chown -R zadapp:nodejs /app

USER zadapp

EXPOSE 3000

CMD ["node", "server.js"]
