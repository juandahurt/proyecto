# Evidencia de Inspeccion — Practices Discovery

> Version final integrada por aidlc-pipeline-deploy-agent (2026-09-25). Incorpora las fuentes originales, las contribuciones de los tres agentes de soporte y las seis decisiones de la entrevista completada.

## Fuentes Inspeccionadas

### 1. `aidlc/spaces/default/memory/org.md` — Defaults de organizacion

- **Way of Working**: Confirma trunk-based development, squash-merge de Bolts, ramas feature de corta duracion. Adoptado sin modificacion para el proyecto.
- **Walking Skeleton**: El org define que el skeleton corre solo cuando el scope declara `skeleton: on`. El brief del proyecto y el contexto academico (integrar K8s + backend + API de Claude por primera vez) hacen que esta opcion sea la correcta para este scope `feature`.
- **Testing Posture**: El org establece test-after como default para scopes sin postura afirmada. El scope `feature` añade un floor de 80% de cobertura de lineas y ejecucion en CI antes de merge. Adoptado como base; ampliado con branch coverage floor por decision de entrevista Q6=A.
- **Deployment**: El org describe deploy-on-merge hacia staging y aprobacion manual para produccion. Adaptado: para el MVP academico el unico destino es K8s local; no existe staging ni produccion cloud.
- **Code Style**: El org delega a la configuracion del proyecto (Prettier, ESLint, convenciones idiomaticas). Adoptado directamente para TypeScript/React; ampliado con lint-staged + husky por recomendacion de aidlc-developer-agent.

### 2. Decisiones de IDEATION / Brief del proyecto

Inferidas del brief de dispatch recibido:

- **Stack tecnologico afirmado**: Node.js/TypeScript (backend) + React (frontend). Implica Jest + ts-jest para backend, React Testing Library para frontend como herramientas de test idiomaticas.
- **Despliegue destino**: Kubernetes local (k3s/minikube/kind). Implica: no hay pipeline cloud, los secretos van como K8s Secrets, los manifiestos se versionan en el repo.
- **API de Anthropic Claude**: Integracion con una API externa de IA con clave de acceso. Activa la restriccion mas critica: la clave NUNCA puede commitearse; siempre como K8s Secret.
- **Capacidad del equipo**: 1 desarrollador individual, ~5 horas/semana. Las ceremonias formales se adaptan; el proceso se simplifica sin sacrificar la trazabilidad del audit log.
- **Contexto academico (modulos 4-8 cubren K8s)**: El proyecto avanzara en paralelo al aprendizaje de K8s. El walking skeleton sirve como hito de validacion temprana.

## Contribuciones de Agentes de Soporte

### aidlc-quality-agent

**Resumen de contribucion**: Identifico cinco gaps en el borrador inicial. Los mas materiales: (1) ausencia de cobertura de contrato para la API de Claude — el mayor riesgo funcional del producto requiere al menos un test de schema ademas de mocks unitarios; (2) el floor del 80% de lineas global no garantiza cobertura de la logica critica en `service/` y `handlers/`, donde reside la logica de categorizacion — recomendo añadir branch coverage floor del 75% sobre esos modulos; (3) la estrategia de CI hibrida (GitHub Actions + pipeline local para K8s) debe afirmarse explicitamente para que nadie asuma que el CI remoto cubre lo que solo el entorno local puede cubrir.

**Decisiones incorporadas**: OBJECTION sobre ausencia de contrato Claude API → Q3=B resuelve (mocks + contract test). OBJECTION sobre floor de cobertura solo de lineas → Q6=A resuelve (80% lineas global + 75% ramas en service/ y handlers/).

### aidlc-developer-agent

**Resumen de contribucion**: Identifico cinco gaps en el borrador inicial, todos relacionados con la naturaleza multi-servicio del proyecto (4 servicios). Los mas materiales: (1) ausencia de decision sobre estructura de repositorio (monorepo vs. multi-repo) — cambia radicalmente como se comparten los tipos TypeScript y como se configura ESLint/Jest; (2) ausencia de definicion de ownership de tipos compartidos — sin esto, las interfaces se duplican entre servicios y divergen silenciosamente; (3) ausencia de convencion de error handling entre capas y de estructura de respuesta HTTP — genera deuda tecnica desde Bolt 2; (4) recomendacion concreta de `lint-staged` + `husky` para automatizar el pre-commit y reducir friccion para un desarrollador individual.

**Decisiones incorporadas**: OBJECTION sobre estructura de repositorio → Q1=A resuelve (monorepo con Turborepo). OBJECTION sobre Code Style incompleto → incorporado en `team-practices.md` (contratos Zod, modelo de capas, error handling, lint-staged + husky).

### aidlc-devsecops-agent

**Resumen de contribucion**: Identifico cinco brechas de seguridad. Las mas materiales: (1) ausencia de controles de validacion de entrada para el endpoint de subida de imagenes — es la superficie de ataque mas comun en aplicaciones web; el borrador no mencionaba ninguna validacion del tipo real del archivo, solo del Content-Type; (2) ausencia de `npm audit` como step de CI — costo cero de integracion, cubre el riesgo mas comun de dependencias con CVEs conocidos; (3) clarificacion del alcance de la regla de K8s Secret (valida para cluster local; no escala sin cifrado de etcd o gestor de secretos externo).

