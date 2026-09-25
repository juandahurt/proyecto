# Product Vision Board

**Módulo 2 — AI & Agentic Engineering**

**Convención de evidencia usada en este documento:**
- **[INTERNO]** — proyección o supuesto propio del equipo (de este proyecto). Son estimaciones que hay que validar, no hechos.
- **[VERIFICAR]** — afirmación sobre el mundo exterior que aún no tiene fuente confirmada, marcada a propósito para no disfrazarla de dato verificado.

---

## PRODUCTO

**Nombre del producto:** Estudio

**Descripción en una línea:**
Plataforma que da retroalimentación técnica y paleta de color sobre dibujos y pinturas mediante IA, y mide si esa retroalimentación se traduce en mejora real a lo largo del tiempo — no solo un historial visual de subidas pasadas.

---

## 1. PROBLEMA

**Problema que resuelvo:**

Los artistas autodidactas que practican por su cuenta reciben retroalimentación puntual (de un chatbot, de una app de crítica, o de otro estudiante) pero nadie conecta esa retroalimentación en el tiempo. El resultado: repiten el mismo error semana tras semana sin darse cuenta de que es un patrón, porque cada crítica vive aislada de la anterior. Esto no es un problema de "generar una crítica" — eso ya está resuelto y comoditizado (ver `research/critica.md`) — es un problema de **falta de memoria estructurada sobre el propio progreso**.

**¿Este problema sobrevive a las próximas 2-3 generaciones de modelos foundation?**

[X] Sí, porque es un problema de WORKFLOW/INTEGRACIÓN, no de OUTPUT

Un modelo más inteligente genera una crítica puntual mejor, pero eso no resuelve el problema de fondo: nadie agrega esas críticas en el tiempo para decir "esto es un patrón real, no un comentario aislado". Esa agregación estructurada es trabajo de producto (data acumulada por usuario), no de capacidad del modelo. Cuanto mejor sea el modelo, de hecho, más ruido genera si no hay una capa que organice sus críticas en tendencias.

**Durability Score: 3/5**

No es 5/5: a diferencia de infraestructura crítica en producción, nada impide técnicamente que un competidor grande agregue esta misma feature en un sprint si decide que vale la pena (de hecho, ver riesgo 2 — puede que ya estén cerca). El moat no viene de que sea imposible de copiar, viene de ejecutarlo primero y acumular data por usuario antes que ellos.

---

## 2. SEGMENTO TARGET

**¿Para quién es este producto?**

Artistas autodidactas que practican dibujo o pintura de forma regular y estructurada (no quien dibuja una vez al mes por curiosidad), que ya buscan retroalimentación externa activamente pero no tienen acceso constante a un mentor humano.

Tres señales de que alguien está en este segmento:
1. Sigue algún tipo de rutina de práctica (curso estructurado, reto de dibujo diario/semanal, o plan propio de fundamentos).
2. Ya publica su trabajo buscando crítica en foros o comunidades (r/ArtCrit, r/drawing, servidores de Discord de arte).
3. Ya invierte dinero en su práctica (cursos online, apps de dibujo, suscripciones tipo Skillshare/Domestika).

**NO es para:** quien dibuja ocasionalmente sin buscar mejorar de forma medible, artistas profesionales que buscan feedback de dirección de arte (no de fundamentos), ni quien busca generar arte con IA.

**¿Quién controla el veto de confianza?**

No es un rol corporativo — es **la propia comunidad de práctica del artista** (su servidor de Discord, su grupo de crítica, sus compañeros de curso). Existe una corriente activa anti-IA en comunidades de arte (ver `research/critica.md`), incluyendo comunidades que rechazan explícitamente herramientas de IA. Un usuario puede amar el producto en privado y aun así dejar de usarlo, o esconder que lo usa, si su comunidad lo estigmatiza. Por eso el producto se posiciona como **complemento explícito, no reemplazo**, de la crítica humana.

---

## 3. VENTAJA COMPETITIVA PRIMARIA

[X] Data — Generamos data única que competidores no pueden comprar ni copiar

**¿Qué data única poseemos o podemos construir?**

No es la crítica individual — eso lo genera cualquier modelo de visión y ya está comoditizado. La data única es el **historial estructurado y etiquetado por categoría de cada usuario a lo largo del tiempo**: qué se le señaló, cuántas veces, en qué categoría (composición, anatomía, color, perspectiva), y si esa categoría mejoró o se estancó en las siguientes subidas.

Tres capas, de menor a mayor defensibilidad:

