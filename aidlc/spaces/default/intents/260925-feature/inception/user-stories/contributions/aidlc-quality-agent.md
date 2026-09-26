**Collaborator:** aidlc-quality-agent

## Contribution

### OBS-1 — Cobertura general de las 13 historias: satisfactoria, con un hueco en US-4

Las 13 historias cuentan con al menos un AC en formato GWT que es testeable. Sin embargo, US-4 presenta una debilidad estructural: AC-4.2 ("images are never transmitted to any model training endpoint") es un AC de ausencia de comportamiento. No existe ninguna assertion automatizable que confirme, desde el exterior del sistema, que no se realiza una llamada a un endpoint de entrenamiento. En pruebas de integración solo es posible verificar negativamente mediante mocks/intercepcion de trafico saliente, lo que requiere una decision de arquitectura de test explícita (por ejemplo, spy sobre el cliente HTTP interno). Se recomienda añadir un AC complementario que especifique el comportamiento observable: "the critique service makes exactly one outbound HTTPS call per upload, only to the Anthropic API domain, verifiable via integration-level HTTP stub".

### OBS-2 — Ausencia de casos negativos clave en US-1, US-8 y US-9

Tres historias carecen de ACs de ruta negativa relevantes:

- **US-1**: no hay AC para el caso en que el usuario sube un archivo valido de formato correcto pero con contenido corrupto (bytes validos de cabecera JPEG pero cuerpo truncado). FR-1.3 exige validacion del magic number, pero el comportamiento del sistema ante un JPEG mal formado despues de pasar la validacion de cabecera no esta especificado. Este escenario es frecuente en uploads con conexiones interrumpidas.
- **US-8**: AC-8.3 cubre password incorrecto, pero no hay AC para: (a) intento de registro con email ya existente, (b) intento de registro con password de 7 caracteres (justo por debajo del limite), ni (c) uso de un JWT expirado para acceder a un endpoint protegido. Estos tres son casos de automatizacion directa desde FR-8.
- **US-9**: AC-9.2 cubre el bloqueo cuando el contador llega a 0, pero no hay AC para el intento de subida via API directa cuando el contador es 0 (bypass del UI). FR-9.2 especifica que el endpoint retorna 402, pero no hay un AC de usuario que lo trace hasta la historia.

### OBS-3 — AC-13.2 no es suficientemente especifico para automatizar la eliminacion permanente de blob storage

AC-13.2 lista cinco condiciones Then ("all images removed from blob storage", "critique records deleted from DB", "trend calculations deleted", "history shows 0 critiques", "cannot be undone"), pero no define:

1. El metodo de verificacion: un test automatizado no puede inspeccionar directamente el bucket de blob storage a menos que el entorno de test lo exponga. El AC deberia especificar que el intento de acceso a la URL previa del blob retorna 404 o 403 como assertion observable.
2. La atomicidad de la operacion: si la eliminacion del blob falla pero los registros de DB se borran correctamente (o viceversa), el AC no define el estado esperado ni el comportamiento de reintento. Esto es critico para automatizacion de tests de integracion que simulan fallos parciales.
3. El plazo: "cannot be undone" no es una condicion testeable directamente. Deberia reformularse como "a GET request to the user's history endpoint immediately after deletion returns an empty list" y "a GET request for any previously stored image URL returns 404".

Recomendacion: descomponer AC-13.2 en tres ACs separados: (a) eliminacion de blobs verificable via HTTP 404, (b) eliminacion de registros de DB verificable via API de historial, (c) eliminacion transaccional con comportamiento definido ante fallo parcial.

### OBS-4 — Brecha de condicion de frontera en US-6: exactamente 4 uploads y slopes en ±2

AC-6.1 usa el ejemplo [54, 58, 65, 72] con slope positivo claro (~6 puntos/upload), que no prueba la frontera. Los siguientes casos de frontera no estan cubiertos por ningun AC:

- **Exactamente 4 uploads**: AC-6.1 prueba el caso minimo de 4 uploads (correcto), pero no especifica qué ocurre cuando el usuario tiene exactamente 4 uploads en una categoria y el 4o es low-confidence. Segun FR-6.1 y AC-6.3, ese upload se excluye, dejando 3 qualified — lo que deberia producir "Not enough data". Este escenario de transicion (4 uploads → 3 qualified por exclusion) no tiene AC.
- **Slope exactamente en +2.0 o -2.0**: FR-6.2 define los umbrales como `> +2` (improving) y `< -2` (worsening), con `[-2, +2]` = stagnating. El comportamiento con slope exactamente igual a +2.0 o -2.0 no esta cubierto. Dependiendo de la implementacion (comparacion estricta vs. no estricta), el resultado puede ser "Improving" o "Stagnating". Este es un caso clasico de off-by-one en comparaciones de punto flotante. Se recomienda añadir AC explícito para slope = +2.0 y slope = -2.0 con resultado esperado "Stagnating" (dado que FR-6.2 usa `>` y `<` estrictos).
- **Slope calculado con todos los uploads con el mismo score**: por ejemplo [60, 60, 60, 60] produce slope = 0, que cae en stagnating. Este caso no esta documentado pero es facilmente automatizable y prueba el comportamiento del algoritmo de regresion con varianza cero.

