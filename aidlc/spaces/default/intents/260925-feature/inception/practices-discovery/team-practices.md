# Team Practices — Estudio

> Borrador inicial generado por aidlc-pipeline-deploy-agent como parte de Practices Discovery.
> Estas prácticas se adaptan al contexto: desarrollador individual, proyecto académico, stack Node.js/TypeScript + React, despliegue en Kubernetes local.

## Way of Working

- **Estrategia de ramas**: Trunk-based development. Todo el trabajo se fusiona en `main` mediante ramas de feature de corta duración (resueltas en 1-2 días).
- **Estrategia de merge**: Squash-merge de ramas Bolt hacia `main`. Cada Bolt genera un commit en el trunk, identificado por el slug del Bolt.
- **Ramas de feature**: Nombradas con el patrón `feature/<slug-descriptivo>`. Al ser un desarrollador individual, las ramas pueden resolverse dentro de la misma sesión de trabajo sin necesidad de pull requests formales, aunque se recomienda al menos una revisión propia antes de fusionar.
- **Historial**: El historial de commits detallado se preserva en la rama fuente hasta descartar el worktree. El log de auditoría (`audit.md`) es la fuente autoritativa del historial de decisiones.
- **No hay ramas de larga duración**: Ninguna rama de release, staging o develop de larga vida. Los ambientes se controlan mediante configuraciones de despliegue específicas, no mediante ramas.

## Walking Skeleton

Para este proyecto se construirá un walking skeleton al inicio (esqueleto caminante, Bolt 1):

- **Motivo**: El proyecto integra tres capas tecnológicas independientes — infraestructura K8s local, endpoint de subida de archivos (Node.js/TypeScript) y llamada a la API de Claude (stub inicial). Validar que estas tres capas se conectan extremo a extremo es la hipótesis más arriesgada del proyecto.
- **Contenido del skeleton**: Cluster K8s local funcional (k3s/minikube/kind) + un endpoint HTTP mínimo desplegado en un Pod + una llamada stub a la API de Anthropic que devuelva una respuesta estática. No es necesario ningún caso de uso real todavía.
- **Gate**: El skeleton requiere aprobación explícita del usuario antes de que los Bolts restantes comiencen.
- **Resultado esperado**: Una imagen de contenedor desplegada en K8s que responde a una petición HTTP y registra (en log) una respuesta stub de Claude.

## Testing Posture

- **Methodology**: test-after
- **Ordering**: implement each unit, then write and run its tests
- **Cobertura mínima**: 80% de cobertura de líneas para el scope `feature`. Esta cifra se verifica en CI (GitHub Actions o pipeline local equivalente) antes de cada merge.
- **Herramientas**:
  - Backend (Node.js/TypeScript): **Jest** con `ts-jest` para transformación de TypeScript. Tests unitarios para servicios, controladores y utilidades.
  - Frontend (React): **React Testing Library** + **Jest** para componentes. Tests de interacción y renderizado.
  - End-to-end (opcional para MVP académico): se pospone hasta que el skeleton esté en pie; si se incluye, se usará **Playwright** o **Supertest** para llamadas HTTP directas al backend.
- **Alcance de tests**: Cada unidad de construcción incluye su propia suite de tests. Los tests de integración (entre capas) se agregan al concluir las unidades relacionadas.
- **Regla de calidad**: Los floors de cobertura no pueden rebajarse para que un paso pase. Build and Test verifica los floors definidos y los targets de calidad afirmados.

## Deployment

- **Entorno destino**: Kubernetes local únicamente (k3s, minikube o kind, según lo que el alumno tenga instalado para el curso).
- **No hay despliegue en la nube**: El MVP académico no usa ningún proveedor cloud. No se configuran endpoints de AWS, GCP ni Azure.
- **GitOps**: A partir del módulo 8 del curso se introduce GitOps (Flux o ArgoCD). Los manifiestos de K8s se versionan en el repositorio bajo `k8s/` o `deploy/`. El operador de GitOps reconcilia el estado del cluster con el repositorio.
- **Secretos**: Las claves de API (Anthropic) y cualquier otro secreto se almacenan como `Secret` de Kubernetes. Nunca se incluyen en el código fuente ni en los manifiestos commiteados en claro.
- **Proceso de despliegue local**:
  1. Build de la imagen Docker del backend y/o frontend.
  2. Push a un registry local (e.g., `localhost:5000` o el registry integrado de k3s).
  3. Aplicación de manifiestos K8s (`kubectl apply -f`).
  4. Verificación de salud del Pod antes de dar por completado el despliegue.
- **Smoke tests post-despliegue**: Una llamada HTTP al endpoint de salud (`/health`) confirma que el servicio está activo en su nuevo entorno. El despliegue no se considera exitoso hasta que este check pase.

## Code Style

- **Formatter**: Prettier configurado en la raíz del repositorio (`.prettierrc`). Todos los archivos TypeScript y TSX se formatean con Prettier antes de commit (vía hook pre-commit o CI).
- **Linter**: ESLint con reglas para TypeScript (`@typescript-eslint`). Se ejecuta en CI antes de cada merge; un fallo bloquea la integración.
- **Naming conventions**:
  - TypeScript/JavaScript: `camelCase` para variables y funciones, `PascalCase` para clases y componentes React, `SCREAMING_SNAKE_CASE` para constantes de módulo.
  - Archivos: `kebab-case` para módulos y utilidades, `PascalCase` para componentes React.
  - No se aplican reglas de renombrado retroactivo a menos que el equipo lo decida explícitamente.
- **Configuración**: Los agentes leen la configuración de linter del proyecto antes de hacer sugerencias de estilo; una sugerencia del agente solo aplica si el linter no la cubre ya.
