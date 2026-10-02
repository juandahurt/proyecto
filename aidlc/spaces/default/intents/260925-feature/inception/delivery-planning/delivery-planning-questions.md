## Sources

- [units] inception/units-generation/unit-of-work.md
- [dep] inception/units-generation/unit-of-work-dependency.md
- [story-map] inception/units-generation/unit-of-work-story-map.md
- [contracts] inception/contract-design/contract-summary.md
- [team] aidlc/spaces/default/memory/team.md (walking skeleton afirmado Q2=A; solo dev)

---

## Contexto

El Bolt 1 (skeleton) ya está fijado en `team.md`: **u0-frontend + u8-authentication** — conecta todas las capas arquitectónicas (K8s Ingress → 4 pods → BD stub). Las siguientes preguntas definen el orden y la agrupación de los 12 unidades restantes (u1-u7, u9-u13).

Un **Bolt** es un ciclo de construcción completo sobre una o varias unidades: termina en código funcionando y aprobado. Cada Bolt avanza el plan una unidad de valor entregable.

---

## Q1. Estrategia de secuenciación para los Bolts 2+

Después del walking skeleton, ¿en qué orden abordamos las 12 unidades restantes?

A. **Risk-first**: integración con Claude Vision API (u2-ai-critique + u3-low-confidence) tan pronto como sea posible — es la mayor incógnita técnica y el contrato más delicado (C10). Bolt 2 = u1-image-upload (prerequisito), Bolt 3 = u2+u3 (Claude integration + fallback).
B. **Critical-path-first**: seguir la cadena de dependencias principal en orden (u1→u2→u3→u4→u5→u6→u7), luego las ramas de IdentityService y TrustService. Maximiza el tiempo de integración de la ruta crítica.
C. **Value-delivery-first**: construir primero el journey completo del usuario principal (upload → critique → storage → history → trend), dejando la capa de freemium (limits, payment) para el final.
D. **Foundation-first**: construir primero los servicios de infraestructura compartida (IdentityService completo: u8 ya hecho, u9-upload-limits, u10-mock-payment), luego el journey de valor (IngestionService, ProgressService), luego TrustService.
X. Other (please specify)

[Answer]: B

---

## Q2. Granularidad de Bolt: ¿una unidad por Bolt o agrupadas?

¿Cómo de grandes deben ser los Bolts después del walking skeleton?

A. **Una unidad por Bolt** — 12 Bolts adicionales (14 en total). Máxima granularidad; cada Bolt es una sesión de trabajo enfocada. Fácil de aprobar y ajustar. Adecuado para un solo desarrollador.
B. **Agrupar unidades estrechamente acopladas** — por ejemplo, u2+u3 (critique + fallback son una sola feature) y u5+u6 (history + trend calculation son un solo flujo de análisis). Alrededor de 9-10 Bolts totales.
C. **Agrupar por servicio** — cada Bolt entrega un servicio completo (ej., todos los units de IngestionService juntos, luego ProgressService, etc.). 5-6 Bolts totales; mayor complejidad por Bolt.
X. Other (please specify)

[Answer]: A

---

## Q3. API de Claude Vision (C10): manejo durante el desarrollo

La API de Anthropic es la única dependencia externa. ¿Cómo gestionarla mientras se construye?

A. **Stub responses para el desarrollo local** — Bolt 3 implementa u2 contra respuestas fijas simuladas; se sustituye por la API real en los tests de contrato (ya afirmado en team.md) y los smoke tests del cluster.
B. **API real desde el principio** — la clave se inyecta como K8s Secret desde el Bolt 3; el timeout de 30s y el fallback de baja confianza (u3) cubren las fallos de API. No hace falta stub.
C. **Mock service en el cluster K8s local** — se despliega un pod que imita el endpoint de Anthropic; se reemplaza por la API real solo cuando se corre el test de contrato del schema de respuesta.
X. Other (please specify)

[Answer]: A

