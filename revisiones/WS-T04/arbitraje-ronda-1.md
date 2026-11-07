# Arbitraje — WS-T04 ronda 1

**Orquestador decide:** 2026-11-07

## Resumen de la ronda 1

- Codificador reporta 18/18 CAs verificados, SHA `4d0caf4`, 4 commits sobre `main`.
- Revisor emite **NO-VERDE** con tres hallazgos: F-01 (NARANJA, edición de `packages/shared-types/package.json` fuera del alcance explícito), F-02 (AMARILLO, cobertura del handler en el límite exacto), F-03 (AMARILLO, test 502 no valida ausencia de persistencia).
- Los 18 CAs pasan por ejecución del revisor. Ningún hallazgo rompe funcionalidad. Ningún CA falla.

## Lectura del orquestador

### Sobre F-01 (la edición de `shared-types/package.json`)

El revisor leyó el dilema con precisión: cambio mínimo + técnicamente necesario + defendible, pero sin el empujón de vuelta que el contrato exige. Mi arbitraje:

**El cambio en sí: aceptado.** La regla "`main` de un package workspace apunta al entry runtime" es la convención correcta en Node. Estaba mal en `main` (apuntaba a `.ts`, que `node` no entiende en runtime), rompía el `npm run start` del backend desde el momento en que había cualquier import de `@proyecto/shared-types`, y revertirlo solo para "respetar alcance" produciría un merge peor: WS-T04 con un CA-12 que falla por un bug preexistente de WS-T01, sin ganancia de disciplina.

**La disciplina del codificador: parcialmente fallada.** La forma correcta de llegar al mismo commit habría sido: detectar el fallo de CA-12 en rojo primero, pausar, decir al orquestador «el CA-12 no puede pasar por un defecto que no es de WS-T04», esperar mi decisión, y entonces aplicar la corrección mínima con mi autorización explícita. Esto no es ceremonia: es la única forma de que un futuro codificador no se tome la licencia de "arreglar lo que considere necesario" y erosione el sello por la vía del arreglo rápido.

La bitácora admite el cambio con rationale técnico, lo cual es honesto, pero no es equivalente a un empujón de vuelta registrado.

**Decisión F-01:**

1. Mantengo el fix de `shared-types/package.json` en el diff de WS-T04 — revertirlo sería trabajo perdido que empeora el estado del repo.
2. Promuevo la raíz del problema (el scaffold roto de shared-types) a **candidata C-07**, reconociendo que el defecto era de WS-T01.
3. Promuevo el proceso faltante (el empujón de vuelta) a **candidata C-08**, para registrar el aprendizaje de proceso en la siguiente redacción de tarea.
4. **Hallazgo F-01 cerrado por arbitraje.** El codificador no tiene que revertir. El revisor queda notificado de la resolución en ronda 2.

### Sobre F-02 (cobertura del handler en el límite)

AMARILLO por diseño del contrato: _«AMARILLO = conocer, puede diferirse»_. Los floors del team.md (≥80% líneas, ≥75% branches) se cumplen. Añadir los 3 tests de camino 500 es una mejora real pero no un defecto bloqueante de WS-T04. Lo relevante es que **lo registremos ahora**, antes de que se olvide bajo la pila de otros entregables.

**Decisión F-02:** diferida a **candidata C-09**. Codificador no toca nada. Hallazgo cerrado por diferimiento documentado.

### Sobre F-03 (test 502 sin verificación de BD)

AMARILLO también. El código del handler es correcto (invoca cliente antes de `save`), pero el test no lo demuestra con lectura de vuelta. Si en un futuro refactor alguien invierte el orden, el test actual pasaría igual. Vale añadir `expect(repo.getById(data.id)).toBeNull()` en el test del 502, pero no es bloqueante.

**Decisión F-03:** diferida a **candidata C-10**. Hallazgo cerrado por diferimiento documentado.

## Decisión global

1. **No hay cambio de código en WS-T04.** El SHA se queda en `4d0caf4`. Ningún revert, ningún commit nuevo del codificador para esta tarea.
2. **Codificador responde a los tres hallazgos** por su identificador con la resolución arbitrada (F-01 arbitrado, F-02 diferido, F-03 diferido). Es ronda 2 "administrativa": sin edición de código, solo acuse formal.
3. **Relanzar revisor en ronda 2** sobre el mismo SHA `4d0caf4`, dándole el informe de ronda 1 y este arbitraje. Si confirma que las resoluciones son consistentes, emite VERDE y abro el PR.
4. **Aprendizajes para registrar**:
   - C-07 (defecto de scaffold que este diff destapó)
   - C-08 (disciplina del empujón de vuelta — proceso del codificador)
   - C-09 (cobertura del handler con margen)
   - C-10 (test 502 que valide ausencia de persistencia)

## Lo que esto deja aprendido para el cuaderno del módulo

- **Arbitraje real, no ceremonial.** Esta es una tarea candidata del entregable del módulo 6 («una vez que arbitraste un empujón de vuelta del codificador y cómo decidiste»). F-01 es exactamente esa situación, con la diferencia de que el empujón vino implícito en la bitácora, no explícito en un informe. La decisión de aceptar el cambio sin pasar por revert cuesta justificarla pero es la correcta: la alternativa habría sido revertir la línea, empujar el PR con un CA-12 falso, y quedar con un ambiente roto para WS-T05.
- **Dos hallazgos AMARILLO diferidos es sano.** El revisor hizo bien en marcar F-02/F-03 como AMARILLO y no inflarlos a NARANJA: no bloquean, pero quedan en el registro para que no se olviden. Si yo los hubiera ignorado en vez de registrarlos como C-09 y C-10, el loop estaría degradando sus propios estándares.
- **La disciplina del empujón de vuelta se enseña, no se castiga.** Este codificador cumplió razonablemente: el cambio fue correcto, mínimo, admitido en la bitácora. Mi feedback (C-08) va dirigido a que la próxima tarea redactada contenga un preámbulo explícito sobre el procedimiento cuando un CA tope con un bloqueo preexistente.
