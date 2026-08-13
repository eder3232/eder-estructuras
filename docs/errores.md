# El sistema de errores: cómo funciona hoy, y qué se aprendió del original

Este documento existe porque el **2026-08-13**, al cerrar U3, el usuario pidió revisar cómo manejaba los errores el proyecto original (`D:\programming\repos_clonados\thesis-structures`) y qué valía la pena rescatar. La revisión dejó dos cosas que no se pueden reconstruir mirando el código: **por qué el diseño de hoy es como es**, y **qué ideas del original no se copian sino que se rehacen**.

Se lee antes de tocar cualquier cosa que produzca, transporte o muestre un error. Las **decisiones abiertas** que salieron de acá (grupo E) viven en [`pendientes-comparacion.md`](./pendientes-comparacion.md), no acá: este documento es el análisis, ese otro es la agenda.

---

## Parte 1 — Cómo funciona hoy

### El contrato

El motor es **el único que decide qué es inválido**. La UI no reimplementa validaciones: las captura y las muestra.

Y hay **dos severidades que no se mezclan**, con una regla que decide todo lo demás:

| | Qué significa | Quién lo produce | Efecto |
|---|---|---|---|
| `error` | El motor no pudo calcular | una excepción, capturada por fila | **No hay resultados** |
| `warning` | Calculó, y hay algo que conviene saber | `SolveResult.warnings` | Hay resultados **y** un aviso |

> **Una advertencia nunca puede impedir que se muestre un resultado.** Si algo tiene que impedirlo, es un error y se tira. Esta regla existe porque el proyecto original hacía exactamente lo contrario, y está contado en la parte 2.

Un error se **tira** (`throw`) y una advertencia se **devuelve** (`SolveResult.warnings`). Eso no es un detalle de estilo: es lo que hace imposible que un aviso corte el cálculo. Las advertencias viven en `src/lib/engine/warnings.ts` y hoy son dos —un nudo sin ninguna barra conectada, y la matriz mal condicionada pero resoluble—, las dos puras y testeadas aparte.

**El motor no nombra la fila en el mensaje**, y a propósito: solo conoce ids, y `seed-v5` en pantalla no le dice nada a nadie. La advertencia viaja con `refId` y el adaptador de cada sistema resuelve el nombre contra su tabla (`refName`). El mensaje de error de mecanismo, que es anterior a esta regla, **sí** mete ids en el texto — es una deuda, no un ejemplo a seguir.

```ts
// src/app/<sistema>/store/results.ts
export type Armaduras2DResults =
  | { status: "ok";    solved: SolveResult; nodesById: Map<string, NodeRow> }
  | { status: "error"; errors: DomainError[]; nodesById: Map<string, NodeRow> }
  | { status: "empty"; reason: "no-nodes" | "no-elements"; nodeCount: number; ... }
```

Todo sale de un **átomo derivado**: los errores son una función pura del estado, nunca una lista que alguien llena con un `setErrors` desde un efecto. **Esta es la decisión más importante del sistema entero**, y no se toca: un error derivado no puede quedar desincronizado de los datos, así que es imposible que la pantalla muestre un error que el usuario ya corrigió.

`DomainError` (en `src/components/custom/errors-panel.tsx`) lleva `source`, `refId`, `message` y, opcionalmente, `mechanism`.

### Los cuatro estados y dónde se dice cada cosa

Esto lo fijó **U3** (2026-08-13, ver [`armaduras-2d-cierre.md`](./armaduras-2d-cierre.md)) y es la parte que más fácil se rompe sin querer:

