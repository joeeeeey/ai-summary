# Stage 1: Build environment
FROM docker.m.daocloud.io/node:22.15.1-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package.json and yarn.lock
COPY package.json yarn.lock ./

# Install dependencies using Yarn
RUN yarn install --frozen-lockfile

# Copy the rest of the application code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build the Next.js app
RUN yarn build

# Patch the standalone server.js to force 0.0.0.0
# CAUTION: This is fragile and depends on the structure of server.js
RUN sed -i "s/const hostname = process.env.HOSTNAME || '0.0.0.0'/const hostname = '0.0.0.0'/" .next/standalone/server.js || \
    sed -i "s/hostname: process.env.HOSTNAME || '0.0.0.0'/hostname: '0.0.0.0'/" .next/standalone/server.js

# Stage 2: Production environment
FROM docker.m.daocloud.io/node:22.15.1-alpine AS runner

# Set working directory
WORKDIR /app

# Set to production environment
ENV NODE_ENV=production

# Install only the packages we need in the final image
RUN apk --no-cache add ca-certificates && \
    apk add --no-cache --virtual .build-deps curl && \
    rm -rf /var/cache/apk/* /tmp/* 

# Don't run production as root
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Create app directory and set permissions
RUN mkdir -p /app && chown -R nextjs:nodejs /app

# Switch to user
USER nextjs

# Copy only the production dependencies from builder
COPY --chown=nextjs:nodejs --from=builder /app/node_modules/.prisma /app/node_modules/.prisma
COPY --chown=nextjs:nodejs --from=builder /app/node_modules/@prisma /app/node_modules/@prisma

# Copy only necessary files from the builder stage
COPY --chown=nextjs:nodejs --from=builder /app/next.config.ts ./
COPY --chown=nextjs:nodejs --from=builder /app/public ./public
COPY --chown=nextjs:nodejs --from=builder /app/.next/standalone ./
COPY --chown=nextjs:nodejs --from=builder /app/.next/static ./.next/static
COPY --chown=nextjs:nodejs --from=builder /app/prisma ./prisma

# Expose the port that App Runner will use
EXPOSE 8080

# Set environment variables for focused debugging
ENV PORT=8080
ENV NODE_ENV=production
ENV DEBUG=next:*,express:router
ENV NEXT_DEBUG=true
ENV NEXT_TELEMETRY_DISABLED=1
# Force binding to all interfaces
ENV HOSTNAME="0.0.0.0"

# Start the application with focused logging
CMD ["sh", "-c", "node server.js 2>&1 | tee -a /tmp/app.log"]