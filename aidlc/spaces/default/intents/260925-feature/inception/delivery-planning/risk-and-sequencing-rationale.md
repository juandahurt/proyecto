## Sources

- [dep] inception/units-generation/unit-of-work-dependency.md
- [contracts] inception/contract-design/contract-summary.md
- [questions] inception/delivery-planning/delivery-planning-questions.md

---

# Risk and Sequencing Rationale — Estudio MVP

## Heurística elegida: Critical-path-first

La secuencia de Bolts sigue la **cadena de dependencias más larga** del DAG como eje principal (Q1=B). Dado que esta cadena concentra también el **mayor riesgo técnico** del proyecto (la integración con Claude Vision API), el criterio critical-path y el criterio risk-first convergen en la misma secuencia: no hay desvío respecto al orden topológico de la ruta crítica.

**Ruta crítica** (8 unidades en serie):
`u0/u8 → u1 → u2 → u3 → u4 → u5 → u6 → u7`

Esta ruta cubre el journey principal del producto de extremo a extremo: registro → upload → análisis Claude → almacenamiento → historial → tendencias → gate de freemium.

## Validación del DAG

La secuencia propuesta respeta todas las restricciones del grafo de dependencias (`unit-of-work-dependency.md`). La tabla siguiente muestra cada Bolt, sus dependencias requeridas, y los Bolts donde se satisfacen:

| Bolt | Unidad | Depende de | Satisfecho en Bolt |
|------|--------|-----------|-------------------|
| B1 | u0 + u8 | (ninguna) | — |
| B2 | u1 | u0, u8 | B1 ✓ |
| B3 | u2 | u1 | B2 ✓ |
| B4 | u3 | u2 | B3 ✓ |
| B5 | u4 | u2, u3, u8 | B3, B4, B1 ✓ |
| B6 | u5 | u4 | B5 ✓ |
| B7 | u6 | u5 | B6 ✓ |
| B8 | u9 | u8 | B1 ✓ |
| B9 | u7 | u6, u9 | B7, B8 ✓ |
| B10 | u11 | u8 | B1 ✓ |
| B11 | u10 | u9 | B8 ✓ |
| B12 | u12 | u8 | B1 ✓ |
| B13 | u13 | u4, u5, u6, u8, u9 | B5, B6, B7, B1, B8 ✓ |

No hay desvíos respecto al orden topológico. La única "rama" (u9 en Bolt 8, antes de u7 en Bolt 9) es topológicamente obligatoria: u7 necesita u9.

## Razonamiento por riesgo

### Riesgo 1 (Mayor): Integración con Claude Vision API
**Nivel**: Alto | **Bolt**: B3 (tercer Bolt de construcción, quinto en total)
**Por qué es el mayor riesgo**: La API de Anthropic es el único punto externo del sistema. El schema de respuesta estructurada (5 categorías, confidence, scores 0-100) debe parsearse y validarse correctamente. Un error aquí hace que todos los Bolts posteriores de IngestionService y ProgressService sean inútiles.
**Mitigación en la secuencia**: Se aborda en B3, inmediatamente después del prerequisito mínimo (u1, el endpoint de upload). No se construye almacenamiento, historial ni tendencias antes de validar que Claude responde correctamente. El test de contrato (C10, afirmado en team.md) fija el schema en CI desde este Bolt.

### Riesgo 2: Setup de K8s (Bolt 1)
**Nivel**: Alto | **Bolt**: B1 (walking skeleton)
**Por qué es un riesgo**: El alumno puede encontrar diferencias entre k3s, minikube y kind. El routing del Ingress y la conectividad entre pods son puntos de fallo habituales en el primer despliegue.
**Mitigación**: El walking skeleton (B1) existe explícitamente para este riesgo. Al ser el primer Bolt, cualquier problema de infraestructura se detecta antes de construir ninguna feature. Si B1 tarda más de lo estimado, sólo afecta a B1.

### Riesgo 3: Cascade de borrado multi-servicio (u13)
**Nivel**: Medio | **Bolt**: B13 (último)
**Por qué es un riesgo**: TrustService coordina llamadas HTTP best-effort a 3 servicios. El comportamiento de error (proceder y loguear fallos) debe implementarse correctamente para evitar estados inconsistentes.
**Mitigación**: Se deja para el final porque es el único Bolt que depende de todos los servicios anteriores. Para cuando llegue, todos los endpoints internos (C7, C8, C9) ya están implementados y testeados por sus respectivos servicios.

### Riesgo 4: Lógica de freemium (u9 + u7)
**Nivel**: Medio | **Bolts**: B8, B9
**Por qué es un riesgo**: El contador de uploads y el gate de tier requieren coordinación entre IdentityService y ProgressService en tiempo de request. Un error en el endpoint C6 afecta a toda la propuesta de valor freemium.
**Mitigación**: u9 (Bolt 8) construye el contador antes de que u7 (Bolt 9) lo consuma. El test de integración de C6 se escribe en B8.

## Desvíos respecto al orden topológico

**Ninguno.** La secuencia critical-path-first es también topológicamente válida. El único punto de decisión explícito fue el orden relativo de B8 (u9) y B10/B11/B12 (ramas de TrustService e IdentityService): se eligió B8 antes porque u9 es prerrequisito de u7 (Bolt 9), y u7 cierra la ruta crítica.

## Decisión de Walking Skeleton

El walking skeleton (B1 = u0-frontend + u8-authentication) agrupa dos unidades de forma excepcional porque ambas son prerrequisitos sin dependencias entre sí y juntas forman el mínimo viable arquitectónico: sin el frontend conectado al Ingress y sin autenticación JWT, ninguna otra unidad puede testearse de extremo a extremo.

## Assumptions & Open Questions

- La estimación del coste de delay de cada unidad es informal (no se aplicó WSJF formal con puntuaciones numéricas) porque el proyecto tiene un solo desarrollador y no hay múltiples equipos compitiendo por capacidad. [assumption]
- Los Bolts B10-B12 (TrustService y mock payment) podrían hacerse en paralelo topológicamente (todos dependen solo de u8/u9), pero al ser un proyecto serial de un solo dev, el orden elegido (B10, B11, B12) es arbitrario dentro de las restricciones del DAG. Se priorizó onboarding (B10) por ser un gate de usuario antes del primer upload. [assumption]