| Estado | Dónde se dice | Por qué ahí |
|---|---|---|
| **Error de datos** (nudo duplicado, barra a nudo inexistente, longitud cero) | Alerta roja **arriba**, entre las tablas y los resultados | Se atribuye a una fila: su lugar es junto a la tabla que hay que corregir |
| **Advertencia** (nudo sin barras, matriz mal condicionada) | Alerta ámbar **arriba**, en el mismo lugar que los errores… y **los resultados siguen abajo, enteros** | Es sobre el modelo, así que va donde se lo corrige. Que no bloquee es la regla de arriba |
| **Mecanismo** (`Kff` singular) | **Adentro del panel de resultados**, con su explicación y el dibujo del modo | No es un dato mal cargado: es lo que **produjo** el cálculo. Es una salida |
| **Modelo vacío** (sin nudos o sin barras) | En el lugar de los resultados | No es un error: todavía no hay nada que calcular |
| **Resuelto** | El acordeón | — |

Dos reglas que se siguen de eso:

1. **El error de mecanismo se filtra de las alertas** (`errors.filter((e) => !e.mechanism)`). En el panel de arriba salía como "Error en un elemento" atribuido a un `refId: "-"` que no existe, y además repetía a 20 px lo que el bloque de abajo explica entero. **El motivo se dice una sola vez.**
2. **La sección de resultados nunca desaparece.** El título se queda siempre; lo que cambia es el cuerpo, y los controles de decimales y notación compacta solo aparecen cuando hay números que formatear. Esconder la sección entera hace saltar el layout justo cuando el usuario está corrigiendo el modelo, que es el peor momento.

### Dónde vive cada pieza

- `src/components/custom/errors-panel.tsx` — el tipo `DomainIssue` (con `DomainError` como el caso `severity: "error"`) y el render de las alertas, errores y advertencias. **Presentación pura.**
- `src/lib/engine/warnings.ts` — el tipo `SolveWarning` y los productores. Puros y testeados sin motor.
- `src/components/custom/no-results.tsx` — el bloque de "no hay resultados, y este es el motivo". También presentación pura.
- `src/app/<sistema>/components/errors-panel.tsx` — adaptador de ~10 líneas que lee el átomo de *su* sistema y delega.
- `src/app/armaduras-2d/components/results/mechanism-explanation.tsx` — el diagnóstico con su dibujo. Es de `armaduras-2d` porque necesita la geometría del sistema.
- `src/lib/engine/mechanism.ts` — `SingularStiffnessError` y el diagnóstico. **Alcanza a los cuatro sistemas**: vive en `System.solve()`.

> Hoy solo `/armaduras-2d` está cableado a `NoResults` y a las advertencias. Los otros tres siguen con `return null` y **descartan** `solved.warnings`: el motor las calcula para los cuatro, pero solo un sistema las muestra. Eso es **hilo C**, y hay que preguntar antes de propagar.

### El color de una advertencia: medir la razón de contraste, no la distancia

Al usar por primera vez la variante `warning` —existía desde el fork del `Alert` y **nunca la había usado nadie**— apareció que el token `--warning` era ilegible en tema claro. Y lo interesante es **cómo** apareció, porque corrige el método que este repo venía usando:

- La **distancia RGB** contra el fondo daba **275**, del mismo orden que la del rojo de error (355) y muy por encima de los colores de zona de la partición (61–90). Por ese criterio estaba bien.
- La **razón de contraste WCAG**, que es la métrica que corresponde a **texto**, daba **2.28:1** — la mitad del 4.5 que pide AA, y por debajo del 3:1 que piden los gráficos.

La distancia RGB sirve para *"¿esta zona se distingue de aquella?"*, que es la pregunta de los bloques de la partición. Para *"¿se puede leer esto?"* la pregunta es otra y la métrica también. `--warning` pasó de `oklch(0.75 0.17 75)` a `oklch(0.56 0.15 75)` en tema claro, que da **4.77**, exactamente el mismo contraste que `--destructive`. El de oscuro no hacía falta tocarlo: ahí da 11.5.

