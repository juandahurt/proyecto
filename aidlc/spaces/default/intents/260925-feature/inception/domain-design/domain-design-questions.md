## Sources

- [req] requirements.md
- [backlog] intent-backlog.md
- [dec-log] decision-log.md (DEC-11: external Claude API, DEC-15: Node.js/TS + React)

---

## Q1. Granularidad de los servicios backend

Los 4 módulos funcionales del PRD (ingesta, historial, cuentas, confianza) pueden implementarse como 4 servicios independientes, como 2-3 servicios agrupados por afinidad de dominio, o como un monolito modular. ¿Cuál es la granularidad correcta para el MVP?

A. 4 servicios independientes — uno por módulo funcional. Cada uno como Deployment de K8s separado.
B. 2 servicios: (1) Core API (ingesta + historial + cuentas + confianza como módulos internos); (2) Frontend (React SPA). Monolito modular, no microservices.
C. 3 servicios: (1) Critique API (ingesta + análisis); (2) User API (historial + cuentas + confianza); (3) Frontend React.
D. La granularidad la decide el arquitecto basado en las reglas de bounded context — no forzar aquí.
X. Other (please specify)

[Answer]: A

---

## Q2. Boundary de los datos de imagen

Las imágenes subidas son los datos más sensibles del sistema. ¿Quién es el propietario único del acceso a los blobs de imagen?

A. El servicio de ingesta (Image Analysis) — es el único componente que lee y escribe blobs; todos los demás acceden a las críticas (texto/scores), nunca a los bytes de la imagen.
B. No hay frontera estricta — cualquier servicio que necesite mostrar una imagen puede acceder al storage directamente.
C. Un servicio de media dedicado — todos los accesos a blobs pasan por él, incluyendo la generación de signed URLs para el frontend.
D. El arquitecto decide en el diseño funcional — no decidir aquí.
X. Other (please specify)

[Answer]: A

---

## Q3. Modelo de datos para el historial de tendencias

¿Cómo se almacena la serie de tiempo de scores por categoría por usuario?

A. Tabla relacional: una fila por (user_id, upload_id, category_id, score). La tendencia se calcula en tiempo real con una query.
B. Tabla relacional + columna calculada de tendencia por categoría. La tendencia se recalcula y almacena en el momento de cada nueva subida.
C. Document store (MongoDB o similar) — el historial de cada usuario es un documento con el array de scores por categoría.
D. El esquema exacto se decide en Diseño Funcional — solo necesito saber ahora qué tipo de almacenamiento (relacional vs. document) es el correcto.
X. Other (please specify)

[Answer]: A

---

## Consolidated Summary Confirmation

Does this all look correct before I generate the artifact?

- Looks correct
- Request changes

[Answer]: Looks correct
