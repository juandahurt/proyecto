# =============================================================================
# Stage 1: builder (Vite)
# =============================================================================
FROM node:20-slim AS builder

WORKDIR /workspace

COPY package.json package-lock.json turbo.json ./
COPY packages/shared-types/package.json ./packages/shared-types/
COPY apps/frontend/package.json ./apps/frontend/

RUN npm ci

COPY packages/shared-types/ ./packages/shared-types/
COPY apps/frontend/ ./apps/frontend/

RUN npm run build -w packages/shared-types
RUN npm run build -w apps/frontend

# =============================================================================
# Stage 2: nginx sin root (usuario nginx, uid 101) sirviendo la SPA en 8080
# =============================================================================
FROM nginxinc/nginx-unprivileged:1.27-alpine AS runtime

COPY --from=builder /workspace/apps/frontend/dist /usr/share/nginx/html

EXPOSE 8080
