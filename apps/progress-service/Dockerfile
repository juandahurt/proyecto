# =============================================================================
# Stage 1: builder
# =============================================================================
FROM node:20-slim AS builder

WORKDIR /workspace

COPY package.json package-lock.json turbo.json ./
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/auth-middleware/package.json ./packages/auth-middleware/
COPY apps/progress-service/package.json ./apps/progress-service/

RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
RUN npm ci

COPY packages/shared-types/ ./packages/shared-types/
COPY packages/auth-middleware/ ./packages/auth-middleware/
COPY apps/progress-service/ ./apps/progress-service/

RUN npm run build -w packages/shared-types
RUN npm run build -w packages/auth-middleware
RUN npm run build -w apps/progress-service

# =============================================================================
# Stage 2: runtime
# =============================================================================
FROM node:20-slim AS runtime

WORKDIR /app

COPY package.json turbo.json ./
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/auth-middleware/package.json ./packages/auth-middleware/
COPY apps/progress-service/package.json ./apps/progress-service/

COPY --from=builder /workspace/node_modules ./node_modules
COPY --from=builder /workspace/packages/shared-types/dist ./packages/shared-types/dist
COPY --from=builder /workspace/packages/auth-middleware/dist ./packages/auth-middleware/dist
COPY --from=builder /workspace/apps/progress-service/dist ./apps/progress-service/dist

EXPOSE 3400
CMD ["node", "apps/progress-service/dist/index.js"]
