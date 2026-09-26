# Reglas Descubiertas — Estudio

> Version final integrada. Restricciones duras (hard constraints) derivadas del contexto del proyecto y de las decisiones de la entrevista de Practices Discovery (2026-09-25). Incorpora OBJECTIONs de aidlc-quality-agent, aidlc-developer-agent y aidlc-devsecops-agent.

## Mandated

### Seguridad de secretos
- ALWAYS almacenar la clave de API de Anthropic como un `Secret` de Kubernetes; nunca en variables de entorno del Dockerfile, en archivos de configuracion commiteados ni en ninguna otra ubicacion accesible desde el repositorio.
- ALWAYS añadir el archivo `.env` y cualquier archivo que contenga secretos al `.gitignore` del repositorio desde el primer commit.

### Manifiestos y despliegue
- ALWAYS versionar los manifiestos de Kubernetes (Deployments, Services, ConfigMaps, Secrets — sin valores en claro) en el repositorio bajo un directorio dedicado (`k8s/` o `deploy/`).
- ALWAYS usar imagenes Docker con version fija (tag explicito o SHA) en los manifiestos de Kubernetes de produccion/MVP; nunca `latest` en manifiestos commiteados.
- ALWAYS verificar la salud del despliegue mediante al menos una llamada al endpoint `/health` y confirmar que el Pod esta en estado `Ready` segun la readiness probe antes de declarar un despliegue como exitoso.

### Calidad de codigo y CI
- ALWAYS ejecutar ESLint y Prettier como parte del pipeline de CI (GitHub Actions) antes de fusionar cualquier rama; un fallo de linter bloquea el merge.
- ALWAYS ejecutar `npm audit --audit-level=high` como step de CI previo al merge — decision incorporada de la OBJECTION de aidlc-devsecops-agent (Observacion 5). Un hallazgo de severidad `high` o `critical` bloquea el merge.
- ALWAYS escribir y ejecutar los tests de una unidad antes de considerar esa unidad completa (metodologia test-after: implementar primero, luego tests).
- ALWAYS mantener una cobertura de lineas minima del 80% global y una cobertura de ramas minima del 75% sobre los modulos `service/` y `handlers/`, verificadas en CI antes de cada merge — Q6=A afirmado.
- ALWAYS incluir un test de contrato que valide el schema de la respuesta de la API de Claude (estructura, campos presentes, tipos) — Q3=B afirmado. Este test debe ejecutarse en CI y romperse si el schema cambia.

### Seguridad del endpoint de subida de archivos
- ALWAYS validar el magic number (primeros bytes del archivo) en el servidor para confirmar que el archivo subido es realmente una imagen, ademas de verificar el Content-Type MIME — Q5=B afirmado. La validacion de Content-Type sola no es suficiente; un archivo ejecutable renombrado la supera.
- ALWAYS generar el nombre del archivo en el servidor para cualquier archivo subido por el usuario; nunca usar el nombre de archivo proporcionado por el cliente — Q5=B afirmado. Esto previene path traversal y manipulacion de rutas.
- ALWAYS configurar un limite de tamaño de archivo tanto en el middleware de Express (e.g., `multer` con `limits.fileSize`) como en el Ingress de Kubernetes para el endpoint de subida de imagenes.

### Estructura de repositorio y tipos compartidos
- ALWAYS mantener los tipos TypeScript compartidos entre servicios en el package `packages/shared-types` del monorepo; ningún servicio duplica interfaces que ya existen en ese package.
- ALWAYS usar Zod como fuente autoritativa de los schemas de validacion en runtime; los tipos TypeScript de los contratos se derivan de los schemas de Zod mediante `z.infer<>`.

## Forbidden

- NEVER incluir la clave de API de Anthropic (ni ningun otro secreto) en el codigo fuente, archivos de configuracion commiteados, Dockerfiles, o variables de entorno definidas en texto claro dentro del repositorio.
- NEVER hacer merge a `main` si ESLint, los tests, el floor de cobertura (lineas o ramas) o `npm audit --audit-level=high` fallan; los floors de cobertura no pueden rebajarse para que un paso pase.
- NEVER usar ramas de larga duracion (release, develop, staging); todo el trabajo va a `main` via ramas de feature cortas.
- NEVER desplegar en ningun entorno cloud durante el MVP academico; el unico destino de despliegue es el cluster Kubernetes local.
- NEVER commitear manifiestos de Kubernetes con valores de `Secret` en claro (base64 sin cifrar en el repositorio es equivalente a texto plano y esta prohibido; usar `kubectl create secret` o un operador de secretos externo).
- NEVER saltarse los smoke tests post-despliegue; un despliegue sin verificacion de salud no se considera completado.
- NEVER usar la tag `latest` en imagenes Docker referenciadas por manifiestos K8s commiteados en el repositorio.
- NEVER aceptar el nombre de archivo proporcionado por el usuario como nombre de almacenamiento en el servidor; generar siempre un nombre con UUID o hash controlado por el servidor.
- NEVER duplicar tipos TypeScript de contratos entre servicios; el package `packages/shared-types` es la unica fuente de verdad.
