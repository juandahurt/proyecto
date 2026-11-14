# =============================================================================
# Stage 1: builder
# Instala todas las dependencias (incluyendo devDependencies) y compila TS.
# El build context es la raíz del workspace para acceder a packages/.
# =============================================================================
FROM node:20-alpine AS builder

WORKDIR /workspace

# Copiar manifiestos de dependencias del workspace raíz
COPY package.json package-lock.json turbo.json ./

# Copiar package.json de cada workspace member para que npm ci resuelva el grafo
COPY packages/shared-types/package.json ./packages/shared-types/
COPY apps/backend/package.json ./apps/backend/

# Herramientas de compilación nativa para better-sqlite3 (addon C++ compilado con node-gyp)
RUN apk add --no-cache python3 make g++

# Instalar todas las dependencias (incluyendo dev) dentro del contenedor Linux.
# Esto compila better-sqlite3 para Linux — no copiar node_modules del host macOS.
RUN npm ci

# Copiar el código fuente de los packages necesarios
COPY packages/shared-types/ ./packages/shared-types/
COPY apps/backend/ ./apps/backend/

# Compilar shared-types primero (backend depende de él)
RUN npm run build -w packages/shared-types

# Compilar el backend
RUN npm run build -w apps/backend

# =============================================================================
# Stage 2: runtime
# Imagen mínima con solo las dependencias de producción y los artefactos compilados.
# =============================================================================
FROM node:20-alpine AS runtime

WORKDIR /app

# Copiar manifiestos para instalar solo prod deps
COPY package.json package-lock.json turbo.json ./
COPY packages/shared-types/package.json ./packages/shared-types/
COPY apps/backend/package.json ./apps/backend/

# Instalar solo dependencias de producción
RUN npm ci --omit=dev

# Copiar artefactos compilados del stage builder
COPY --from=builder /workspace/packages/shared-types/dist ./packages/shared-types/dist
COPY --from=builder /workspace/apps/backend/dist ./apps/backend/dist

# Crear directorio para SQLite efímera (se pierde al reiniciar el Pod — aceptable para skeleton)
RUN mkdir -p /app/data

EXPOSE 3000

# El entry point está en apps/backend/dist/index.js relativo al WORKDIR /app
CMD ["node", "apps/backend/dist/index.js"]
