FROM node:20-alpine3.17 AS builder

# Install dependencies for building native modules including OpenSSL
RUN apk add --no-cache python3 make g++ postgresql-client openssl openssl-dev libc6-compat

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Copy prisma schema before npm install
COPY prisma ./prisma/

# Clear Prisma cache and install ALL dependencies
RUN rm -rf ~/.cache/prisma && npm ci

# Copy source code
COPY src ./src

# Generate Prisma client with proper environment
ENV PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1
ENV PRISMA_QUERY_ENGINE_LIBRARY=/app/node_modules/.prisma/client/libquery_engine-linux-musl-openssl-3.0.x.so.node
RUN npx prisma generate --schema=./prisma/schema.prisma

# Build TypeScript
RUN npm run build

# Production stage
FROM node:20-alpine3.17

# Install runtime dependencies including PostgreSQL client for migrations and OpenSSL
# Also install build tools needed for bcrypt at runtime
RUN apk add --no-cache python3 make g++ postgresql-client openssl openssl-dev libc6-compat && \
    rm -rf ~/.cache/prisma

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install only production dependencies
RUN npm ci --only=production

# Rebuild bcrypt with correct bindings
RUN npm rebuild bcrypt --build-from-source

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Copy Prisma client from builder stage
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Copy additional files needed at runtime
COPY .env.example .env.example
COPY register.html ./
COPY emergency.html ./
COPY public ./public

# Generate Prisma client again for production with correct binary target
ENV PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1
ENV PRISMA_QUERY_ENGINE_LIBRARY=/app/node_modules/.prisma/client/libquery_engine-linux-musl-openssl-3.0.x.so.node
RUN npx prisma generate --schema=./prisma/schema.prisma

# Create logs directory
RUN mkdir -p /app/logs

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Change ownership
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); })"

# Start the application
CMD ["npm", "run", "start:railway"]