**Alcanza también a los diagramas**: `--warning` es el color de las flechas de reacción (`diagram-2d/force-arrow.tsx`, `moment-arc.tsx`, y el material de la escena 3D). O sea que en tema claro las reacciones de `/armaduras-2d`, `/frame2d` y `/armaduras-3d` **estaban a 2.3:1 y ahora están a 4.7:1**. Se verificó por captura con la sección de la deformada abierta.

---

## Parte 2 — Qué hacía el original, y qué se aprendió

El original tenía, **por programa** (cuatro copias): tres átomos derivados de errores que se concatenaban (`verticesErrors` + `edgesErrors` + `debounce`), un catálogo de 17 códigos, y los resultados rendidos con `{errors.length === 0 && <Results />}`.

### Lo que estuvo bien y sobrevivió al refactor

No es cortesía: son cuatro decisiones correctas que v2 mantiene porque son las correctas.

1. **Errores como átomo derivado, no como estado imperativo.** Lo dicho arriba: es la decisión que evita toda una clase de bugs, y estaba tomada bien desde el principio.
2. **Los mensajes nombran la fila.** `El nudo v3 tiene una fuerza aplicada en un grado de libertad restringido en el eje X` — no "datos inválidos".
3. **Bloquear los resultados mientras hay errores.** Mejor no mostrar nada que mostrar números sin sentido.
4. **`severity` que se ve.** El original forkeó `ui/alert.tsx` para agregarle `error`/`warning`/`info`; v2 hace lo mismo en `ui-custom/alert.tsx`.

**Lo que el original hacía mal era el cableado, no el diseño.** Por eso las dos ideas que faltan (E1 y E2) **no se copian: se rehacen**.

### Las cuatro trampas del original

Anotadas porque son fáciles de repetir, no para hacer leña:

- **El catálogo no era la fuente.** `errorsCode.ts` definía nombre y mensaje de 17 errores y **nunca se importaba en tiempo de ejecución**: lo único que se usaba era `keyof typeof errorsCode` como tipo, y los textos estaban tipeados otra vez en cada `push`. Ya había divergido: `e211` llevaba `errorCode: 210`, y el aviso del debounce se mandaba con `errorCode: "e100"`, que en el catálogo era otra cosa. **Regla para E1: el catálogo exporta las funciones que construyen el error, no constantes que alguien vuelve a tipear** — un mensaje que nombra la fila es una función de sus datos, y eso es exactamente lo que dejó el catálogo decorativo.
- **Un tercio de los errores no llegaba a la pantalla.** Los de lógica (`e300`/`e301`/`e302`) se pusheaban a `response.errors` dentro del átomo de resultados, pero el átomo que alimentaba el panel solo concatenaba vertices + edges + debounce, y **ningún componente leía `response.errors`**. Se calculaban y se tiraban. El único que el usuario veía era la matriz singular, escrito a mano adentro del componente de resultados.
- **Validación duplicada.** Las clases del motor tiraban sus propias excepciones *y* el store revalidaba lo mismo por afuera: dos sistemas que pueden estar en desacuerdo. En v2 el motor es el único que decide.
- **"Estoy esperando" viajaba por el canal de "está mal".** Ver abajo.

### El "debouncer": qué era en realidad

Es la parte más instructiva, y la razón por la que este documento existe.

```ts
export const atomEffectListener = atomEffect((get, set) => {
  get(atomGetEdges); get(atomGetVertices); /* … */
  set(atomSetHasRecentUpdate, true);
  setTimeout(() => { set(atomSetHasRecentUpdate, false); }, 2000);
});
```

**No era un debounce.** Un debounce **cancela el temporizador pendiente** en cada evento nuevo; por eso puede prometer "esperá a que deje de escribir". Acá el `setTimeout` no se cancela nunca, así que la bandera se apaga 2 s después del **primer** cambio, no del último: editando en t=0 y t=1,9 s, el temporizador viejo se dispara a t=2,0 y apaga la espera **mientras el usuario sigue escribiendo**. Funcionaba casi siempre solo porque 2 segundos es mucho tiempo.