1. **Nivel usuario:** cada persona acumula su propia serie de tiempo de fortalezas y debilidades. Útil desde la primera semana, pero fácil de replicar por un competidor.
2. **Nivel agregado (con más usuarios):** con volumen, el sistema puede aprender qué patrones de retroalimentación realmente predicen mejora. Esto sí es data que un competidor no tiene aunque copie el producto mañana — necesita tiempo y volumen real para construirse.
3. **Honestidad de límite:** esta ventaja no existe el día 1. El MVP solo cubre la capa 1. La capa 2 es la visión a mediano plazo, no algo construible en el semestre — pero es la razón de ser del producto a futuro.

**Lo que esto NO es:** no competimos en "quién da mejor crítica de texto" — ahí ya se perdió contra la comoditización. Se compite en quién acumula, estructura y aprende de esa crítica en el tiempo.

---

## 4. ARENA COMPETITIVA

[X] Enhancer (AI-Enhanced) — Uso IA para fortalecer un proceso existente

No es Pioneer: la crítica de arte y la práctica estructurada existen hace siglos. Tampoco es realmente Disruptor: no se reimagina el workflow de conseguir feedback de forma radical (eso ya lo hicieron los competidores existentes con "sube y recibe crítica instantánea"). Lo que hace el producto es reforzar la práctica existente del artista con una capa de memoria y medición que hoy no existe, sin cambiar cómo la gente ya practica o busca crítica.

**¿Cómo sobrevives o complementas a los gigantes?**

1. **Apps de dibujo con distribución masiva (Procreate, Adobe Fresco/Firefly).** Si agregan "feedback de IA integrado" como feature nativa, tienen ventaja de distribución brutal. **[VERIFICAR: si alguno ya lo anunció o está en roadmap]**
2. **Asistentes de IA genéricos (ChatGPT, Claude).** Un prompt personalizado ya los convierte en "crítico de arte" gratis (ver `research/critica.md`). Se sobrevive porque no acumulan historial estructurado por categoría entre sesiones — cada conversación empieza de cero. Si agregan memoria persistente estructurada por dominio, esto se erosiona.
3. **Competidores directos ya existentes** (Coartist y similares, ver `research/mercado.md`). Tienen ventaja de usuarios ya operando. Se sobrevive si se construye la capa de "progreso medido" antes de que decidan copiarla — carrera de ejecución, no de tecnología única.

**Riesgo honesto:** ninguno de estos tres gigantes necesita tecnología nueva para competir directamente — solo necesitan decidir que vale la pena.

---

## 5. UX PARADIGM

[X] Assistant — El usuario está en control, la IA sugiere

El usuario decide qué sube, cuándo, y qué hace con la retroalimentación — la IA nunca actúa por su cuenta. Esto es la continuación directa de la Sección 2 (complemento, no reemplazo).

- **Agent** no aplica: no hay tareas que la IA deba ejecutar de forma autónoma.
- **Autonomous** rompería la confianza del segmento (ver riesgo anti-IA documentado).
- **Embedded Intelligence** tampoco encaja: el valor depende de que el usuario vea explícitamente su trayectoria de progreso.

**Matiz:** la capa de "aprendizaje agregado" (Sección 3, capa 2) sí introduce algo más cercano a Embedded Intelligence a nivel de sistema. Para el MVP, el paradigma dominante y visible al usuario es Assistant.

---

## 6. AI DECISION TRIANGLE

[X] Capability — Lo más inteligente/preciso posible

**Por qué no las otras dos:**
- **Cost** parecería obvio dado que el segmento es sensible al precio, pero optimizar por costo arriesgaría la categorización consistente que alimenta el historial de progreso — si es imprecisa, el dato acumulado se vuelve ruido y se pierde la ventaja competitiva completa.
- **Speed** no es crítico: el usuario puede esperar segundos o un minuto por una crítica de calidad sin abandonar la app.

**Trade-offs que acepto:**
- Sacrifico costo por usuario, pagando más por un modelo capaz de categorizar consistentemente.
- Sacrifico velocidad de respuesta moderadamente.
- Acepto presión sobre el margen (ver Sección 7) — hay que ser cuidadosos con los límites del nivel gratis.

---

## 7. MODELO ECONÓMICO

**Modelo de pricing:** [X] Freemium / Reverse Trial

Nivel gratis: análisis básico ilimitado (crítica + paleta), sin historial de tendencias. Nivel pago: desbloquea el seguimiento de progreso medido en el tiempo — la única capa que los competidores no tienen hoy.

**¿El pricing escala si tienes 10x usuarios?** [X] Sí

El costo marginal es por uso (llamadas a la API), no por asiento. El nivel gratis tiene límite de subidas mensuales para controlar el gasto en usuarios que nunca convierten.

**Costo estimado por usuario/mes: ~$0.30 [INTERNO]**

