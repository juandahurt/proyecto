# =============================================================================
# Stage 1: builder
# Instala todas las dependencias (incluyendo devDependencies) y compila TS.
# El build context es la raíz del workspace para acceder a packages/.
# =============================================================================
FROM node:20-slim AS builder

WORKDIR /workspace

# Copiar manifiestos de dependencias del workspace raíz
COPY package.json package-lock.json turbo.json ./

# Copiar package.json de cada workspace member para que npm ci resuelva el grafo
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/auth-middleware/package.json ./packages/auth-middleware/
COPY apps/ingestion-service/package.json ./apps/ingestion-service/

# Herramientas de compilación nativa para better-sqlite3
# (addon C++ compilado con node-gyp — requiere python3, make, g++)
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*

# Instalar todas las dependencias (incluyendo dev) dentro del contenedor Linux.
# Esto compila better-sqlite3 para Linux — no copiar node_modules del host macOS.
RUN npm ci

# Copiar el código fuente de los packages necesarios
COPY packages/shared-types/ ./packages/shared-types/
COPY packages/auth-middleware/ ./packages/auth-middleware/
COPY apps/ingestion-service/ ./apps/ingestion-service/

# Compilar shared-types primero (auth-middleware e ingestion-service dependen de él)
RUN npm run build -w packages/shared-types

# Compilar auth-middleware (ingestion-service depende de él)
RUN npm run build -w packages/auth-middleware

# Compilar el ingestion-service
RUN npm run build -w apps/ingestion-service

# =============================================================================
# Stage 2: runtime
# Imagen mínima con solo las dependencias de producción y los artefactos compilados.
# Las build-tools (python3, make, g++) NO se copian al stage runtime.
# =============================================================================
FROM node:20-slim AS runtime

WORKDIR /app

# Copiar manifiestos (necesarios para resolución de módulos de workspace)
COPY package.json turbo.json ./
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/auth-middleware/package.json ./packages/auth-middleware/
COPY apps/ingestion-service/package.json ./apps/ingestion-service/

# Copiar node_modules pre-compilados del builder
# (incluye better-sqlite3 compilado para Linux)
COPY --from=builder /workspace/node_modules ./node_modules

# Copiar artefactos compilados del stage builder
COPY --from=builder /workspace/packages/shared-types/dist ./packages/shared-types/dist
COPY --from=builder /workspace/packages/auth-middleware/dist ./packages/auth-middleware/dist
COPY --from=builder /workspace/apps/ingestion-service/dist ./apps/ingestion-service/dist

# Crear directorios para datos (el PVC se monta en /app/data/blobs)
RUN mkdir -p /app/data/blobs

EXPOSE 3200

# El entry point está en apps/ingestion-service/dist/index.js relativo al WORKDIR /app
CMD ["node", "apps/ingestion-service/dist/index.js"]
