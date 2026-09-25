# Investigación adversarial (crítica) — Estudio

Este documento existe para atacar la idea, no para defenderla. Es la sección que el módulo marca como la más valiosa del proceso.

## 1. La crítica genérica de arte por IA ya está comoditizada — no es un riesgo futuro, ya pasó

La versión ingenua del producto ("sube tu dibujo, recibe una crítica de IA") ya existe, gratis o casi gratis, en múltiples formas:

- Al menos cuatro apps dedicadas hacen esto hoy: Coartist, ArtKritic, ArtCritic, y Rate My Art AI (ver `mercado.md` para detalle y fuentes).
- Un usuario documentó cómo, con un simple prompt de texto, logró que ChatGPT actuara como crítico de arte con escala de puntuación de 1 a 10, sin pagar nada ni instalar nada (fuente: [ChatGPT Art Critic](https://www.goodreads.com/author_blog_posts/24159524-chatgpt-art-critic?tab=book)).
- Existe un conector MCP gratuito ("draw it mcp") que agrega análisis de composición y técnica artística como función adicional de otra herramienta, sin costo dedicado (fuente: [Glama.ai](https://glama.ai/mcp/servers/Pandoll-AI/draw-it-mcp)).

**Implicación:** cualquier framing del producto centrado en "damos buena crítica de arte" está compitiendo contra herramientas gratuitas, y perdiendo por defecto. El PVB completo se reconstruyó para evitar depender de este punto.

## 2. El diferenciador propuesto (progreso medido en el tiempo) puede que ya esté siendo construido por el competidor más fuerte

Al revisar el material promocional de Coartist con esta pregunta específica en mente, ya mencionan funciones de seguimiento de consistencia diaria, calendarios de actividad, y comparación de puntuaciones técnicas en el tiempo (fuente: [MWM.ai, listado de Coartist](https://mwm.ai/apps/coartist-ai-art-feedback/6758355444)). Esto no es idéntico a "tendencia por categoría diagnóstica específica" (composición vs. anatomía vs. color por separado), pero la distancia es más pequeña de lo que sería cómodo admitir.

**Implicación:** la ventaja competitiva de la Sección 3 del PVB no es un foso permanente — es una ventaja de ejecución y de tiempo. Si Coartist decide invertir en categorización específica antes que nosotros, la ventaja se erosiona rápido.

## 3. Las comunidades objetivo tienen una corriente activa anti-IA

Existe un movimiento documentado de artistas que rechazan explícitamente herramientas de IA en sus comunidades. Un ejemplo notable: la comunidad detrás de Cara App se declara abiertamente anti-IA, negándose a alojar contenido generado por estas herramientas mientras no se resuelvan según ellos las preocupaciones éticas sobre los datos de entrenamiento (fuente: [Alex Jimenez Design, Medium](https://alexjimenezdesign.medium.com/artists-who-want-to-regulate-ai-are-wrong-e793e9bb8236)).

Una investigación académica sobre sentimiento de artistas hacia el arte generado por IA documenta desconfianza extendida hacia los desarrolladores de estas herramientas, particularmente en torno al uso no consentido de trabajo propio para entrenar modelos (fuente: [arXiv 2311.13725](https://arxiv.org/pdf/2311.13725)).

**Implicación directa para el segmento elegido (autodidactas en comunidades estructuradas tipo Drawabox):** el "veto de confianza" de este producto no es un ejecutivo — es la comunidad misma del usuario. Un producto percibido como "IA reemplazando el juicio humano" puede ser rechazado activamente, incluso si el usuario individual lo encuentra útil en privado.

**Mitigación adoptada en el PVB:** posicionar el producto explícitamente como complemento mientras se espera turno de crítica humana, nunca como sustituto — reflejado en las secciones 2, 5 y 9 del PVB.

## 4. El cuello de botella de crítica humana en cursos estructurados es real, pero también es un negocio con voluntad de mantenerse humano por diseño

Drawabox documenta que su programa de crítica oficial es intencionalmente subsidiado y limitado, y que la crítica comunitaria gratuita depende de la buena voluntad de otros estudiantes, no de un sistema garantizado (fuente: [Drawabox FAQ](https://drawabox.com/lesson/0/3/gettingfeedback)). Esto valida que el problema de capacidad existe — pero no hay que asumir que la comunidad recibiría con entusiasmo una solución de IA a ese cuello de botella; podría interpretarse como una amenaza al valor pedagógico del propio programa (la crítica humana estructurada es, en sí, parte del método de enseñanza de Drawabox).

**[VERIFICAR]** No se encontró una postura pública explícita de Drawabox sobre herramientas de IA de terceros usadas por sus estudiantes — es una laguna real de la investigación, no un hallazgo confirmado en ninguna dirección.

## 5. Riesgo económico no resuelto

El modelo de pricing (Sección 7 del PVB) asume una tasa de conversión free-to-paid que no ha sido validada con ningún dato propio — es una cifra de referencia genérica de la industria freemium, marcada explícitamente como [INTERNO] en el PVB. Si la conversión real es menor al estimado, el modelo de negocio completo queda en duda, independientemente de si el producto funciona bien técnicamente.

## Conclusión honesta

Este producto no gana por tecnología única — la tecnología (modelo de visión + prompt) es replicable por cualquiera con acceso a la misma API. Gana, si acaso, por: (1) construir la capa de progreso medido antes que el competidor más cercano, y (2) ganarse la confianza de un nicho que empieza escéptico de la IA por diseño, no por accidente.
