FROM node:20-alpine AS builder

# Install dependencies for building native modules
RUN apk add --no-cache python3 make g++ postgresql-client

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/
COPY tsconfig.json ./

# Install ALL dependencies (including dev dependencies for building)
RUN npm ci

# Copy source code
COPY src ./src

# Generate Prisma client
RUN npx prisma generate

# Build TypeScript
RUN npm run build

# Production stage
FROM node:20-alpine

# Install runtime dependencies including PostgreSQL client for migrations and OpenSSL
# Also install build tools needed for bcrypt at runtime
RUN apk add --no-cache python3 make g++ postgresql-client openssl openssl-dev libc6-compat

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install only production dependencies
RUN npm ci --only=production

# Rebuild bcrypt for Alpine Linux production environment
RUN npm rebuild bcrypt --build-from-source

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Copy additional files needed at runtime
COPY .env.example .env.example
COPY register.html ./
COPY emergency.html ./
COPY public ./public

# Generate Prisma client again for production with correct binary target
ENV PRISMA_BINARIES_MIRROR=https://prisma-builds.s3.eu-west-1.amazonaws.com
RUN npx prisma generate

# Create logs directory
RUN mkdir -p /app/logs

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Change ownership
RUN chown -R nodejs:nodejs /app

USER nodejs

# Expose port
EXPOSE 3000

# Use the Railway-specific start command
CMD ["npm", "run", "start:railway"]