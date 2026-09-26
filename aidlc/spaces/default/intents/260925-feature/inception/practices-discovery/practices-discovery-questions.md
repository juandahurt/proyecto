## Sources

- [org] aidlc/spaces/default/memory/org.md (defaults de organización)
- [team-draft] team-practices.md (borrador inicial del lead)
- [quality] contributions/aidlc-quality-agent.md
- [dev] contributions/aidlc-developer-agent.md
- [sec] contributions/aidlc-devsecops-agent.md

---

## Q1. ¿Monorepo o repositorios separados?

Tienes 4 servicios: ingesta/análisis de imagen, historial/tendencias, cuentas/suscripción, y confianza/datos. Todos comparten tipos TypeScript (usuarios, categorías de crítica). ¿Cómo organizas el código?

A. Monorepo — todos los servicios en el mismo repositorio con Turborepo o Nx para gestionar los tipos compartidos.
B. Monorepo simple sin herramienta monorepo — una carpeta `packages/shared` para tipos y todos los servicios como subdirectorios.
C. Repositorios separados — cada servicio en su propio repo. Los tipos se duplican o se publican como paquete npm local.
D. Todavía no lo sé — decidir en diseño técnico.
X. Other (please specify)

[Answer]: A

---

## Q2. ¿Construir un esqueleto funcional primero?

Un "walking skeleton" (esqueleto funcional) es la versión más delgada posible del sistema que conecta todas las capas de extremo a extremo: usuario sube imagen → API gateway recibe la petición en K8s → servicio de backend llama a Claude API (con respuesta mockeada) → se almacena algo en BD → se devuelve una respuesta. No es funcional completamente, pero demuestra que las piezas se conectan. ¿Quieres construir este esqueleto primero como Bolt 1?

A. Sí — construir el esqueleto conectado primero. Descubrir problemas de integración en el módulo 4 antes de que afecten a los módulos siguientes.
B. No — construir por capacidad completa (subida de imagen + análisis real) desde el principio, sin un paso previo de integración thin.
C. Híbrido — el primer Bolt construye el pipeline de K8s (manifiestos, API gateway, health checks) sin la lógica de negocio, luego Bolt 2 agrega la lógica.
X. Other (please specify)

[Answer]: A

---

## Q3. Estrategia de tests para la integración con Claude API

El mayor riesgo del producto es que la categorización de Claude sea inconsistente. La revisora de calidad señaló que los tests unitarios con mocks no son suficientes para este riesgo. ¿Qué estrategia usas para los tests de la integración con Claude?

A. Solo mocks — los tests unitarios del procesamiento de respuesta usan respuestas fijas de la API; no hay tests de contrato.
B. Mocks + test de contrato básico — un test que valida el schema de la respuesta de Claude (estructura esperada, campos presentes) para que un cambio de modelo o de prompt lo rompa antes de llegar a producción.
C. Mocks + test de consistencia manual — una suite de 50-100 imágenes etiquetadas manualmente que se ejecutan contra la API real periódicamente (no en CI) para medir consistencia.
D. Diseñar los tests de integración con Claude en la etapa de Diseño Funcional — no decidir aquí.
X. Other (please specify)

[Answer]: B

---

## Q4. CI: ¿GitHub Actions o solo pipeline local?

Para un clúster K8s local, GitHub Actions no puede ejecutar tests de integración contra tu cluster. ¿Cuál es el contrato de CI antes de cada merge?

A. Solo pipeline local — lint + unit tests + coverage + smoke test en local antes de cada merge. GitHub Actions solo sirve como registro, no como gate.
B. GitHub Actions para lint + unit tests + coverage (sin K8s); pipeline local obligatorio para smoke tests de K8s antes de merge.
C. GitHub Actions para todo lo que se pueda (lint, unit tests, coverage); el smoke test K8s es manual antes de la demo — no en CI.
D. No hay CI formal — el proyecto es académico, el control de calidad es manual.
X. Other (please specify)

[Answer]: B

---

## Q5. Validación de subidas de imágenes en el servidor

El desarrollador DevSecOps señaló que el endpoint de subida de imágenes es la superficie de ataque más común. ¿Qué nivel de validación de entrada aplicas en el servidor para las imágenes subidas?

A. Validación básica — verificar que el Content-Type sea JPEG/PNG/WebP y que el tamaño no supere el límite. El nombre del archivo lo genera el servidor (no el usuario).
B. Validación estricta — además de A, verificar el magic number (los primeros bytes del archivo) para confirmar que es realmente una imagen, no un archivo renombrado.
C. No decido esto aquí — es un detalle de implementación para la etapa de Diseño Funcional.
X. Other (please specify)

[Answer]: B

---

## Q6. Cobertura de tests — ¿floor global o también por capa crítica?

El floor del 80% de cobertura de líneas aplica al proyecto completo. La revisora de calidad sugirió añadir un floor adicional de cobertura de ramas del 75% sobre los módulos de servicio (donde vive la lógica de categorización). ¿Adoptas este floor adicional?

A. Sí — 80% líneas global + 75% ramas sobre módulos de servicio (`service/`, `handlers/`).
B. No — 80% de líneas global es suficiente. Prefiero no añadir complejidad al tooling de CI.
C. Sí al floor de ramas, pero con un threshold diferente (especificar en "Other").
X. Other (please specify)

[Answer]: A
