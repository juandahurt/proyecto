# Project-Level Rules

> Project-specific specialisation and corrections. Loaded after `org.md` and
> `team.md` as strict-additive guidance; contradictions with broader policy
> are rejected. Populated by practices-discovery and the self-learning loop.
>
> Use sparingly: most teams don't need a project layer. Reach for it
> only when this specific project needs stable, durable guidance beyond the
> team practice (for example, package-specific release checks or an additional
> regression suite for a legacy component).

## Way of Working

<!-- Project-specific specialisation. Example: -->
<!-- This monorepo requires package-scoped branch names and a package owner -->
<!-- review in addition to the team's normal merge policy. -->

## Walking Skeleton

<!-- Project-specific specialisation. Example: -->
<!-- The walking skeleton must exercise the legacy service adapter as well -->
<!-- as the new service boundary. -->

## Testing Posture

<!-- Project-specific specialisation. -->

## Change Control

<!-- Project-specific. Mode: strict or relaxed. Strict here holds for every intent and cannot be changed from chat. -->

## Deployment

<!-- Project-specific specialisation. -->

## Code Style

<!-- Project-specific specialisation. -->

## Tech Stack

<!-- Technology choices locked for this project. -->

## Decided

<!-- Decisions made in earlier stages that should not be re-asked. -->
<!-- Format: DECIDED: [decision] (Stage [slug], [date]) -->

## Scope Overrides

<!-- Custom scope rules for this project. -->

## Forbidden

<!-- Populated by practices-discovery affirmation gate. -->
<!-- Format: NEVER [behavior] (affirmed [date]) -->
<!-- Example: NEVER throw exceptions across service layer boundaries (affirmed 2026-05-17) -->

- NEVER incluir la clave de API de Anthropic (ni ningun otro secreto) en el codigo fuente, archivos de configuracion commiteados, Dockerfiles, o variables de entorno definidas en texto claro dentro del repositorio. (affirmed 2026-09-26)

- NEVER hacer merge a `main` si ESLint, los tests, el floor de cobertura (lineas o ramas) o `npm audit --audit-level=high` fallan; los floors de cobertura no pueden rebajarse para que un paso pase. (affirmed 2026-09-26)

- NEVER usar ramas de larga duracion (release, develop, staging); todo el trabajo va a `main` via ramas de feature cortas. (affirmed 2026-09-26)

- NEVER desplegar en ningun entorno cloud durante el MVP academico; el unico destino de despliegue es el cluster Kubernetes local. (affirmed 2026-09-26)

- NEVER commitear manifiestos de Kubernetes con valores de `Secret` en claro (base64 sin cifrar en el repositorio es equivalente a texto plano y esta prohibido; usar `kubectl create secret` o un operador de secretos externo). (affirmed 2026-09-26)

- NEVER saltarse los smoke tests post-despliegue; un despliegue sin verificacion de salud no se considera completado. (affirmed 2026-09-26)

- NEVER usar la tag `latest` en imagenes Docker referenciadas por manifiestos K8s commiteados en el repositorio. (affirmed 2026-09-26)

- NEVER aceptar el nombre de archivo proporcionado por el usuario como nombre de almacenamiento en el servidor; generar siempre un nombre con UUID o hash controlado por el servidor. (affirmed 2026-09-26)

- NEVER duplicar tipos TypeScript de contratos entre servicios; el package `packages/shared-types` es la unica fuente de verdad. (affirmed 2026-09-26)

## Mandated

<!-- Populated by practices-discovery affirmation gate. -->
<!-- Format: ALWAYS [behavior] (affirmed [date]) -->
<!-- Example: ALWAYS use Result<T,E> for fallible operations in service layer (affirmed 2026-05-17) -->

- ALWAYS almacenar la clave de API de Anthropic como un `Secret` de Kubernetes; nunca en variables de entorno del Dockerfile, en archivos de configuracion commiteados ni en ninguna otra ubicacion accesible desde el repositorio. (affirmed 2026-09-26)

