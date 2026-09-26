# Team Practices — Estudio

> Version final integrada por aidlc-pipeline-deploy-agent tras incorporar las contribuciones de aidlc-quality-agent, aidlc-developer-agent, aidlc-devsecops-agent y las respuestas completas de la entrevista de Practices Discovery (2026-09-25).

## Way of Working

- **Estructura de repositorio**: Monorepo con Turborepo (opcion elegida Q1=A). Todos los servicios (ingesta/analisis de imagen, historial/tendencias, cuentas/suscripcion, confianza/datos) residen en el mismo repositorio. Los tipos TypeScript compartidos se distribuyen como workspace packages internos (e.g., `packages/shared-types`). Turborepo gestiona el grafo de dependencias, el caching de builds y la ejecucion de tareas entre packages.
- **Estrategia de ramas**: Trunk-based development. Todo el trabajo se fusiona en `main` mediante ramas de feature de corta duracion (resueltas en 1-2 dias).
- **Estrategia de merge**: Squash-merge de ramas Bolt hacia `main`. Cada Bolt genera un commit en el trunk, identificado por el slug del Bolt.
- **Ramas de feature**: Nombradas con el patron `feature/<slug-descriptivo>`. Al ser un desarrollador individual, las ramas pueden resolverse dentro de la misma sesion de trabajo sin necesidad de pull requests formales, aunque se recomienda al menos una revision propia antes de fusionar.
- **Historial**: El historial de commits detallado se preserva en la rama fuente hasta descartar el worktree. El log de auditoria (`audit.md`) es la fuente autoritativa del historial de decisiones.
- **No hay ramas de larga duracion**: Ninguna rama de release, staging o develop de larga vida. Los ambientes se controlan mediante configuraciones de despliegue especificas, no mediante ramas.
- **Tipos compartidos**: El package `packages/shared-types` es el propietario autoritativo de todas las interfaces compartidas entre servicios (usuarios, categorias de critica, contratos HTTP). Ningun servicio duplica tipos que ya existen en ese package.

## Walking Skeleton

Para este proyecto se construira un walking skeleton al inicio (esqueleto caminante, Bolt 1) — decision afirmada Q2=A:

- **Motivo**: El proyecto integra tres capas tecnologicas independientes — infraestructura K8s local, endpoint de subida de archivos (Node.js/TypeScript), llamada a la API de Claude (stub inicial) y escritura en BD. Validar que estas cuatro capas se conectan extremo a extremo es la hipotesis mas arriesgada del proyecto.
- **Contenido del skeleton**: Cluster K8s local funcional (k3s/minikube/kind) + un endpoint HTTP minimo desplegado en un Pod + una llamada stub a la API de Anthropic que devuelva una respuesta estatica + escritura de un registro en base de datos + devolucion de la respuesta al cliente. No es necesario ningun caso de uso real todavia.
- **Gate**: El skeleton requiere aprobacion explicita del usuario antes de que los Bolts restantes comiencen.
- **Resultado esperado**: Una imagen de contenedor desplegada en K8s que responde a una peticion HTTP, escribe en BD, y registra (en log) una respuesta stub de Claude.

## Testing Posture

- **Methodology**: test-after
- **Ordering**: implement each unit, then write and run its tests
- **Cobertura minima**: 80% de cobertura de lineas global para el scope `feature`. Esta cifra se verifica en CI (GitHub Actions) antes de cada merge.
- **Branch coverage floor**: 75% on service/ and handlers/ modules — decision afirmada Q6=A. Este floor adicional garantiza cobertura de la logica critica de categorizacion y procesamiento de respuestas de Claude, no solo del codigo de scaffolding.
- **Claude API testing**: mocks for unit tests + contract test that validates the response schema — decision afirmada Q3=B. Los tests unitarios usan respuestas fijas mockeadas para validar el procesamiento; un test de contrato independiente fija el schema esperado de la respuesta de Claude (campos presentes, tipos) de forma que un cambio de modelo o de prompt lo rompa antes de llegar a produccion.
- **Herramientas**:
  - Backend (Node.js/TypeScript): **Jest** con `ts-jest` para transformacion de TypeScript. Tests unitarios para servicios, controladores y utilidades.
  - Frontend (React): **React Testing Library** + **Jest** para componentes. Tests de interaccion y renderizado.
  - End-to-end (opcional para MVP academico): se pospone hasta que el skeleton este en pie; si se incluye, se usara **Playwright** o **Supertest** para llamadas HTTP directas al backend.
  - Contrato de API Claude: un modulo de test dedicado con schema de validacion (Zod o equivalente) que afirma la estructura de la respuesta esperada.