### OBS-5 — ACs mas dificiles de automatizar: AC-4.2, AC-2.1 (SLA), y AC-9.3 (reset de contador)

- **AC-4.2 (no training)**: como se indica en OBS-1, verificar la ausencia de una llamada saliente requiere infraestructura de test adicional (HTTP proxy o spy de cliente). No es automatizable con tests unitarios estandar; requiere un test de integracion con stub de red.
- **AC-2.1 (< 30 segundos end-to-end)**: el SLA de 30 segundos es un NFR (NFR-2) embebido en un AC funcional. Automatizar este threshold en CI es posible pero fragil: en entornos de CI con recursos compartidos, el tiempo de respuesta del Claude API mockeado puede no representar condiciones reales. Este AC necesita una estrategia de test de performance separada con un entorno dedicado, no un assertion de tiempo en el test funcional.
- **AC-9.3 (reset del contador el dia 1 del mes)**: este AC depende del tiempo de sistema. Automatizarlo de forma fiable requiere control del reloj en el entorno de test (time-mocking a nivel de servicio) o un job programado que sea testeable. Sin esa capacidad, el test seria un test de integracion dependiente de tiempo real, ejecutable solo en condiciones especificas, lo que lo hace inadecuado para CI ordinario.

---

## Positions

- **US-1 / AC-1.1, AC-1.2, AC-1.3**: AGREE — los tres ACs son testables y cubren formatos invalidos y tamaño excesivo. OBJECT: falta AC para archivo con magic number valido pero cuerpo corrupto (ver OBS-2).
- **US-2 / AC-2.1**: AGREE en la cobertura funcional. OBJECT: el threshold de 30 segundos en un AC funcional es un NFR disfrazado; deberia separarse o referenciarse a NFR-2 explicitamente para evitar tests de CI inestables (ver OBS-5).
- **US-2 / AC-2.2**: AGREE — el caso de imagen sin perspectiva es un escenario de edge case valido y testeable.
- **US-3 / AC-3.1, AC-3.2, AC-3.3**: AGREE — la exclusion del trend y el consumo del cupo estan bien especificados y son automatizables.
- **US-4 / AC-4.1**: AGREE — testeable como test de autorizacion HTTP (403 desde otra cuenta).
- **US-4 / AC-4.2**: OBJECT — no es automatizable sin infraestructura adicional de intercepcion de red; requiere refinamiento (ver OBS-1 y OBS-5).
- **US-5 / AC-5.1, AC-5.2**: AGREE — cobertura adecuada para el tier free y la representacion de uploads low-confidence.
- **US-6 / AC-6.1**: AGREE en el happy path. OBJECT: el ejemplo de slope claro no prueba la frontera ±2; faltan casos de frontera (ver OBS-4).
- **US-6 / AC-6.2, AC-6.3**: AGREE — "Not enough data" y exclusion de low-confidence estan bien especificados.
- **US-7 / AC-7.1, AC-7.2**: AGREE — la distincion tier-free vs. tier-paid en la API es testeable con dos fixtures de usuario distintos.
- **US-8 / AC-8.1, AC-8.2**: AGREE. OBJECT: faltan ACs para registro con email duplicado, password de longitud minima menos uno, y uso de JWT expirado (ver OBS-2).
- **US-8 / AC-8.3**: AGREE — mensaje generico sin indicar campo erroneo esta correctamente especificado y es testeable.
- **US-9 / AC-9.1, AC-9.2**: AGREE. OBJECT: falta AC para bypass del upload limit via llamada directa a API (ver OBS-2).
- **US-9 / AC-9.3**: AGREE en el comportamiento esperado. OBJECT: la automatizacion de este AC en CI requiere control del reloj; sin esa estrategia definida, el AC es de hecho un test manual (ver OBS-5).
- **US-10 / AC-10.1, AC-10.2, AC-10.3**: AGREE — el flujo de mock payment es claro y el aviso de mock es testeable visualmente o via DOM assertion.
- **US-11 / AC-11.1, AC-11.2, AC-11.3**: AGREE — los tres ACs son automatizables (estado del boton, redireccion, flag de onboarding en DB).
- **US-12 / AC-12.1, AC-12.2**: AGREE — accesibilidad en max 2 clicks es testeable con un test de navegacion; el contenido de la politica es testeable con assertion de texto.
- **US-13 / AC-13.1**: AGREE — la confirmacion de tipeo de "DELETE" es testeable directamente.
- **US-13 / AC-13.2**: OBJECT — insuficientemente especifico para automatizacion de blob storage y no define comportamiento ante fallo parcial (ver OBS-3).
- **US-13 / AC-13.3**: AGREE — la persistencia de cuenta y el reset del contador son verificables via API post-eliminacion.