**Decisiones incorporadas**: OBJECTION sobre validacion de subida de archivos → Q5=B resuelve (validacion estricta: Content-Type + magic number + nombre generado por servidor). OBJECTION sobre `npm audit` ausente → incorporado como regla mandatada en `discovered-rules.md`.

## Decisiones de la Entrevista (2026-09-25)

| Pregunta | Decision | Impacto |
|---|---|---|
| Q1: Estructura de repositorio | A — Monorepo con Turborepo | `team-practices.md` Way of Working; convenciones de tipos compartidos |
| Q2: Walking skeleton | A — Bolt 1 es el skeleton conectado | `team-practices.md` Walking Skeleton confirmado; contenido ampliado con BD write |
| Q3: Tests Claude API | B — Mocks + contract test de schema | `team-practices.md` Testing Posture; `discovered-rules.md` regla mandatada |
| Q4: CI gate | B — GitHub Actions (lint+unit+coverage); pipeline local para K8s smoke | `team-practices.md` Testing Posture CI gate |
| Q5: Validacion de subida | B — Validacion estricta (Content-Type + magic number + nombre servidor) | `discovered-rules.md` tres reglas mandatadas nuevas |
| Q6: Branch coverage floor | A — 80% lineas global + 75% ramas en service/ y handlers/ | `team-practices.md` Testing Posture; `discovered-rules.md` regla mandatada |

## Inferencias Clave

| Inferencia | Justificacion |
|---|---|
| Walking skeleton es obligatorio (Bolt 1) | Cuatro capas tecnologicas nuevas simultaneas (K8s + backend + Claude API + BD) — la hipotesis de integracion es el riesgo mas alto del proyecto |
| Monorepo con Turborepo | 4 servicios con tipos TypeScript compartidos; monorepo elimina duplicacion y mantiene un punto autoritativo de contratos |
| Jest + ts-jest para backend | Stack TypeScript + Node.js; Jest es el estandar de facto; ts-jest evita compilacion previa para tests |
| React Testing Library para frontend | React explicito en el stack; RTL es la herramienta canonica para tests de componentes centrados en comportamiento |
| K8s Secrets para la API key de Anthropic | Unica forma de inyectar secretos en Pods K8s sin commitearlos; el contexto de despliegue K8s hace esta decision no negociable |
| Contract test para Claude API | El mayor riesgo funcional del producto (consistencia de categorizacion) requiere un test que fije el schema esperado; los mocks unitarios solos no lo cubren |
| Magic number validation para subidas | Content-Type solo puede ser falseado por el cliente; la verificacion de los primeros bytes del archivo es el control minimo server-side efectivo |
| Nombres de archivo generados por servidor | Previene path traversal; elimina dependencia de datos de usuario no confiables para operaciones de sistema de archivos |
| npm audit en CI | Costo cero de integracion (comando nativo npm); cubre el riesgo mas comun de supply chain para un proyecto con dependencias npm |
| lint-staged + husky desde Bolt 1 | Para un desarrollador individual con ~5 h/semana, la automatizacion del pre-commit elimina la friccion acumulada sin añadir carga cognitiva |
| GitOps desde modulo 8 | El brief menciona explicitamente que los modulos 4-8 del curso cubren K8s; el modulo 8 es el punto natural de introduccion de GitOps |
| No hay despliegue cloud en el MVP | Explicito en el brief: "local K8s only for MVP"; sin entornos cloud se eliminan las reglas de deploy-on-merge a staging/produccion del org |
| Floor de branch coverage 75% en service/ y handlers/ | Un floor solo de lineas puede alcanzarse cubriendo scaffolding; la logica critica de categorizacion vive en estos modulos y requiere su propio floor |
| Smoke test de `/health` + readiness probe | Un despliegue no esta completo hasta que smoke tests confirman salud; el Pod en estado `Running` pero sin readiness es un falso positivo |

## Vacíos Identificados

Los siguientes aspectos no pudieron resolverse desde las fuentes disponibles y requeriran confirmacion en etapas posteriores:

- Version exacta de Node.js y React a usar (afecta compatibilidad de herramientas).
- Herramienta especifica de K8s local elegida por el alumno (k3s vs minikube vs kind).
- Decision sobre registry de contenedores local (e.g., registry integrado de k3s, Docker Hub con repositorio privado, o `localhost:5000`).
- Profundidad de los tests de integracion entre capas (si se incluyen o se posponen post-MVP).
- Politica de retencion de imagenes subidas (cuanto tiempo se conservan tras el analisis de Claude).
- Estrategia de actualizacion de imagenes base Docker (revision manual ante CVEs; frecuencia recomendada por aidlc-devsecops-agent pero no afirmada formalmente).
- Alcance exacto de los datos personales almacenados y politica de minimizacion de datos (señalado por aidlc-devsecops-agent, pendiente de aclaracion en Functional Design).
