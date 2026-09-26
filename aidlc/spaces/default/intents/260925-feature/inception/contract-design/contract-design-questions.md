## Sources

- [comp] inception/domain-design/components.md
- [units] inception/units-generation/unit-of-work.md
- [req] inception/requirements-analysis/requirements.md

---

## Q1. Protocolo de comunicación entre servicios

¿Qué protocolo usa la comunicación interna entre los 4 backend services?

A. REST HTTP (JSON) — el estándar de facto para servicios Node.js; bien soportado, fácil de testear.
B. gRPC — más eficiente para comunicación interna en K8s, pero requiere generación de código.
C. REST HTTP para Frontend → Servicios; llamadas directas a DB (read-only user) para ProgressService → ingestion schema. Sin comunicación HTTP entre servicios backend excepto el cascade de borrado de TrustService.
D. La decisión de protocolo se toma en Functional Design — por ahora solo necesito los shapes de los contratos.
X. Other (please specify)

[Answer]:

---

## Q2. Formato de API para el nivel de acceso público

¿Hay un API gateway centralizado o cada servicio expone sus endpoints directamente?

A. K8s Ingress como API gateway — el Ingress enruta por path prefix (/upload → IngestionService, /trends → ProgressService, etc.); los servicios no saben del routing.
B. API gateway dedicado (Kong, Traefik con plugins, o similar) con autenticación centralizada.
C. Cada servicio expone directamente sus endpoints; el Frontend los consume directamente sin gateway.
D. Definir en Functional Design — por ahora establecer los contratos de cada servicio individualmente.
X. Other (please specify)

[Answer]:
