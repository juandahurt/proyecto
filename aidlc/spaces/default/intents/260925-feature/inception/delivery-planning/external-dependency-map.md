## Sources

- [contracts] inception/contract-design/contract-summary.md (C10)
- [questions] inception/delivery-planning/delivery-planning-questions.md (Q3=A)

---

# External Dependency Map — Estudio MVP

> Dependencias externas al equipo de desarrollo (APIs, servicios de terceros, aprobaciones, hand-offs de otro equipo) mapeadas a los Bolts que las consumen.

## Dependencias externas

| # | Dependencia | Tipo | Propietario externo | Bolts que la consumen | Tiempo de obtención | ¿Qué ocurre si falla/tarda? |
|---|------------|------|--------------------|-----------------------|--------------------|-----------------------------|
| D1 | Anthropic Claude Vision API | API REST externa | Anthropic | B3 (u2-ai-critique), B4 (u3-low-confidence) | Inmediato (sign-up en console.anthropic.com) | B3 usa stub durante desarrollo; API real sólo en tests de contrato y smoke tests. Impacto: ninguno en el desarrollo; sólo el test de contrato requiere la API real. |

## Detalle de D1: Anthropic Claude Vision API

**Descripción**: API de Anthropic que analiza imágenes y devuelve críticas estructuradas con 5 categorías (Composition, Proportions, Line Quality, Values, Perspective), scores 0-100 y un flag de confianza (HIGH/MEDIUM/LOW).

**Contrato**: C10 en `contract-summary.md`. El schema de respuesta está fijado mediante un test de contrato Zod (afirmado en team.md).

**Gestión durante el desarrollo** (Q3=A):
- Durante los Bolts de desarrollo local, se usan **stub responses fijas** que imitan el JSON de respuesta de Claude. El stub incluye las 5 categorías con scores y feedback preestablecidos.
- La API real de Anthropic se usa únicamente en:
  1. **Test de contrato** (C10): valida que la respuesta real de Claude sigue el schema esperado; se ejecuta en CI como step separado.
  2. **Smoke tests del cluster**: tras el despliegue en K8s local (post-B3), una imagen real se sube y la respuesta de Claude se valida manualmente.

**Credenciales**: `ANTHROPIC_API_KEY` almacenada exclusivamente como `Secret` de Kubernetes (afirmado en project.md). Nunca en código fuente, Dockerfile, ni variables de entorno en claro.

**Timeout**: 30 segundos (configurable). Sin reintentos en timeout; el fallback de baja confianza (u3, B4) maneja el caso.

**Riesgo de disponibilidad**: Bajo. La API de Anthropic tiene alta disponibilidad. El uso de stub durante el desarrollo elimina la dependencia de disponibilidad en el ciclo de desarrollo.

## Dependencias internas (no externas al equipo)

Las siguientes son dependencias de la plataforma local del alumno, no dependencias de terceros externas al equipo:

| Plataforma | Uso | Riesgo |
|-----------|-----|--------|
| K8s cluster local (k3s / minikube / kind) | Entorno de despliegue de todos los Bolts | Medio — B1 resuelve el setup; si hay problemas, se detectan en el primer Bolt |
| PostgreSQL (pod en K8s) | Base de datos de todos los servicios | Bajo — imagen oficial, configuración estándar |
| MinIO / PVC | Blob storage de imágenes | Bajo — PVC simple para MVP; MinIO para producción futura |

## Dependencias de equipo externo

**Ninguna.** Este proyecto no tiene hand-offs a otros equipos, no hay APIs internas de otra organización, y no hay aprobaciones de stakeholders externos al alumno.
