# PRD — Estudio

**Convención de evidencia usada en este documento:**
- **[INTERNO]** — proyección o supuesto propio del equipo. Estimaciones que hay que validar, no hechos.
- **[VERIFICAR]** — afirmación sobre el mundo exterior sin fuente confirmada, marcada a propósito para no disfrazarla de dato verificado.
- **TBD** — falta información. Se listan 2-3 opciones razonables donde aplica, en vez de inventar el dato.

---

## Paso 0 — Análisis de conflictos entre documentos

Antes de construir el PRD, se cruzaron los 5 documentos de `docs/` (`overview.md`, `mercado.md`, `critica.md`, `icp.md`, `pvb.md`) en busca de contradicciones, tensiones y vacíos.

| # | Tipo de conflicto | Doc A dice... | Doc B dice... | Decisión requerida / tomada |
|---|---|---|---|---|
| 1 | **Tensión validación vs. crítica (la más importante)** | PVB Sección 3 propone el historial estructurado por categoría como ventaja competitiva primaria, Durability Score 3/5 | `critica.md` #2: Coartist ya promociona seguimiento de consistencia diaria y comparación de puntuaciones en el tiempo — "la distancia es más pequeña de lo que sería cómodo admitir" | **Resuelto:** el diferenciador se trata en todo el PRD como ventaja de ejecución temporal, no como moat permanente (ver Principio 4, Segmento 6). |
| 2 | **Tensión validación vs. crítica** | PVB Secciones 2 y 9 mitigan el riesgo anti-IA con "complemento, no reemplazo" | `critica.md` #3-4: corriente activa anti-IA en la comunidad objetivo; el propio Drawabox depende de que la crítica humana sea el método pedagógico | **Resuelto:** "complemento, no reemplazo" se convirtió en restricción de producto verificable (onboarding con reconocimiento explícito, Principio 1, Segmento 6), no solo discurso de marketing. |
| 3 | **Riesgo económico no resuelto** | PVB Secciones 7-8: modelo económico completo con gross margin ~94% | `critica.md` #5: la tasa de conversión free-to-paid es [INTERNO], no validada con datos propios | **Resuelto:** todas las cifras de conversión se presentan marcadas [INTERNO] a lo largo del PRD (ver Segmento 10), nunca como hecho validado. |
| 4 | **Contradicción de cifras de mercado** | `overview.md`: $2.34B (2024) → $6.23B (2033), CAGR ~11.2% | `overview.md` (misma fuente, párrafo siguiente): $1.2B (2025) → $3.5B (2034) | **Resuelto:** ambas cifras se presentan como rango de orden de magnitud (Segmento 2), sin promediarlas ni elegir una. |
| 5 | **Posicionamiento de precio poco comparable** | PVB Sección 7: $4.99/mes "alineado con ArtKritic" | `mercado.md`: el $4.99/mes de ArtKritic es para quitar anuncios, no para desbloquear progreso | **Señalado, no resuelto en este PRD** — se mantiene como advertencia en Segmento 2 y 4; requiere decisión de negocio fuera de este documento. |
| 6 | **Supuesto incompatible: Capability vs. sensibilidad al precio** | PVB Sección 6: elige Capability sobre Cost | `icp.md`: el ICP es sensible al precio | **Resuelto como trade-off consciente:** documentado explícitamente en el Principio 2 (Segmento 6). |
| 7 | **Vacío crítico: arquitectura de IA no está en ningún doc de research** | PVB Sección 7 calcula costos asumiendo Claude Sonnet 5 vía API | Ningún otro documento menciona arquitectura técnica | **Resuelto por decisión del usuario:** Opción C (híbrida) — API externa para análisis de imagen, resto de la lógica como cargas de trabajo propias en Kubernetes (Segmento 9). |
| 8 | **Vacío crítico: no hay research primario de usuario** | `icp.md` presenta a "Ana" como buyer persona | Ninguna entrevista real respalda la persona | **Señalado como riesgo abierto** (riesgo #10, Segmento 12) — no resuelto, pendiente de validación con usuarios reales post-MVP. |
| 9 | **Vacío crítico: postura de Drawabox sobre IA de terceros** | `critica.md` marca [VERIFICAR] | — | **Sin resolver** — tratado como riesgo/vacío abierto, no como oportunidad asumida. |
| 10 | **Vacío crítico: nada de infraestructura/K8s en los docs de research** | Instrucción del usuario: producto en Kubernetes | Ningún doc de research/PVB cubre arquitectura técnica | **Resuelto progresivamente** en Segmentos 9 y 13 con opciones explícitas y una decisión tomada por el usuario (Opción C). |

---

## Segmento 1 — One-liner + Job to be Done

### One-liner de producto

> **Estudio da retroalimentación técnica sobre dibujos y pinturas mediante IA, y mide si esa retroalimentación se traduce en mejora real a lo largo del tiempo — no solo un historial visual de subidas pasadas.**

### Job to be Done

> **Cuando** practico dibujo o pintura de forma regular pero no tengo acceso constante a un mentor humano, y cada crítica que recibo —de un chatbot, una app o un compañero de curso— vive aislada de la anterior,
> **quiero** saber si mis errores se repiten como un patrón real a lo largo del tiempo,
> **para** confirmar si de verdad estoy mejorando, en vez de recibir la misma observación genérica una y otra vez sin poder actuar sobre ella.

### Misión del producto

> Estudio existe para resolver un problema de memoria estructurada sobre el progreso artístico, no un problema de calidad de crítica puntual —eso ya está resuelto y comoditizado por el mercado. La misión es acumular, categorizar y conectar en el tiempo la retroalimentación que el artista ya recibe, para que un patrón real se distinga de un comentario aislado. Todo esto como complemento explícito a la crítica humana, nunca como su reemplazo.

---

## Segmento 2 — Contexto y problema

### Dolores del mercado

El artista autodidacta que practica de forma regular enfrenta un cuello de botella de **capacidad humana**, no de falta de inteligencia disponible para generar crítica:

- Drawabox documenta públicamente que su retroalimentación comunitaria gratuita "no está garantizada, depende de la buena voluntad de otros estudiantes", y que su crítica oficial de pago (entre $5 y $10 USD por lección) es un precio subsidiado que ni siquiera cubre el costo real de los instructores (fuente: Drawabox FAQ).
- Como contraste, un servicio de crítica en video de un artista profesional individual se ofrece a $250 por pieza (fuente: Aaron Rutten) — ilustra el rango de precio que el mercado ya acepta pagar por feedback de calidad, aunque no es directamente comparable a un producto de software escalable.
- Dolor específico de Ana (`icp.md`): ya probó apps de crítica de IA gratuitas, pero "cada vez me dicen lo mismo distinto" — no logra percibir si está mejorando de verdad.

**Nota sobre tamaño de mercado [orden de magnitud, no cifra exacta]:**
- Business Research Insights: mercado global de cursos de arte online en $2.34B (2024) → $6.23B (2033), CAGR ~11.2%.
- Verified Market Reports: $1.2B (2025) → $3.5B (2034).

**[VERIFICAR]** Ninguna fuente desglosa el subsegmento específico de "herramientas de feedback asistido por IA" — categoría demasiado nueva para tener reporte propio.

### ¿Por qué ahora?

- El costo de inferencia de modelos de visión capaces de categorizar consistentemente ha bajado lo suficiente para que un análisis individual cueste centavos (~$0.02, PVB Sección 7), viabilizando un modelo freemium con volumen.
- La crítica de arte por IA genérica ya se comoditizó — la ventana para competir en "dar crítica" ya se cerró; la ventana para competir en "estructurar esa crítica en el tiempo" sigue abierta, pero se está cerrando rápido (Coartist ya se mueve en esa dirección).
- **TBD**: no hay evidencia de un catalizador externo específico. Opciones: (1) investigar si Procreate/Adobe Fresco anunciaron feedback IA nativo; (2) dejar la urgencia como puramente competitiva (ejecutar antes que Coartist); (3) investigar crecimiento de comunidades de práctica estructurada como proxy de demanda.

### Alternativas actuales y por qué no alcanzan

| Alternativa | Qué ofrece | Por qué no resuelve el problema |
|---|---|---|
| Comunidades online (Discord, r/ArtCrit) | Crítica humana gratuita | No garantizada; no acumula historial |
| Crítica oficial de cursos estructurados (Drawabox) | Crítica humana de calidad | Cuello de botella de capacidad; cara relativa al segmento; no conecta críticas en el tiempo |
| Apps dedicadas de crítica IA (Coartist, ArtKritic, ArtCritic, Rate My Art AI) | Crítica instantánea, algunas con seguimiento visual/puntaje | Ninguna mide tendencia por categoría diagnóstica específica; Coartist es la excepción más cercana |
| Asistentes genéricos (ChatGPT, Claude con prompt) | Crítica gratuita vía prompt | Sin memoria persistente entre sesiones |
| Conector MCP "draw it mcp" | Análisis de composición/técnica gratis como función adicional | Mismo problema: sin acumulación estructurada |

### Qué parte del problema ya está resuelta gratis

> **La generación de una crítica de arte por IA, en sí misma, ya está resuelta gratis.** No es una feature premium defendible. Al menos cuatro apps dedicadas la ofrecen hoy (Coartist, ArtKritic, ArtCritic, Rate My Art AI), un simple prompt de texto convierte a ChatGPT en crítico de arte funcional sin costo, y existe un conector MCP gratuito que agrega esta capacidad a otra herramienta sin costo dedicado.

> ⚠️ **Decisión crítica:** Estudio no puede posicionarse, ni siquiera implícitamente en copy de marketing o UI, como "el que da la mejor crítica". Cualquier mensaje que suene a eso compite y pierde contra herramientas gratuitas ya validadas en el mercado.

---

## Segmento 3 — ICP detallado

### Perfil y contexto de práctica

Producto B2C — no hay firmographics corporativos tradicionales:

| Dimensión | Descripción |
|---|---|
| Contexto de práctica | Individual, no equipos/organizaciones |
| Sector | No aplica en sentido corporativo; adyacente a educación artística informal |
| Geografía | **TBD** — opciones: (1) mercado angloparlante primero; (2) sin restricción geográfica, limitado por idioma de interfaz; (3) LATAM como entrada — ninguna respaldada por los docs |
| Madurez en la práctica | Principiante-intermedio con rutina activa |

### Buyer persona: "Ana, la autodidacta con rutina"

- 24 años, practica hace 18 meses siguiendo un curso estructurado de fundamentos.
- Publica semanalmente en Discord buscando crítica.
- Ya paga por al menos una suscripción relacionada con su práctica.
- Escéptica del uso de IA en arte, pero abierta a usarla como apoyo mientras espera turno de crítica humana — no como sustituto.

### Veto de confianza

> ⚠️ **Decisión crítica:** el veto no lo ejerce un rol corporativo, sino **la comunidad de práctica del usuario** (su Discord, su grupo de crítica). Un usuario puede amar el producto en privado y aun así abandonarlo —o esconder que lo usa— si su comunidad lo estigmatiza.

Respaldado por `critica.md` #3: corriente activa anti-IA documentada (ej. comunidad de Cara App) y desconfianza académica de artistas hacia desarrolladores de IA por uso no consentido de su trabajo para entrenar modelos.

### Señales de encaje y descarte

**Encaje:** (1) sigue una rutina de práctica; (2) ya publica buscando crítica en comunidades; (3) ya invierte dinero en su práctica.

**Descarte:** dibuja ocasionalmente sin buscar mejora medible; artista profesional con portafolio formado buscando dirección de arte; busca generar arte con IA.

### Pains

| Pain | Evidencia |
|---|---|
| La crítica vive aislada, sin conexión con la anterior | `pvb.md` Sección 1 |
| "Cada vez me dicen lo mismo distinto" | `icp.md`, cita de Ana |
| Depende de la buena voluntad de otros para crítica gratuita | `overview.md`, Drawabox FAQ |
| Crítica humana de calidad es cara relativa a su presupuesto | `overview.md`, Drawabox vs. Aaron Rutten |
| Escéptica de la IA en arte, pero necesita feedback frecuente | `icp.md`, `critica.md` #3 |

### Triggers de compra

**TBD** — opciones: (1) trigger de volumen (límite de subidas alcanzado); (2) trigger de insight (teaser de tendencia bloqueada); (3) trigger temporal (oferta activa tras N semanas de uso consistente). Cualquiera debe respetar el Principio 2 (Segmento 6): el nivel gratis no puede degradar consistencia para forzar conversión.

### Objeciones probables y respuestas

| Objeción | Respuesta |
|---|---|
| "Esto ya lo hace ChatGPT gratis" | Cierto para la crítica puntual. La diferencia es que ChatGPT no recuerda tu subida de hace 2 meses; Estudio sí. |
| "¿Van a usar mis dibujos para entrenar sus modelos?" | Política de datos explícita y verificable (Principio 3, Segmento 6), no solo respuesta de copy. |
| "Mi comunidad ve mal usar IA para esto" | Posicionamiento verificable de apoyo mientras se espera crítica humana (Principio 1, Segmento 6). |
| "¿Por qué pagar si Coartist ya hace seguimiento de progreso?" | Sin respuesta cómoda: la distancia es menor de lo ideal (`critica.md` #2). Hoy la respuesta es ejecución y granularidad, no un foso definitivo. |

---

## Segmento 4 — Propuesta de valor única y diferenciadores

### Qué problema resuelve, para quién, cómo

**Para** artistas autodidactas que practican de forma regular y estructurada, sin acceso constante a un mentor humano, **Estudio resuelve** la falta de memoria estructurada sobre su propio progreso **mediante** un sistema que categoriza cada retroalimentación y detecta si esa categoría mejora o se estanca a lo largo de subidas sucesivas.

### Diferenciación frente a competidores

| Competidor | Qué ofrece hoy | Qué NO ofrece (brecha de Estudio) |
|---|---|---|
| Coartist | Crítica en 5 pilares + seguimiento de progreso (calendarios, rachas, puntuación en el tiempo) | No mide tendencia por categoría diagnóstica específica — brecha más estrecha de todas |
| ArtKritic, ArtCritic, Rate My Art AI | Crítica puntual, algunas con portafolio/tonos | Sin seguimiento de tendencia en el tiempo |
| ChatGPT / Claude con prompt genérico | Crítica gratuita | Sin memoria persistente entre sesiones |
| Conector MCP "draw it mcp" | Análisis básico gratis | Sin acumulación estructurada |

> ⚠️ **Decisión crítica:** la brecha frente a Coartist es de granularidad y ejecución, no de categoría inexistente. No se presenta como océano azul.

### Qué brecha real llena

Granularidad y honestidad de ejecución: nadie —ni siquiera Coartist hoy— conecta explícitamente "esta categoría específica no mejora" con una serie de tiempo por categoría diagnóstica.

**[VERIFICAR]** No se encontró evidencia de integración de competidores con currículos estructurados (Drawabox u otros) — posible brecha de nicho, no confirmada como vacía.

### Matriz de posicionamiento 2x2

Ejes: **Profundidad de seguimiento temporal** (ninguno → tendencia por categoría específica) vs. **Especialización en fundamentos** (genérico → especializado). Coartist se ubica cerca de Estudio en el cuadrante superior, reflejando honestamente la advertencia de `critica.md` #2. Los demás competidores (ArtKritic, ArtCritic, Rate My Art AI, ChatGPT, draw it mcp) se ubican en cuadrantes de menor seguimiento temporal.

---

## Segmento 5 — Casos de uso (top 5)

### 1. Subida y crítica individual
- **Actor:** Ana (cualquier nivel). **Trigger:** termina un dibujo de práctica.
- **Pasos:** sube imagen → confirma contexto → recibe crítica categorizada → revisa por categoría → decide qué hacer con la retroalimentación.
- **Resultado:** crítica estructurada y categorizada, lista para compararse con subidas futuras. **KPI:** frecuencia de subida sostenida.

### 2. Detección de tendencia por categoría
- **Actor:** Ana (nivel pago). **Trigger:** historial suficiente acumulado (ej. 4+ semanas).
- **Pasos:** el sistema compara categorías actuales vs. historial → detecta mejora/estancamiento/empeoramiento → presenta la tendencia explícita → Ana ajusta su práctica.
- **Resultado:** Ana confirma o descarta si un patrón es real. **KPI:** tasa de acuerdo del usuario con la tendencia detectada.
- > ⚠️ Solo tiene valor con historial acumulado. **TBD:** umbral mínimo de subidas para tendencia confiable — propuesto: mínimo 4 subidas, sujeto a validación empírica.

### 3. Onboarding con contexto de comunidad
- **Actor:** Ana (usuario nuevo). **Trigger:** primera apertura de la app.
- **Pasos:** se presenta como complemento no sustituto → pregunta opcional sobre comunidad/curso de referencia → explica que el valor crece con el tiempo → primera subida con expectativas correctas.
- **Resultado:** previene abandono por desalineación de expectativas o estigma comunitario. **KPI:** retención temprana.

### 4. Actualización de límite del nivel gratis → conversión
- **Actor:** Ana (nivel gratis cerca del límite). **Trigger:** límite de subidas alcanzado o teaser de tendencia bloqueada.
- **Pasos:** notificación de límite/teaser → adelanto no específico de tendencia existente → Ana decide actualizar → desbloquea historial completo.
- **Resultado:** conversión basada en valor percibido, no presión artificial. **KPI:** tasa de conversión free-to-paid.
- > ⚠️ No debe degradar consistencia de categorización en nivel gratis para forzar conversión (Principio 2).

### 5. Revisión de política de datos / consentimiento
- **Actor:** Ana (cualquier momento). **Trigger:** duda sobre uso de sus imágenes para entrenar modelos.
- **Pasos:** accede a configuración → ve política explícita de no-entrenamiento sin consentimiento → puede solicitar eliminación de historial → confirmación de la acción.
- **Resultado:** mantiene/recupera confianza sin depender solo de marketing. **TBD:** posible KPI de confianza/transparencia a definir.

---

## Segmento 6 — Principios de diseño no negociables

### Principio 1 — Complemento, nunca reemplazo de la crítica humana
**(a)** El producto no puede posicionarse como sustituto de la crítica humana. **(b)** Onboarding explícito (caso de uso 3) con reconocimiento de un tap antes de la primera subida. **(c)** Prohibido: copy o features que impliquen sustitución; notificaciones que compitan contra el hábito de publicar en comunidades.
> ⚠️ Mecanismo verificable propuesto, no promesa de marketing — pero su efectividad real no está validada (**TBD**).

### Principio 2 — Consistencia de categorización sobre costo o velocidad
**(a)** Ninguna decisión de negocio puede degradar la consistencia de categorización. **(b)** El nivel gratis limita cantidad, nunca calidad del modelo. **(c)** Prohibido: modelo degradado para usuarios gratis; cualquier optimización de costo que introduzca variabilidad.

### Principio 3 — Los datos del usuario no entrenan modelos sin consentimiento explícito
**(a)** Las imágenes no se usan para entrenar/afinar modelos sin consentimiento explícito separado. **(b)** Política visible, verificable, con opción de eliminar historial. **(c)** Prohibido: consentimiento implícito enterrado en términos genéricos; uso de imágenes para entrenamiento por default.

### Principio 4 — Honestidad sobre el límite del moat
**(a)** No presentar "progreso medido en el tiempo" como foso permanente. **(b)** Todo material de producto reconoce que la ventaja es de ejecución y acumulación de datos (Durability Score 3/5). **(c)** Prohibido: lenguaje de "nadie más puede hacer esto".

### Principio 5 — Límite de autonomía de la IA
**(a)** Paradigma Assistant, no Agent — la IA nunca actúa autónomamente. Estudio no tiene agentes que actúen sobre infraestructura; el límite relevante es sobre el contenido del usuario. **(b)** La IA nunca modifica, elimina o republica el trabajo del usuario, ni decide en su nombre. **(c)** Prohibido (verificable): cero acciones automáticas de modificación/borrado/republicación de imágenes o críticas sin un clic/tap explícito del usuario en esa misma sesión.
> ⚠️ **Nota de arquitectura:** si en el futuro se agrega un componente agéntico que administre recursos de Kubernetes, requeriría un principio adicional — hoy no existe esa capa.

---

## Segmento 7 — User journeys

### 1. Happy path del usuario final
Ana termina un ejercicio → sube la imagen → confirma contexto → recibe crítica categorizada → revisa por categoría → ve tendencia (si tiene historial e nivel pago) → decide su siguiente paso de práctica → continúa su rutina.

### 2. Happy path del operador/administrador
El equipo despliega una nueva versión del pipeline vía GitOps → valida contra el dataset de evaluación antes de promover → monitorea costo real vs. proyectado, tasa de error, latencia → revierte si la consistencia cae bajo el umbral → revisa periódicamente una muestra de críticas.
**TBD:** journey construido por inferencia, no de un documento específico — validar cuando se defina la arquitectura exacta.

### 3. Edge case — flujo interrumpido o abandono
Ana cierra la app a mitad de proceso → el sistema conserva la imagen y el estado pendiente → al volver ve la crítica lista o el estado de procesamiento → si falló, mensaje claro con opción de reintentar → si abandona antes de revisar, la crítica queda disponible en su historial.

### 4. Edge case — el sistema no puede resolver la tarea
> ⚠️ Estudio no tiene agentes multi-paso ni soporte humano en tiempo real (decisión tomada: fuera de alcance del MVP). "No poder resolver" significa baja confianza en la categorización de una imagen específica.

Ana sube una imagen que el sistema no puede analizar con confianza suficiente → el sistema no presenta una crítica de baja confianza como si fuera normal → comunica explícitamente que no pudo generar una crítica confiable y por qué → ofrece reintentar con ajustes → esa imagen no se incluye en el cálculo de tendencia.

---

## Segmento 8 — Alcance del MVP (MoSCoW)

### Must have
- Subida de imagen + crítica categorizada individual
- Categorización consistente por categoría diagnóstica
- Historial acumulado por usuario
- Detección de tendencia por categoría en el tiempo
- Modelo freemium con límite de subidas en nivel gratis
- Onboarding con posicionamiento "complemento, no reemplazo"
- Política de datos visible + no uso de imágenes para entrenar sin consentimiento
- Manejo explícito de baja confianza en categorización

### Should have
- Teaser de tendencia bloqueada como trigger de conversión
- Selección/confirmación de contexto de la pieza
- Opción de eliminar historial de imágenes (autoservicio)

### Could have
- Integración/referencia a currículos estructurados (Drawabox u otros)
- Nivel agregado de aprendizaje entre usuarios (capa 2, PVB: "no construible en el semestre")
- Comparación de progreso con otros usuarios anónimos

### Won't have
- **Canal de soporte humano en tiempo real** — decisión tomada explícitamente en esta conversación; sin respaldo en research, no necesario para validar la propuesta central.
- Cualquier feature generativa (crear/editar arte con IA) — señal de descarte explícita del ICP.
- Feature social/de compartir con comunidades — sin respaldo documental.
- Auto-hospedaje de modelo de visión propio — descartado al resolver conflicto #7 con la Opción C (Segmento 9).

### Restricción real del semestre
MVP construible en lo que queda del semestre, desplegable en Kubernetes en el módulo 8. Complejidad principal: arquitectura de inferencia (resuelta: Opción C) y garantizar consistencia de categorización desde el día 1.

---

## Segmento 9 — Especificación funcional: módulos y features

### Decisión de arquitectura (conflicto #7 — resuelto)

**Opción C adoptada:** API externa de visión para el análisis de imagen (preserva el cálculo de costos del PVB Sección 7); el resto de la lógica (agregación de tendencias, autenticación, almacenamiento, orquestación) corre como cargas de trabajo propias en Kubernetes.

### Módulos funcionales

**1. Módulo de ingesta y análisis de imagen** — recepción de subida, validación de formato, envío a API de visión externa, almacenamiento de crítica categorizada, manejo de baja confianza. Solo el propio usuario ve sus imágenes.

**2. Módulo de historial y detección de tendencias** — almacenamiento estructurado por categoría/usuario, cálculo de tendencia, exclusión de subidas de baja confianza. Nivel gratis ve historial limitado; nivel pago ve tendencia completa.

**3. Módulo de cuentas y suscripción** — registro/login, gestión de nivel gratis vs. pago, límite de subidas, upgrade.

**4. Módulo de confianza y datos** — política de datos visible, opción de eliminar historial, onboarding de posicionamiento.

### Qué corre en Kubernetes vs. servicios externos

**En Kubernetes:** API gateway, servicio de ingesta y análisis, servicio de historial y tendencias, servicio de cuentas y suscripción, base de datos y almacenamiento de imágenes, servicio de confianza y datos.

**Servicios externos:** API de visión para análisis de imagen; proveedor de pagos (**TBD** — no especificado en ningún documento).

*(Ver diagrama de arquitectura funcional presentado durante la co-creación del Segmento 9.)*

---

## Segmento 10 — Métricas de éxito

### North Star
**Subidas activas con historial de tendencia visible por usuario pagante, por mes.**

### KPIs de activación, retención y calidad

| KPI | Baseline | Meta |
|---|---|---|
| Frecuencia de subida sostenida | No hay | ≥3 subidas/mes sostenidas por 2 meses **[INTERNO]** |
| Tasa de conversión free-to-paid | No hay | >5% al mes 3 **[INTERNO]**, no validada con datos propios |
| Consistencia de categorización | No hay | >85%, validado manualmente **[INTERNO]** |
| Tasa de acuerdo con tendencia detectada | No hay | >70% **[INTERNO]** |

### Métricas específicas de IA
- Precisión de categorización — **TBD**, se valida contra dataset de evaluación (Segmento 11).
- Utilidad percibida — **TBD**, medible con thumbs up/down.
- Seguridad / ausencia de daño — **TBD**, se define junto con red-teaming (Segmento 11).

### Métrica de fallo por ruido (obligatoria)
**Tasa de ignorancia de crítica:** % de críticas generadas que el usuario nunca abre o no interactúa dentro de una ventana de tiempo definida. Detecta si el sistema produce output de baja calidad al que el usuario deja de prestar atención.
> ⚠️ Debe monitorearse desde el primer sprint del MVP.

---

## Segmento 11 — Plan de evaluación de la IA

### Dataset inicial
**TBD** — opciones: (1) dataset propio curado (50-100 imágenes etiquetadas manualmente); (2) dataset semi-público de ejercicios estructurados tipo Drawabox **[VERIFICAR licencia]**; (3) dataset sintético con variaciones controladas.

### Criterios de calidad
Factualidad, adherencia a instrucciones, relevancia, y consistencia entre subidas similares (>85%, métrica ya definida en Segmento 10 — el criterio prioritario).

### Cómo se revisan los outputs
**TBD** — propuesto: revisión manual de muestra semanal (5-10%) + revisión dirigida por señales de thumbs-down.

### Red-teaming: escenarios adversariales
El único vector de terceros es la imagen subida por el propio usuario. Escenarios a probar: (1) inyección visual de instrucciones incrustadas en la imagen; (2) imágenes fuera de dominio; (3) contenido inapropiado o dañino; (4) manipulación para obtener output que fomente prácticas de dibujo lesivas.

---

## Segmento 12 — Riesgos y mitigaciones

| # | Riesgo | Categoría | Probabilidad | Impacto | Mitigación |
|---|---|---|---|---|---|
| 1 | Comoditización: crítica de IA ya es gratis hoy | Mercado | Alta (ya ocurrió) | Alto | Nunca competir en calidad de crítica puntual; enfoque en historial y tendencia |
| 2 | Coartist ya construye el mismo diferenciador | Producto/Mercado | Media-alta | Alto | Ejecutar primero, acumular historial antes que el competidor invierta en granularidad |
| 3 | La IA produce salida equivocada aprobada por confianza | Producto/IA | Media | Alto | Categorización como señal a considerar, no veredicto; opción de desacuerdo del usuario |
| 4 | Rechazo de la comunidad de práctica hacia IA | Producto/Mercado | Media-alta | Alto | Posicionamiento verificable de complemento (Principio 1) |
| 5 | Uso no consentido de imágenes para entrenar modelos | Legal/Confianza | Media | Alto | Política de datos explícita y verificable (Principio 3) |
| 6 | Conversión free-to-paid real menor a la proyectada | Modelo económico | Media-alta | Alto | Monitorear desde el mes 1; plan de ajuste de pricing/trigger listo |
| 7 | Aumento ~50% de tarifa de inferencia en sept. 2026 | Técnico/Económico | Alta (confirmado) | Medio | Recalcular margen antes de fijar pricing final; monitorear costo real |
| 8 | Dependencia de proveedor externo de IA | Técnico | Media | Alto | Abstracción de la llamada externa; monitoreo de disponibilidad |
| 9 | Imágenes fuera de dominio o con contenido inapropiado | Seguridad/Producto | Media | Medio-alto | Manejo explícito de baja confianza; rechazo claro previo a generar crítica |
| 10 | Falta de research primario de usuario (persona sintética) | Producto | Media-alta | Medio-alto | Validar supuestos clave con usuarios reales apenas el MVP tenga primeros usuarios |

---

## Segmento 13 — Plan de entrega alineado al curso

**Módulos 4-5 (K8s y CKA):** se construyen los componentes internos del clúster (API gateway, servicios funcionales, base de datos) como Deployments/Services básicos; se valida configuración de clúster y comunicación interna. **TBD:** proveedor de clúster y tamaño de nodos.

**Módulo 6 (CKAD):** se despliegan los 4 módulos funcionales como aplicaciones empaquetadas; integración real con la API de visión externa vía Secrets; primera versión funcional del flujo completo (aún sin tendencia madura).

**Módulo 7 (CKS):** se asegura el manejo de Secrets de credenciales externas, NetworkPolicies entre servicios internos, RBAC de plataforma, escaneo de imágenes — con conexión directa al Principio 3 y riesgo #5 (protección de datos de usuario).

**Módulo 8 (producción):** GitOps con validación pre-producción contra el dataset de evaluación antes de promover una nueva versión del pipeline; quedan corriendo y midiéndose la North Star, los KPIs, la métrica de fallo por ruido (activa desde el primer sprint), y el costo de inferencia real vs. proyectado.

**Sesión 16 (sustentación):** se demuestra el flujo completo corriendo en el clúster desplegado, un ejemplo real de detección de tendencia con datos acumulados durante el desarrollo, evidencia de que los principios no negociables se implementaron de forma verificable (no solo descritos), y honestidad explícita sobre limitaciones conocidas: Durability Score 3/5, cercanía de Coartist, y falta de validación con usuarios reales.

---

## Checklist de entrega

- [x] Análisis de conflictos (Paso 0) completado
- [x] Segmentos 1-13 co-creados y aprobados
- [x] PRD consolidado en `specs/prd.md`
- [ ] Validación de supuestos clave con usuarios reales (riesgo #10, pendiente post-MVP)
- [ ] Decisión de proveedor de pagos y de clúster (TBD, Segmentos 9 y 13)
- [ ] Listo para presentar en sesión 3
