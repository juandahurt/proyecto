**Collaborator:** aidlc-developer-agent

## Contribution

**1. Convenciones de naming: sólidas para el stack, pero incompletas en el dominio multi-servicio.**
Las convenciones de `camelCase` para funciones/variables, `PascalCase` para clases y componentes React, y `kebab-case` para archivos de módulos son idiomáticas para TypeScript + React y no presentan problemas. Sin embargo, el draft no aborda cómo se nombran los contratos compartidos entre los 4 servicios del proyecto (endpoint de subida, servicio de procesamiento, integración con Claude, frontend). En un proyecto multi-servicio es crítico establecer desde el inicio dónde viven los tipos compartidos (`shared-types/` o un paquete `@proyecto/types`) y quién es el propietario autoritativo del contrato. Sin esto, las interfaces se duplican entre servicios y divergen silenciosamente.

**2. Límites de capa y manejo de errores: no están definidos explícitamente.**
El borrador define herramientas (ESLint, Prettier, Jest) pero no establece un modelo de capas ni una convención de error handling. Para un backend Node.js/TS en K8s, la ausencia de estas definiciones genera deuda técnica temprana: ¿los controladores devuelven errores crudos o los normalizan? ¿Los errores de la API de Anthropic se envuelven en un tipo de dominio propio? ¿Las respuestas HTTP siguen una estructura consistente (`{ data, error, status }`)? Estas decisiones deben tomarse antes de que el código de Bolt 2 en adelante se genere, o cada unidad resolverá esto de forma ad hoc.

**3. ESLint + Prettier para un desarrollador individual: viable, pero requiere automatización temprana.**
Para un solo desarrollador con ~5 horas/semana disponibles, la carga de ejecutar manualmente el formatter y el linter antes de cada commit es real. El borrador menciona "hook pre-commit o CI" como alternativa, lo cual es correcto, pero deja la decisión abierta. La recomendación concreta es fijar `lint-staged` + `husky` (o equivalent) desde Bolt 1 para que el hook pre-commit aplique Prettier y ESLint solo a los archivos modificados. Sin esta automatización, el floor del 80% de cobertura y el gate de CI se vuelven fricción acumulada, no protección.

**4. Contratos de API entre servicios: vacío crítico para un proyecto de 4 servicios.**
El draft trata el proyecto como si fuera un monolito con frontend separado. No menciona cómo se especifican ni se versionan los contratos HTTP entre el backend de subida de archivos y el servicio que llama a la API de Anthropic. Para K8s multi-servicio, incluso a escala académica, conviene definir desde el inicio si los contratos se expresan como tipos TypeScript compartidos, como especificaciones OpenAPI generadas desde el código, o como contratos de Zod validados en runtime. La ausencia de esta decisión es el riesgo de calidad más alto del proyecto desde la perspectiva de código.

**5. Tipos compartidos y monorepo: la estructura de repositorio afecta la aplicabilidad de las convenciones.**
El draft asume implícitamente un repositorio único, pero no lo afirma. Con 4 servicios (backend de subida, servicio Claude, frontend React, posiblemente un gateway o proxy), la decisión de monorepo vs. multi-repo cambia radicalmente cómo se comparten los tipos TypeScript, cómo se configura ESLint y cómo se ejecuta Jest. Esta decisión debe quedar registrada en `team.md` antes del diseño funcional de las unidades para que las convenciones de naming y estilo sean aplicables sin ambigüedad.

## Positions

AGREE: Trunk-based development con squash-merge de Bolts — consistente con las prácticas estándar para un desarrollador individual; el historial de decisiones en `audit.md` compensa la pérdida de commits intermedios en `main`.

AGREE: Walking skeleton como Bolt 1 — la validación temprana de K8s + backend + API de Claude como hipótesis de integración es correcta; el riesgo de integración es el más alto del proyecto y debe resolverse antes que cualquier funcionalidad.

AGREE: Jest + ts-jest para backend, React Testing Library para frontend — selección idiomática, sin alternativas mejores para el stack declarado.

AGREE: Floor de cobertura del 80% verificado en CI — derivado correctamente del scope `feature` según `org.md`; el floor no debe bajarse para que un paso pase.

AGREE: K8s Secrets para la API key de Anthropic — no negociable; commitear secretos en claro invalida el proyecto académico y es un defecto de seguridad bloqueante.

OBJECT: Code Style — las convenciones definidas son necesarias pero insuficientes para un proyecto multi-servicio de 4 componentes. Falta definir: (a) la ubicación y ownership de los tipos TypeScript compartidos entre servicios, (b) la convención de error handling entre capas (controlador → servicio → integración externa), y (c) si los contratos HTTP se expresan como tipos TS, OpenAPI, o esquemas de validación runtime (Zod). Estas tres decisiones son prerrequisito para que la Code Generation de las unidades genere código consistente entre servicios. Se recomienda añadirlas al borrador antes de aprobarlo.

OBJECT: Estructura de repositorio (monorepo vs. multi-repo) — el borrador no la afirma, pero la respuesta cambia cómo se aplican todas las convenciones de naming y linting. Debe resolverse en esta etapa o en Functional Design antes de que las unidades se diseñen.
