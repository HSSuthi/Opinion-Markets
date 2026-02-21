# Multi-stage build for Opinion-Markets API
# Stage 1: Builder
FROM node:18-alpine as builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* yarn.lock* ./

# Install dependencies
RUN npm ci || npm install

# Copy source code
COPY src ./src
COPY tsconfig.json ./

# Build TypeScript
RUN npm run build

# Stage 2: Runtime
FROM node:18-alpine

WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create non-root user
RUN addgroup -g 1000 api && adduser -D -u 1000 -G api api

# Copy package files
COPY package.json package-lock.json* yarn.lock* ./

# Install production dependencies only
ENV NODE_ENV=production
RUN npm ci --only=production || npm install --only=production

# Copy built application from builder
COPY --from=builder --chown=api:api /app/dist ./dist

# Switch to non-root user
USER api

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start application
CMD ["node", "dist/server.js"]

# Labels
LABEL org.opencontainers.image.title="Opinion-Markets API"
LABEL org.opencontainers.image.description="REST API for Opinion-Markets prediction platform"
LABEL org.opencontainers.image.version="0.1.0"
LABEL org.opencontainers.image.url="https://github.com/HSSuthi/Opinion-Markets"
