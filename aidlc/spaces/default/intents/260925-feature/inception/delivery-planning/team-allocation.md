## Sources

- [team] ideation/team-formation/mob-composition.md
- [bolts] inception/delivery-planning/bolt-plan.md

---

# Team Allocation — Estudio MVP

> Asignación de Bolts al equipo de construcción. Este proyecto tiene un solo desarrollador (Juan Hurtado, ~5 h/semana). No hay Program Board ni asignación multi-equipo.

## Team

| Rol | Persona | Responsabilidad durante Construction |
|-----|---------|--------------------------------------|
| Developer (full-stack) | Juan Hurtado | Implementa cada Bolt: backend (Node.js/TS), frontend (React), manifiestos K8s |
| AI Pair Programmer | aidlc-developer-agent | Genera código, escribe tests, propone diseño; Juan aprueba cada Bolt |

## Bolt Assignment

Todos los Bolts son propiedad del mismo equipo (solo desarrollador + aidlc-developer-agent). El modelo de trabajo es: Juan conduce las decisiones; aidlc-developer-agent ejecuta la implementación y la revisión interna; Juan aprueba antes de pasar al siguiente Bolt.

| Bolt | Unidad(es) | Propietario | Estimación sesión |
|------|-----------|-------------|-------------------|
| B1 | u0-frontend + u8-authentication | Juan Hurtado + aidlc-developer-agent | ~6-8 h (setup K8s + auth) |
| B2 | u1-image-upload | Juan Hurtado + aidlc-developer-agent | ~4 h |
| B3 | u2-ai-critique | Juan Hurtado + aidlc-developer-agent | ~5 h (Claude API + contract test) |
| B4 | u3-low-confidence | Juan Hurtado + aidlc-developer-agent | ~3 h |
| B5 | u4-critique-storage | Juan Hurtado + aidlc-developer-agent | ~4 h (BD + blob storage) |
| B6 | u5-history-storage | Juan Hurtado + aidlc-developer-agent | ~3 h |
| B7 | u6-trend-calculation | Juan Hurtado + aidlc-developer-agent | ~4 h (regresión lineal) |
| B8 | u9-upload-limits | Juan Hurtado + aidlc-developer-agent | ~3 h |
| B9 | u7-tier-api | Juan Hurtado + aidlc-developer-agent | ~3 h |
| B10 | u11-onboarding | Juan Hurtado + aidlc-developer-agent | ~3 h |
| B11 | u10-mock-payment | Juan Hurtado + aidlc-developer-agent | ~2 h |
| B12 | u12-data-policy | Juan Hurtado + aidlc-developer-agent | ~2 h |
| B13 | u13-history-deletion | Juan Hurtado + aidlc-developer-agent | ~4 h (cascade multi-servicio) |

**Total estimado**: ~50 h de desarrollo (~10 semanas a 5 h/semana)

## Work Style

- Sesiones de 2-3 h por trabajo (recomendado por mob-composition.md)
- Un Bolt por sesión donde sea posible (la mayoría están en el rango de 3-5 h)
- B1 puede requerir 2 sesiones por la complejidad del setup de K8s
- Commit de código funcionando al cluster local al finalizar cada Bolt

## Assumptions & Open Questions

- La estimación de horas es orientativa; K8s setup (B1) puede variar mucho según la configuración previa del alumno. [assumption]
- No hay dependencias de entrega entre Juan y otro equipo externo. [assumption]
