# Reglas Descubiertas — Estudio

> Solo restricciones duras (hard constraints). Derivadas del contexto del proyecto: desarrollador individual, proyecto académico, stack Node.js/TypeScript + React, despliegue en K8s local, API de Anthropic Claude.

## Mandated

- ALWAYS almacenar la clave de API de Anthropic como un `Secret` de Kubernetes; nunca en variables de entorno del Dockerfile, en archivos de configuración commiteados ni en ningún otro lugar accesible desde el repositorio.
- ALWAYS versionar los manifiestos de Kubernetes (Deployments, Services, ConfigMaps, Secrets — sin valores en claro) en el repositorio bajo un directorio dedicado (`k8s/` o `deploy/`).
- ALWAYS ejecutar ESLint y Prettier como parte del pipeline de CI antes de fusionar cualquier rama; un fallo de linter bloquea el merge.
- ALWAYS escribir y ejecutar los tests de una unidad antes de considerar esa unidad completa (metodología test-after: implementar primero, luego tests).
- ALWAYS mantener una cobertura de líneas mínima del 80% para el scope `feature` y verificarla en CI antes de cada merge.
- ALWAYS verificar la salud del despliegue mediante al menos una llamada al endpoint `/health` antes de declarar un despliegue como exitoso.
- ALWAYS usar imágenes Docker con versión fija (tag explícito o SHA) en los manifiestos de Kubernetes de producción/MVP; nunca `latest` en manifiestos commiteados.
- ALWAYS añadir el archivo `.env` y cualquier archivo que contenga secretos al `.gitignore` del repositorio desde el primer commit.

## Forbidden

- NEVER incluir la clave de API de Anthropic (ni ningún otro secreto) en el código fuente, archivos de configuración commiteados, Dockerfiles, o variables de entorno definidas en texto claro dentro del repositorio.
- NEVER hacer merge a `main` si ESLint o los tests fallan; los floors de cobertura no pueden rebajarse para que un paso pase.
- NEVER usar ramas de larga duración (release, develop, staging); todo el trabajo va a `main` vía ramas de feature cortas.
- NEVER desplegar en ningún entorno cloud durante el MVP académico; el único destino de despliegue es el cluster Kubernetes local.
- NEVER commitear manifiestos de Kubernetes con valores de `Secret` en claro (base64 sin cifrar en el repositorio es equivalente a texto plano y está prohibido; usar `kubectl create secret` o un operador de secretos externo).
- NEVER saltarse los smoke tests post-despliegue; un despliegue sin verificación de salud no se considera completado.
- NEVER usar la tag `latest` en imágenes Docker referenciadas por manifiestos K8s commiteados en el repositorio.
