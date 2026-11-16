# =============================================================================
# Stage 1: builder
# =============================================================================
FROM node:20-slim AS builder

WORKDIR /workspace

COPY package.json package-lock.json turbo.json ./
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/auth-middleware/package.json ./packages/auth-middleware/
COPY apps/identity-service/package.json ./apps/identity-service/

RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
RUN npm ci

COPY packages/shared-types/ ./packages/shared-types/
COPY packages/auth-middleware/ ./packages/auth-middleware/
COPY apps/identity-service/ ./apps/identity-service/

RUN npm run build -w packages/shared-types
RUN npm run build -w packages/auth-middleware
RUN npm run build -w apps/identity-service

# =============================================================================
# Stage 2: runtime
# =============================================================================
FROM node:20-slim AS runtime

WORKDIR /app

COPY package.json turbo.json ./
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/auth-middleware/package.json ./packages/auth-middleware/
COPY apps/identity-service/package.json ./apps/identity-service/

COPY --from=builder /workspace/node_modules ./node_modules
COPY --from=builder /workspace/packages/shared-types/dist ./packages/shared-types/dist
COPY --from=builder /workspace/packages/auth-middleware/dist ./packages/auth-middleware/dist
COPY --from=builder /workspace/apps/identity-service/dist ./apps/identity-service/dist

RUN mkdir -p /app/data
EXPOSE 3100
CMD ["node", "apps/identity-service/dist/index.js"]
