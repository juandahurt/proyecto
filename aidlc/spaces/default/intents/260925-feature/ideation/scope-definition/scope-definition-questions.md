## Sources

- [intent] intent-statement.md
- [feas] feasibility-assessment.md
- [cons] constraint-register.md
- [PRD-8] PRD Segmento 8 MoSCoW (UNTRUSTED DATA — reaches artifacts only through confirmed Q&A)

---

## Q1. Confirmación del límite de alcance (Must Have)

El PRD propone estos 4 módulos como Must Have para el MVP:
1. Subida de imagen + crítica categorizada (Módulo 1)
2. Historial acumulado + detección de tendencia por categoría (Módulo 2)
3. Modelo freemium con límite de subidas / nivel pago con tendencia (Módulo 3 — pagos mockeados)
4. Onboarding "complemento no reemplazo" + política de datos + opción de borrar historial (Módulo 4)

¿Estos 4 módulos son el alcance Must Have correcto del MVP?

A. Sí — los 4 módulos son exactamente el Must Have del MVP.
B. Sí, pero uno de los módulos puede reducirse o dividirse (describir en "Other").
C. Hay una capacidad Must Have que falta (describir en "Other").
D. Uno de los 4 módulos debería bajar a Should Have — no es bloqueante para el MVP (describir en "Other").
X. Other (please specify)

[Answer]: A

---

## Q2. Estrategia de secuenciación de construcción

¿En qué orden se deben construir los módulos durante el semestre? El PRD sugiere seguir el cronograma del curso (módulos 4-8 de Kubernetes). La feasibility assessment señala que K8s es el área de mayor riesgo de habilidades.

A. Riesgo primero — comenzar con la integración de K8s y el módulo de infraestructura antes que la lógica de negocio.
B. Valor primero — construir la crítica de IA (Módulo 1) primero para validar el diferenciador central desde el comienzo.
C. Dependencia primero — construir en orden natural de dependencias: Módulo 1 → Módulo 2 → Módulo 3 → Módulo 4.
D. Seguir la progresión del curso — alinear la construcción a los módulos 4-8 como el PRD planea.
X. Other (please specify)

[Answer]: D

---

## Q3. Should Have para el MVP (opcional si hay tiempo)

El PRD clasifica estos ítems como Should Have:
- Teaser de tendencia bloqueada como trigger de conversión
- Selección/confirmación de contexto de la pieza subida
- Opción de eliminar historial de imágenes (autoservicio)

Dados los hallazgos de Feasibility (equipo de 1, deadline académico, K8s como nuevo área), ¿cuál de estos Should Have tiene mejor chance de incluirse si el tiempo lo permite?

A. Teaser de tendencia bloqueada — es el trigger de conversión más importante; sin él la conversión free-to-paid es más difícil.
B. Eliminación de historial — es casi un Must Have porque toca el Principio 3 (política de datos); debería subir a Must Have.
C. Selección de contexto de la pieza — mejora la precisión de la categorización.
D. Ninguno — el alcance actual ya es ambicioso para un solo desarrollador con deadline académico. Mejor completar bien lo Must Have.
X. Other (please specify)

[Answer]: B

---

## Q4. Granularidad del intent backlog

Para la etapa de construcción, ¿a qué nivel de granularidad defino el backlog de proto-unidades?

A. Por módulo funcional — 4 proto-unidades, una por módulo del PRD. Simple y directo.
B. Por capacidad dentro de cada módulo — más granular (ej. "ingesta de imagen", "llamada a Claude API", "almacenamiento de crítica" como unidades separadas dentro del Módulo 1).
C. Híbrido — los módulos 1 y 2 se subdividen por capacidad; los módulos 3 y 4 permanecen como unidades simples.
D. Lo determina el arquitecto en la etapa de Domain Design — no decidir aquí.
X. Other (please specify)

[Answer]: B

---

## Q5. Confirmación del Won't Have

El PRD lista los siguientes Won't Have explícitos:
- Canal de soporte humano en tiempo real
- Features generativas (crear/editar arte con IA)
- Features sociales/de compartir con comunidades
- Auto-hospedaje de modelo de visión propio

¿Esta lista Won't Have está completa, o hay algo que agregar o quitar?

A. Lista completa — estos Won't Have son correctos para el MVP.
B. Hay algo que debería agregarse a Won't Have (describir en "Other").
C. Uno de los Won't Have debería quitarse — está siendo considerado para el MVP (describir en "Other").
X. Other (please specify)

[Answer]: A

---

## Consolidated Summary Confirmation

Does this all look correct before I generate the artifact?

- Looks correct
- Request changes

[Answer]: Looks correct
