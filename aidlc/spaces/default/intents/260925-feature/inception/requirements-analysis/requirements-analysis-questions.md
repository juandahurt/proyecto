## Sources

- [scope] scope-document.md
- [backlog] intent-backlog.md
- [dec-log] decision-log.md
- [constraints] constraint-register.md

---

## Q1. Taxonomía de categorías de la crítica IA

Esta es la decisión más crítica de toda la especificación: define qué mide el sistema y cómo calcula las tendencias. ¿Qué categorías diagnósticas usa Estudio para evaluar un dibujo?

A. Conjunto mínimo de 5 categorías: Composición, Proporciones, Calidad de línea, Valores (luces/sombras), Perspectiva.
B. Conjunto expandido de 7 categorías: las 5 anteriores + Color (si aplica a la pieza) + Anatomía (si hay figuras humanas o animales).
C. Conjunto flexible: definir las 5 categorías base; la IA puede añadir hasta 2 categorías adicionales según el tipo de pieza.
D. Definir el conjunto exacto junto con el diseño funcional — solo necesito saber ahora que hay un conjunto fijo (no dinámico).
X. Other (please specify — indicar exactamente cuáles categorías)

[Answer]: A

---

## Q2. Límite de subidas del nivel gratuito

¿Cuántas subidas por mes tiene el usuario en el nivel gratuito antes de necesitar actualizar?

A. 5 subidas/mes — límite conservador; fuerza conversión rápida.
B. 10 subidas/mes — permite acumular suficiente historial para ver una tendencia antes de pagar.
C. 15 subidas/mes — umbral más generoso; reduce fricción de adopción.
D. Ilimitado en el nivel gratuito, pero el historial de tendencias visible se limita a las últimas 4 subidas — la actualización desbloquea el historial completo.
X. Other (please specify)

[Answer]: B

---

## Q3. Algoritmo de detección de tendencia

¿Cómo calcula el sistema si una categoría mejora, se estanca o empeora a lo largo del tiempo?

A. Regresión lineal simple — ajusta una línea a los últimos N scores; la pendiente determina la dirección.
B. Promedio móvil — compara el promedio de los últimos K scores con el promedio de los K anteriores.
C. Umbral de varianza — la tendencia mejora si al menos 3 de los últimos 4 scores superan el promedio histórico.
D. Decidir en Diseño Funcional — solo necesito afirmar ahora que el algoritmo es configurable y documentado, sin elegir cuál.
X. Other (please specify)

[Answer]: A

---

## Q4. Umbral de baja confianza de la IA

Si la API de Claude no está segura de su categorización (respuesta vaga, imagen ambigua, o la imagen no es un dibujo de arte), ¿qué umbral activa el flujo de baja confianza?

A. La IA devuelve una flag de confianza explícita en su respuesta — si está por debajo de un umbral a definir, se activa el flujo de fallback.
B. No hay flag de confianza de la API — el sistema detecta baja confianza si la respuesta no cumple con el schema de categorías esperado (categorías faltantes, scores fuera de rango, texto vacío).
C. El prompt de la IA incluye una instrucción de auto-evaluación — si la IA indica "no puedo evaluar esta imagen con suficiente certeza", se activa el fallback.
D. Combinación de B y C — validar schema + instrucción de auto-evaluación en el prompt.
X. Other (please specify)

[Answer]: A

---

## Q5. Período del límite de subidas gratuitas

¿El contador de subidas gratuitas se renueva mensualmente o semanalmente?

A. Mensualmente — el contador se reinicia el 1° de cada mes.
B. Mensualmente desde la fecha de registro — el contador se reinicia en el aniversario mensual del registro del usuario.
C. Semanalmente — 7 días de ventana deslizante.
D. No hay período fijo — el límite es sobre el total acumulado de subidas (compras adicionales desbloquean más subidas).
X. Other (please specify)

[Answer]: A

---

## Consolidated Summary Confirmation

Does this all look correct before I generate the artifact?

- Looks correct
- Request changes

[Answer]: Looks correct