- ALWAYS añadir el archivo `.env` y cualquier archivo que contenga secretos al `.gitignore` del repositorio desde el primer commit. (affirmed 2026-09-26)

- ALWAYS versionar los manifiestos de Kubernetes (Deployments, Services, ConfigMaps, Secrets — sin valores en claro) en el repositorio bajo un directorio dedicado (`k8s/` o `deploy/`). (affirmed 2026-09-26)

- ALWAYS usar imagenes Docker con version fija (tag explicito o SHA) en los manifiestos de Kubernetes de produccion/MVP; nunca `latest` en manifiestos commiteados. (affirmed 2026-09-26)

- ALWAYS verificar la salud del despliegue mediante al menos una llamada al endpoint `/health` y confirmar que el Pod esta en estado `Ready` segun la readiness probe antes de declarar un despliegue como exitoso. (affirmed 2026-09-26)

- ALWAYS ejecutar ESLint y Prettier como parte del pipeline de CI (GitHub Actions) antes de fusionar cualquier rama; un fallo de linter bloquea el merge. (affirmed 2026-09-26)

- ALWAYS ejecutar `npm audit --audit-level=high` como step de CI previo al merge — decision incorporada de la OBJECTION de aidlc-devsecops-agent (Observacion 5). Un hallazgo de severidad `high` o `critical` bloquea el merge. (affirmed 2026-09-26)

- ALWAYS escribir y ejecutar los tests de una unidad antes de considerar esa unidad completa (metodologia test-after: implementar primero, luego tests). (affirmed 2026-09-26)

- ALWAYS mantener una cobertura de lineas minima del 80% global y una cobertura de ramas minima del 75% sobre los modulos `service/` y `handlers/`, verificadas en CI antes de cada merge — Q6=A afirmado. (affirmed 2026-09-26)

- ALWAYS incluir un test de contrato que valide el schema de la respuesta de la API de Claude (estructura, campos presentes, tipos) — Q3=B afirmado. Este test debe ejecutarse en CI y romperse si el schema cambia. (affirmed 2026-09-26)

- ALWAYS validar el magic number (primeros bytes del archivo) en el servidor para confirmar que el archivo subido es realmente una imagen, ademas de verificar el Content-Type MIME — Q5=B afirmado. La validacion de Content-Type sola no es suficiente; un archivo ejecutable renombrado la supera. (affirmed 2026-09-26)

- ALWAYS generar el nombre del archivo en el servidor para cualquier archivo subido por el usuario; nunca usar el nombre de archivo proporcionado por el cliente — Q5=B afirmado. Esto previene path traversal y manipulacion de rutas. (affirmed 2026-09-26)

- ALWAYS configurar un limite de tamaño de archivo tanto en el middleware de Express (e.g., `multer` con `limits.fileSize`) como en el Ingress de Kubernetes para el endpoint de subida de imagenes. (affirmed 2026-09-26)

- ALWAYS mantener los tipos TypeScript compartidos entre servicios en el package `packages/shared-types` del monorepo; ningún servicio duplica interfaces que ya existen en ese package. (affirmed 2026-09-26)

- ALWAYS usar Zod como fuente autoritativa de los schemas de validacion en runtime; los tipos TypeScript de los contratos se derivan de los schemas de Zod mediante `z.infer<>`. (affirmed 2026-09-26)

## Corrections

<!-- Project-specific corrections from human feedback. -->
<!-- Format: NEVER/ALWAYS [behavior] (learned [date]) -->
- When the user's request references both a PRD and a PVB, use the PRD as the sole document input — it consolidates the PVB and all other research docs. Register only the PRD as the source; the PVB is context, not a separate input. (learned 2026-09-25) <!-- cid:260925-feature:intent-capture:a6f3d797475244ca9cd471ed0be43b4336766877addb63e12b19249383848844 -->