Con las tarifas actuales de la API de Claude (Sonnet 5, $2/$10 por millón de tokens de entrada/salida, tarifa introductoria vigente hasta el 31 de agosto de 2026 — fuente: benchlm.ai, verificado 14 de agosto de 2026) y considerando que una imagen de 1000×1000 px equivale a ~1,334 tokens (fuente: nicolalazzari.ai, marzo 2026), un análisis individual cuesta aproximadamente $0.02. Con ~8 subidas/mes por usuario activo: ~$0.16/mes en inferencia, más almacenamiento y margen de seguridad → ~$0.30/mes estimado.

*Nota de honestidad: esta tarifa sube a $3/$15 el 1 de septiembre de 2026 — el costo real podría subir ~50% después de esa fecha.*

**Revenue por usuario/mes: $4.99** (alineado con ArtKritic, competidor freemium más cercano — fuente: App Store, ver `research/mercado.md`)

**Gross margin proyectado: ~94%** (solo sobre usuarios de pago; depende completamente de la tasa de conversión free-to-paid, no validada)

| Concepto | Mensual |
|---|---|
| Inferencia | $0.20 |
| Almacenamiento | $0.05 |
| Soporte/infraestructura | $0.05 |
| **Costo total** | **$0.30** |
| **Revenue** | **$4.99** |
| **Gross margin** | **~94%** |

---

## 8. MÉTRICAS DE ÉXITO

**Métricas de usuario:**
1. **Tasa de conversión free-to-paid.** *Target: >5% al mes 3.* **[INTERNO]** — cifra de referencia genérica de la industria freemium, no validada con datos propios.
2. **Frecuencia de subida sostenida** (uploads/mes por usuario activo, en el tiempo). Sin esto no hay serie de tiempo que medir, y sin eso no hay ventaja competitiva. *Target: ≥3 subidas/mes sostenidas por 2 meses seguidos.* **[INTERNO]**

**Métricas específicas de IA:**
1. **Consistencia de categorización entre subidas similares.** *Target: >85%, validado manualmente contra una muestra.* **[INTERNO]**
2. **Tasa de acuerdo del usuario con la tendencia detectada.** *Target: >70%.* **[INTERNO]**

**Métrica de salud secundaria:** costo de inferencia real por usuario activo vs. lo proyectado en la Sección 7.

---

## 9. RIESGOS CRÍTICOS

**1. ¿Qué pasa si el problema desaparece en 12 meses por comoditización?**

Ya pasó parcialmente: la crítica genérica de arte por IA ya es gratis hoy (Coartist, ArtKritic, ArtCritic, Rate My Art AI, y cualquier chatbot genérico con el prompt correcto — ver `research/critica.md`). Por eso el PVB completo se reconstruyó alrededor de que el output nunca fue defendible.

*Mitigación:* si el "progreso medido" también se comoditiza, la única defensa que queda es la data acumulada por usuario — cuantos más meses de historial real, más costoso migrar a un competidor que empieza de cero.

**2. ¿Puede un competidor replicar tu producto con la misma API en menos de 6 semanas?**

Sí, y probablemente más rápido de lo que nos gustaría admitir. Coartist ya promociona seguimiento de consistencia diaria y calendarios de actividad para monitorear desarrollo técnico en el tiempo — la distancia entre lo que ellos ya tienen y lo que proponemos es más pequeña de lo ideal.

*Mitigación:* ejecutar primero y validar con usuarios reales antes de que un competidor con más presupuesto decida invertir en lo mismo.

**3. Si tienes éxito a escala, ¿cuál es la primera forma en que se rompe la confianza?**

1. **El usuario asume que sus imágenes se usan para entrenar modelos sin consentimiento.** Hay desconfianza documentada de artistas hacia desarrolladores de IA en este tema (ver `research/critica.md`). Un solo rumor en una comunidad de arte puede destruir la adopción completa en ese nicho.
   *Mitigación:* política de datos explícita y verificable — no se usan imágenes para entrenar modelos sin consentimiento.
2. **El posicionamiento de "complemento, no reemplazo" se rompe en la práctica.** Si el producto o su uso masivo empiezan a sugerir que ya no hace falta esperar crítica humana, se pierde la legitimidad que protege del rechazo anti-IA documentado en comunidades como Drawabox.
   *Mitigación:* mantenerlo explícito en el producto mismo, no solo en el discurso de marketing.

**Verdad incómoda:** este producto no compite en tecnología — compite en la confianza de un nicho ya escéptico de la IA, y en ejecutar más rápido que competidores que ya se acercan a nuestro diferenciador.

---

## Checklist de entrega

- [x] Producto seleccionado
- [x] Deep research de validación completado y estudiado (`research/overview.md`, `research/mercado.md`)
- [x] Deep research de crítica completado y estudiado (`research/critica.md`)
- [x] Investigación documentada en Markdown, con fuentes
- [x] Product Vision Board completado (este documento)
- [ ] `prd.md` co-creado a partir de este PVB
- [ ] Listo para presentar en sesión 3
