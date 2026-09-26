**Collaborator:** aidlc-design-agent

## Contribution

### Observacion 1 — Inconsistencia entre el wireframe de Historia y los AC de US-5

El wireframe de la pantalla Dashboard/History (Screen 4) muestra una tabla con columnas Image, Date, "Top Cat." y Score. Sin embargo, AC-5.1 especifica que cada upload calificado muestra "su fecha y la categoria con la puntuacion mas alta" (highest-scoring category). El wireframe contradice esto en su nota de comportamiento clave, donde indica que "Top category = the category with the most consistent observations (not necessarily lowest score)". Hay una discrepancia entre lo que el AC define (categoria de puntuacion mas alta) y lo que el wireframe describe en su logica de presentacion (categoria mas consistente). Esta ambiguedad llegara al desarrollador y al tester sin una definicion resuelta, generando implementaciones divergentes. Se recomienda alinear el criterio en un solo lugar antes de la firma del artefacto.

### Observacion 2 — AC de error de carga (US-1) sin especificar el momento y lugar de visualizacion del mensaje

AC-1.2 y AC-1.3 especifican el texto exacto del mensaje de error, lo cual es correcto. Sin embargo, ninguno de los dos criterios indica DONDE aparece el mensaje ni por cuanto tiempo es visible. El wireframe de la pantalla Upload (Screen 2) no muestra ningun estado de error ni una zona de notificacion. Desde la perspectiva de diseno de interaccion, faltan al menos dos detalles:
- Ubicacion del mensaje (inline dentro del drop zone, banner superior, toast flotante).
- Persistencia del mensaje (desaparece automaticamente, o requiere que el usuario lo descarte).
Sin esto, la historia es implementable pero no disennable de forma consistente.

### Observacion 3 — US-11 no es suficiente para transmitir el posicionamiento "complemento, no reemplazo"

El wireframe del Onboarding (Screen 1) muestra correctamente los tres checkboxes. El primero dice: "Estudio COMPLEMENTS human critique — it doesn't replace your instructor, community, or mentors." Sin embargo, AC-11.2 en las historias de usuario solo exige que los tres checkboxes esten presentes y que el boton este deshabilitado hasta que se marquen todos. No hay ningun criterio de aceptacion que valide el contenido exacto de los checkboxes. Esto significa que durante la implementacion los textos podrian alterarse (acortarse, reformularse) sin que ningun AC lo detecte como falla. Para una historia cuyo proposito central es establecer expectativas correctas sobre la IA, el texto de los checkboxes es parte del producto, no un detalle de implementacion. Se recomienda que AC-11.2 incluya los textos exactos o una referencia a un documento de contenido aprobado.

### Observacion 4 — Estado de error de baja confianza en US-3: ausencia de distincion visual en el historial

AC-3.1 cubre correctamente el estado de baja confianza en el momento de la carga (muestra mensaje + boton Retry). AC-5.1 cubre la representacion en el historial ("Critique unavailable"). No obstante, ninguna historia ni ninguno de los wireframes especifica el estado visual del thumbnail del upload fallido en la tabla del historial. Los wireframes muestran thumbnails de imagen en cada fila, pero una carga fallida pudo haber sido rechazada por baja confianza despues de almacenarse; el thumbnail existe pero el critique no. Falta definir si la fila muestra el thumbnail con algun indicador visual de estado (icono de advertencia, imagen en grisado), o si simplemente muestra la miniatura sin contexto. Esto es un edge case de UX que no esta cubierto ni en las historias ni en los wireframes.

### Observacion 5 — US-9: estado de 0 uploads restantes no especifica la experiencia para usuarios que llegan por enlace directo al Upload

AC-9.2 cubre correctamente el caso en que Ana abre la pantalla de Upload con 0 uploads restantes: el drop zone se reemplaza por un mensaje de bloqueo con boton Upgrade. Sin embargo, el wireframe de Upload (Screen 2) muestra en sus Key behaviors que "when counter reaches 0, the drop zone shows 'Upgrade to upload more' instead", mientras que AC-9.2 especifica un texto diferente y mas largo: "You've used all 10 uploads for this month. Resets on the 1st." Hay una inconsistencia menor de copy entre el wireframe y la historia que debe resolverse. Mas importante: ninguna historia ni wireframe especifica que sucede cuando el usuario intenta navegar directamente a la ruta `/upload` con 0 uploads (via bookmark o enlace compartido). El comportamiento del wireframe implica que la pantalla se muestra pero el drop zone esta bloqueado — pero ese path no tiene AC que lo valide.

---

## Positions

OBJECT AC-5.1 — El criterio dice "highest-scoring category" pero el wireframe define "Top category = the category with the most consistent observations". Ambas fuentes deben alinear la definicion de "Top Category" antes de que este AC sea verificable por el equipo de calidad.

OBJECT AC-11.2 — El criterio no especifica el contenido textual de los checkboxes. Para una historia cuyo valor central es el posicionamiento ("complemento, no reemplazo"), el texto de los checkboxes es verificable y debe estar en el AC o referenciado explicitamente.

OBJECT AC-1.2 / AC-1.3 — Ambos criterios especifican el mensaje de error correctamente pero omiten la ubicacion y duracion de la notificacion. Desde UX, esto es informacion de diseno de interaccion que debe estar en el AC o en una referencia a la especificacion de interaccion correspondiente.

AGREE AC-3.1 — El fallback de baja confianza esta correctamente descrito: mensaje especifico, boton Retry, y ausencia de scores. Coherente con el wireframe.

AGREE AC-9.2 — El bloqueo del drop zone cuando el contador llega a 0 esta correctamente especificado como experiencia principal. El copy del wireframe y el del AC deben reconciliarse, pero la logica de interaccion es correcta.

OBJECT US-3 (edge case faltante) — Ningun AC de US-3 ni de US-5 especifica la representacion visual del thumbnail de un upload de baja confianza en la tabla del historial. Se recomienda agregar un AC en US-5 que cubra este caso.