**Y sin embargo evitaba el recálculo**, por una cadena que nadie escribió a propósito: el aviso era un error más → `errors.length > 0` → se desmontaba `<Results/>` y el átomo del gráfico cortaba antes de leer los resultados → y como **los átomos derivados de Jotai son perezosos**, nadie los leía y no se calculaban. O sea que el mecanismo real era *"no hay suscriptores"*. Frágil: el día que alguien renderice algo que lea los resultados sin ese `if`, el ahorro desaparece en silencio.

Costos que sí se notaban: el dibujo y los resultados se iban de pantalla **2 segundos con cada tecla**, porque el "estoy esperando" viajaba por el mismo canal que "tu modelo está mal". Un warning que bloquea es un error disfrazado — de ahí sale **E2**.

### El bug que el debouncer tapaba, y por qué v2 no lo tiene

El síntoma recordado era *"React tomaba un valor pasado"*. La causa no era la velocidad de React. Está en `EderInput`:

- El valor se confirmaba **solo en `onBlur`**…
- …pero había **dos caminos que desmontaban el input** antes de que eso pasara: la tecla Enter (que apagaba `isEditMode`) y el `ClickAwayListener`.
- Encima, `useEffect(() => setShowValue(value), [value])`: estado derivado sincronizado a mano, la fuente clásica de "muestra un valor que ya no es".

**Dos caminos de salida y uno solo de confirmación, compitiendo.** El retraso de 2 segundos le daba tiempo al blur a llegar antes de que se recalculara con el dato viejo.

`custom/formula-input.tsx` no lo tiene, y no por suerte: **el `<Input>` está siempre montado** (cambia el `value`, no el árbol), **Enter no cierra nada sino que llama a `blur()`**, y Escape marca una bandera (`isCancellingRef`) para que ese blur no confirme. **Un solo camino de confirmación.** Esa es la regla a mantener si alguien toca ese componente o escribe otro parecido.

### ¿Hace falta un debounce en v2?

**Hoy no.** Los inputs confirman en `blur`, así que se recalcula una vez por celda editada y no una por tecla, y las matrices de estos modelos son chicas.

Cuando haga falta no va a ser por el cálculo sino por el **DOM**: la deuda **D14** del roadmap (los pasos de ensamblaje son una matriz global **por barra** — con 20 nudos y 40 barras son ~64.000 celdas). Si algún día se mide que hace falta, que sea un debounce de verdad —cancelando el pendiente, 200-300 ms— y **en un canal separado del de los errores**.

---

## Lo que se verificó y **no** es un hallazgo

Para no volver a levantarlo como si fuera nuevo:

- El toggle **"¿los restringidos van arriba?"** del original ya está catalogado dentro de **M1** en [`pendientes-comparacion.md`](./pendientes-comparacion.md), con la observación correcta: es una permutación de la *partición*, no del ensamblaje, así que se resuelve como vista sin tocar `System`.
- **M2** (nombres duplicados), la **UI de FEM** con imágenes (hilo B), **N1** (persistencia) y **S2** (navegación) ya estaban catalogados desde el 2026-08-12.
- Los **falsos rescates** —los resortes en nudos que nunca entran a la matriz, `file-saver` sin usar, los `OrbitControls` comentados— están al final de [`pendientes-comparacion.md`](./pendientes-comparacion.md).

## Recomendación de orden

**Nada del grupo E se abre ahora.** E1 y E2 se deciden junto con **S2** y **N6**, antes de la Fase 8: `E1` solo vale la pena si los errores van a enlazar contenido teórico —ahí el código estable es lo que ancla el enlace—, y meterlos en la lista de cierre de `/armaduras-2d` la alarga sin cerrar nada.

La excepción defendible sería **E2**, que es chico y ya tiene las variantes de Alert puestas y sin usar. Pero hoy no hay ningún caso que lo empuje, así que espera igual.
