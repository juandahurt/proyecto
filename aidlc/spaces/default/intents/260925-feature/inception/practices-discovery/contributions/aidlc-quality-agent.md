**Collaborator:** aidlc-quality-agent

## Contribution

**1. La postura test-after es sostenible para 5 h/semana, pero requiere un techo de tiempo explícito por Bolt.**
El floor del 80% de cobertura de líneas derivado del scope `feature` es correcto según el org. Sin embargo, con ~5 h/semana, el riesgo real no es el umbral en sí, sino cuánto tiempo consumen los tests de cada Bolt. Sin un techo orientativo (p.ej., "los tests no deben superar el 30% del tiempo de desarrollo del Bolt"), el desarrollador podría llegar a merges sin tiempo para ejecutar el pipeline. Se recomienda afirmar ese techo como práctica de equipo para que Build and Test lo tenga como referencia.

**2. Los smoke tests post-despliegue están presentes, pero el coverage de la capa K8s es puntual, no estructurado.**
El draft define correctamente el smoke test del endpoint `/health` tras cada `kubectl apply`. Lo que falta es un criterio explícito de "despliegue listo" más allá de que el Pod responda: liveness vs. readiness probe, tiempo máximo de espera antes de considerar el despliegue fallido, y qué constituye un rollback. Sin estos criterios, el smoke test pasa aunque el Pod arranque en estado degradado (p.ej., sin poder alcanzar el K8s Secret de Anthropic).

**3. El riesgo principal del producto (consistencia de categorización por la API de Claude) no tiene cobertura de test afirmada.**
Las capas backend y frontend tienen tooling definido (Jest/ts-jest y RTL), pero el mayor riesgo funcional — que la categorización que devuelve Claude sea inconsistente entre llamadas con los mismos parámetros — no aparece en el test plan. Esto requiere al menos: (a) tests unitarios con respuestas mockeadas de la API de Anthropic para validar el procesamiento de la respuesta, y (b) una suite de contrato mínima que fije el schema de la respuesta esperada, de forma que un cambio de modelo o de prompt rompa el test antes de llegar a producción.

**4. El floor del 80% no distingue entre código crítico y código de scaffolding.**
Un 80% de cobertura de líneas global puede alcanzarse cubriendo mayoritariamente código de setup, wiring e inicialización, dejando sin tests la lógica de negocio (parsing de respuesta de Claude, validación de categorías). Se recomienda afirmar adicionalmente un floor de cobertura de ramas (branch coverage) del 75% sobre los módulos `service/` y `handlers/`, que son donde reside la lógica de categorización.

**5. La estrategia de CI en entorno K8s local crea un gap de reproducibilidad.**
El draft menciona "GitHub Actions o pipeline local equivalente" pero, para un K8s local, GitHub Actions no puede ejecutar los tests de integración contra el cluster del desarrollador. Esto significa que el gate de CI real antes de merge es el pipeline local. Debe afirmarse explícitamente: (a) qué pasos del pipeline son obligatorios en local antes de cada merge, y (b) cuáles son los únicos que GitHub Actions puede verificar (lint, unit tests, cobertura), de forma que nadie asuma que el CI remoto cubre lo que solo el entorno local puede cubrir.

## Positions

AGREE: **Metodología test-after** — adecuada para el ritmo de trabajo de un desarrollador individual con tiempo limitado; TDD añadiría fricción sin proporcionar beneficio proporcional en este contexto.

AGREE: **Floor del 80% de cobertura de líneas** — correcto según el org para el scope `feature`; no debe rebajarse para que un Bolt pase.

AGREE: **Jest + ts-jest para backend, React Testing Library para frontend** — opciones idiomáticas y bien documentadas para el stack TypeScript/React; minimizan la curva de aprendizaje.

AGREE: **Smoke test de `/health` post-despliegue** — necesario y bien ubicado; un despliegue sin verificación de salud no es un despliegue completado.

OBJECT: **Ausencia de cobertura de contrato para la API de Anthropic** — el mayor riesgo funcional del producto es la consistencia de la categorización producida por Claude; los tests unitarios con mocks son necesarios pero no suficientes; debe añadirse al menos un test de contrato que fije el schema de respuesta esperado.

OBJECT: **Alcance del floor de cobertura (solo líneas, global)** — un floor exclusivamente de líneas a nivel global no garantiza cobertura de la lógica crítica; debe complementarse con branch coverage sobre los módulos de servicio.
