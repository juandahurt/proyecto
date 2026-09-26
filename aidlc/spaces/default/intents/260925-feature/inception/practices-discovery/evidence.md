# Evidencia de Inspección — Practices Discovery

> Registro de fuentes inspeccionadas e inferencias realizadas por aidlc-pipeline-deploy-agent para la etapa de Practices Discovery del proyecto Estudio.

## Fuentes Inspeccionadas

### 1. `aidlc/spaces/default/memory/org.md` — Defaults de organización

- **Way of Working**: Confirma trunk-based development, squash-merge de Bolts, ramas feature de corta duración. Adoptado sin modificación para el proyecto.
- **Walking Skeleton**: El org define que el skeleton corre solo cuando el scope declara `skeleton: on`. El brief del proyecto y el contexto académico (integrar K8s + backend + API de Claude por primera vez) hacen que esta opción sea la correcta para este scope `feature`.
- **Testing Posture**: El org establece test-after como default para scopes sin postura afirmada. El scope `feature` añade un floor de 80% de cobertura de líneas y ejecución en CI antes de merge. Adoptado como base.
- **Deployment**: El org describe deploy-on-merge hacia staging y aprobación manual para producción. Adaptado: para el MVP académico el único destino es K8s local; no existe staging ni producción cloud.
- **Code Style**: El org delega a la configuración del proyecto (Prettier, ESLint, convenciones idiomáticas). Adoptado directamente para TypeScript/React.
- **Mandated (org)**: Las reglas de idioma de conversación son reglas del framework, no del producto; no se recopilan como restricciones de pipeline/deployment en este artefacto.

### 2. Decisiones de IDEATION / Brief del proyecto

Inferidas del brief de dispatch recibido:

- **Stack tecnológico afirmado**: Node.js/TypeScript (backend) + React (frontend). Implica Jest + ts-jest para backend, React Testing Library para frontend como herramientas de test idiomáticas.
- **Despliegue destino**: Kubernetes local (k3s/minikube/kind). Implica: no hay pipeline cloud, los secretos van como K8s Secrets, los manifiestos se versionan en el repo.
- **API de Anthropic Claude**: Integración con una API externa de IA con clave de acceso. Esto activa de inmediato la restricción más crítica: la clave NUNCA puede commitearse; siempre como K8s Secret.
- **Capacidad del equipo**: 1 desarrollador individual, ~5 horas/semana. Esto implica: las ceremonias formales (PRs con revisor externo, gates de aprobación manual entre cada Bolt) se adaptan a la realidad de un equipo de uno; el proceso se simplifica sin sacrificar la trazabilidad del audit log.
- **Contexto académico (módulos 4-8 cubren K8s)**: El proyecto avanzará en paralelo al aprendizaje de K8s. El walking skeleton sirve como hito de validación temprana de que el alumno domina la integración básica antes de construir funcionalidad real.

## Inferencias Clave

| Inferencia | Justificación |
|---|---|
| Walking skeleton es obligatorio (Bolt 1) | Tres capas tecnológicas nuevas simultáneas (K8s + backend + Claude API) — la hipótesis de integración es el riesgo más alto del proyecto |
| Jest + ts-jest para backend | Stack TypeScript + Node.js; Jest es el estándar de facto; ts-jest evita compilación previa para tests |
| React Testing Library para frontend | React explícito en el stack; RTL es la herramienta canónica para tests de componentes centrados en comportamiento |
| K8s Secrets para la API key de Anthropic | Única forma de inyectar secretos en Pods K8s sin commitearlos; el contexto de despliegue K8s hace esta decisión no negociable |
| GitOps desde módulo 8 | El brief menciona explícitamente que los módulos 4-8 del curso cubren K8s; el módulo 8 es el punto natural de introducción de GitOps |
| No hay despliegue cloud en el MVP | Explícito en el brief: "local K8s only for MVP"; sin entornos cloud se eliminan las reglas de deploy-on-merge a staging/producción del org |
| Floor de cobertura 80% | Derivado directamente del scope `feature` según el org; no se modifica |
| Smoke test de `/health` post-despliegue | Principio 6 del agente: un despliegue no está completo hasta que los smoke tests confirman salud en el nuevo entorno |

## Vacíos Identificados

Los siguientes aspectos no pudieron resolverse desde las fuentes disponibles y requerirán confirmación en etapas posteriores:

- Versión exacta de Node.js y React a usar (afecta compatibilidad de herramientas).
- Herramienta específica de K8s local elegida por el alumno (k3s vs minikube vs kind).
- Decisión sobre registry de contenedores local (e.g., registry integrado de k3s, Docker Hub con repositorio privado, o `localhost:5000`).
- Profundidad de los tests de integración entre capas (si se incluyen o se posponen post-MVP).