- **Alcance de tests**: Cada unidad de construccion incluye su propia suite de tests. Los tests de integracion (entre capas) se agregan al concluir las unidades relacionadas.
- **CI gate (Q4=B)**: GitHub Actions ejecuta lint + unit tests + coverage para toda rama antes de merge. El pipeline local es obligatorio para smoke tests de K8s antes de cada merge. GitHub Actions no puede ejecutar tests de integracion contra el cluster local; este gap esta documentado y es consciente.
- **Regla de calidad**: Los floors de cobertura (lineas global + ramas en service/ y handlers/) no pueden rebajarse para que un paso pase. Build and Test verifica los floors definidos y los targets de calidad afirmados.

## Deployment

- **Entorno destino**: Kubernetes local unicamente (k3s, minikube o kind, segun lo que el alumno tenga instalado para el curso).
- **No hay despliegue en la nube**: El MVP academico no usa ningun proveedor cloud. No se configuran endpoints de AWS, GCP ni Azure.
- **GitOps**: A partir del modulo 8 del curso se introduce GitOps (Flux o ArgoCD). Los manifiestos de K8s se versionan en el repositorio bajo `k8s/` o `deploy/`. El operador de GitOps reconcilia el estado del cluster con el repositorio.
- **Secretos**: Las claves de API (Anthropic) y cualquier otro secreto se almacenan como `Secret` de Kubernetes. Nunca se incluyen en el codigo fuente ni en los manifiestos commiteados en claro. Nota de alcance: en un cluster local sin cifrado de etcd (k3s/minikube/kind en configuracion por defecto), los Secrets de K8s se almacenan en base64 sin cifrado en reposo — riesgo aceptable para entorno local, pero este modelo no escala a entornos multi-usuario o cloud sin cifrado de etcd o un gestor de secretos externo.
- **Proceso de despliegue local**:
  1. Build de la imagen Docker del backend y/o frontend.
  2. Push a un registry local (e.g., `localhost:5000` o el registry integrado de k3s).
  3. Aplicacion de manifiestos K8s (`kubectl apply -f`).
  4. Verificacion de salud del Pod antes de dar por completado el despliegue.
- **Smoke tests post-despliegue**: Una llamada HTTP al endpoint de salud (`/health`) confirma que el servicio esta activo en su nuevo entorno. El despliegue no se considera exitoso hasta que este check pase. Criterio adicional de "despliegue listo": el Pod debe estar en estado `Ready` segun la readiness probe (no solo `Running`), con un tiempo maximo de espera configurable antes de declarar el despliegue fallido.

## Code Style

- **Formatter**: Prettier configurado en la raiz del repositorio (`.prettierrc`). Todos los archivos TypeScript y TSX se formatean con Prettier antes de commit via hook pre-commit automatizado.
- **Linter**: ESLint con reglas para TypeScript (`@typescript-eslint`). Se ejecuta en CI antes de cada merge; un fallo bloquea la integracion. En monorepo, la configuracion ESLint se hereda desde la raiz con posibilidad de override por package.
- **Automatizacion pre-commit**: `lint-staged` + `husky` configurados desde Bolt 1. El hook pre-commit aplica Prettier y ESLint solo a los archivos modificados en el commit. Esto elimina la friccion de ejecutar manualmente el formatter/linter para un desarrollador individual con tiempo limitado.
- **Naming conventions**:
  - TypeScript/JavaScript: `camelCase` para variables y funciones, `PascalCase` para clases y componentes React, `SCREAMING_SNAKE_CASE` para constantes de modulo.
  - Archivos: `kebab-case` para modulos y utilidades, `PascalCase` para componentes React.
  - No se aplican reglas de renombrado retroactivo a menos que el equipo lo decida explicitamente.
- **Contratos HTTP entre servicios**: Los contratos se expresan como tipos TypeScript en `packages/shared-types`. Para validacion en runtime se usa Zod, cuyas definiciones son la fuente autoritativa; los tipos TypeScript se derivan de los schemas de Zod (`z.infer<>`). Esto unifica la validacion en runtime con el tipado estatico.
- **Modelo de capas y error handling**: Los controladores normalizan los errores antes de responder; los errores de la API de Anthropic se envuelven en un tipo de dominio propio (`AnthropicIntegrationError`). Las respuestas HTTP siguen la estructura `{ data, error, status }` para toda la API del backend.
- **Configuracion**: Los agentes leen la configuracion de linter del proyecto antes de hacer sugerencias de estilo; una sugerencia del agente solo aplica si el linter no la cubre ya.
