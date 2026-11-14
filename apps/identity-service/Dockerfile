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
COPY apps/identity-service/package.json ./apps/identity-service/

# Herramientas de compilación nativa para bcrypt y better-sqlite3
# (addons C++ compilados con node-gyp — requieren python3, make, g++)
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*

# Instalar todas las dependencias (incluyendo dev) dentro del contenedor Linux.
# Esto compila bcrypt y better-sqlite3 para Linux — no copiar node_modules del host macOS.
RUN npm ci

# Copiar el código fuente de los packages necesarios
COPY packages/shared-types/ ./packages/shared-types/
COPY apps/identity-service/ ./apps/identity-service/

# Compilar shared-types primero (identity-service depende de él)
RUN npm run build -w packages/shared-types

# Compilar el identity-service
RUN npm run build -w apps/identity-service

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
COPY apps/identity-service/package.json ./apps/identity-service/

# Copiar node_modules pre-compilados del builder
# (incluye bcrypt y better-sqlite3 compilados para Linux)
COPY --from=builder /workspace/node_modules ./node_modules

# Copiar artefactos compilados del stage builder
COPY --from=builder /workspace/packages/shared-types/dist ./packages/shared-types/dist
COPY --from=builder /workspace/apps/identity-service/dist ./apps/identity-service/dist

# Crear directorio para SQLite efímera
# (emptyDir en K8s — se pierde al reiniciar el Pod; PVC se introducirá en módulos posteriores)
RUN mkdir -p /app/data

EXPOSE 3100

# El entry point está en apps/identity-service/dist/index.js relativo al WORKDIR /app
CMD ["node", "apps/identity-service/dist/index.js"]