---

## Q4. Mayor preocupación: ¿qué queremos resolver más temprano?

¿Cuál es el mayor riesgo técnico o de producto que debería quedar despejado en los primeros Bolts?

A. **La integración con Claude Vision API** — parseo correcto de la respuesta, validación del schema (5 categorías, scores 0-100, confidence), y el test de contrato que lo fija (C10, team.md).
B. **La infraestructura K8s** — el walking skeleton (Bolt 1) debería resolver el routing de Ingress y la conectividad DB; si no, este riesgo persiste en Bolt 2.
C. **La lógica de freemium** — el contador de uploads (u9), el gate de tier (u7), y el cascade de borrado (u13) son la parte más compleja de coordinación entre servicios.
D. **El flujo de privacidad y onboarding** — u11 (gate de primer uso) y u13 (borrado definitivo) bloquean la confianza del usuario; priorizarlos demuestra compliance desde el principio.
X. Other (please specify)

[Answer]: A

---

## Assumptions & Open Questions

- El Bolt 1 (walking skeleton) está fijado: u0-frontend + u8-authentication. No se pregunta sobre él. [assumption]
- El proyecto tiene un solo desarrollador; todos los Bolts son ejecutados por el mismo agente (aidlc-developer-agent). No hay asignación de equipos. [assumption]
- La ejecución de Bolts es serial (un Bolt completado y aprobado antes de empezar el siguiente). [assumption]
- No hay dependencias externas de equipo; la única dependencia externa es la API de Anthropic. [assumption]
- El entorno de destino es K8s local (k3s/minikube/kind); no hay despliegue cloud durante el MVP. [assumption]

---

## Consolidated Summary Confirmation

Resumen de decisiones antes de generar los artefactos:

- **Q1=B** — Critical-path-first: la secuencia sigue la cadena de dependencias principal (u1→u2→u3→u4→u5→u6→u7) antes de las ramas de IdentityService (u9, u10) y TrustService (u11, u12, u13).
- **Q2=A** — Una unidad por Bolt. Resultado: 13 Bolts en total (Bolt 1 agrupa u0+u8 por ser el walking skeleton; los 12 Bolts siguientes tienen una unidad cada uno).
- **Q3=A** — Stub responses para desarrollo local; la API de Anthropic se usa únicamente en el test de contrato del schema de respuesta (C10) y en los smoke tests del cluster K8s.
- **Q4=A** — Mayor riesgo: integración con Claude Vision API (parseo de respuesta estructurada, validación del schema, test de contrato). La secuencia critical-path lo aborda en Bolt 3 (u2-ai-critique).

**Secuencia de Bolts resultante:**

| Bolt | Unidad(es) | Servicio | Posición en cadena |
|------|-----------|----------|-------------------|
| B1 | u0-frontend + u8-authentication | Frontend + IdentityService | Walking skeleton |
| B2 | u1-image-upload | IngestionService | Ruta crítica |
| B3 | u2-ai-critique | IngestionService | Ruta crítica — Claude API (mayor riesgo) |
| B4 | u3-low-confidence | IngestionService | Ruta crítica — fallback |
| B5 | u4-critique-storage | IngestionService | Ruta crítica — cierra IngestionService |
| B6 | u5-history-storage | ProgressService | Ruta crítica |
| B7 | u6-trend-calculation | ProgressService | Ruta crítica |
| B8 | u9-upload-limits | IdentityService | Rama Identity — desbloquea u7 y u13 |
| B9 | u7-tier-api | ProgressService | Ruta crítica — cierra freemium |
| B10 | u11-onboarding | TrustService | Rama Trust |
| B11 | u10-mock-payment | IdentityService | Rama Identity |
| B12 | u12-data-policy | TrustService | Rama Trust |
| B13 | u13-history-deletion | TrustService | Cascade — requiere todo lo anterior |

- Looks correct
- Request changes

[Answer]: Looks correct
