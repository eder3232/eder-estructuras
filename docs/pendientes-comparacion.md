# Pendientes de la comparación con el proyecto original

El **2026-08-12** se comparó `/armaduras-2d` contra el `armor2d` del proyecto original (`D:\programming\repos_clonados\thesis-structures\src\programs\armor2d\`) archivo por archivo. De ahí salieron dos cosas:

- Lo **pedagógico**, que sí se va a hacer ahora y está planificado en [`docs/armaduras-2d-plan.md`](./armaduras-2d-plan.md).
- Todo lo demás, que es **este documento**: lo que la comparación encontró y se decidió no abordar todavía, con la decisión que hay que tomar en cada caso.

> **Actualización del 2026-08-12.** Buena parte de este documento **dejó de estar en espera**: el usuario decidió cerrar `/armaduras-2d` por completo antes de propagar, y con eso **los grupos U y N entraron enteros en la lista de trabajo activa**, que es [`armaduras-2d-cierre.md`](./armaduras-2d-cierre.md). Del grupo S ya se hicieron **S1** y **S3**. Lo que sigue realmente en espera es **S2** (la navegación definitiva) y el **grupo M** entero.
>
> Los puntos se dejan escritos acá igual, porque este documento es donde vive **la decisión abierta de cada uno** — el orden y el estado están en el otro.

Existe para no volver a descubrirlo dentro de seis meses, y para que cuando le llegue el turno a cada punto la discusión arranque de donde quedó y no de cero.

**Cómo leerlo.** Cada punto tiene un id estable (`S`hell, `M`otor, `U`sabilidad, `N`uevo, `E`rrores) y, sobre todo, **la decisión abierta** — que es lo que no se puede reconstruir mirando el código. El *qué falta* casi siempre es obvio; el *por qué no se hizo así nomás*, no.

> **Segunda pasada, 2026-08-13.** La comparación original miró **solo `armor2d`**. A pedido del usuario se barrió después el resto del proyecto v1 —el sistema de errores completo, `shared/`, `app/`, `content/`, `db/` y los otros cuatro programas— con la consigna de *rescatar lo bueno que v2 no esté haciendo mejor*. De ahí salió el **grupo E** y **N7**, más la lista de **falsos rescates** del final: cosas que v1 aparentaba tener y no tenía. El análisis del sistema de errores de v1 está resumido en el grupo E.

**Regla de orden que atraviesa todo el documento**: los grupos S y M alcanzan a los cuatro sistemas. Cambiar algo en un sistema es barato; en cuatro, no. Todo lo que alcance a los cuatro conviene decidirlo **una vez** y aplicarlo de una pasada, igual que se resolvió con el hilo C del [roadmap](./refactor-roadmap.md#3-los-hilos-pendientes).

---

## Grupo S — El shell de la app

Alcanza a los cuatro sistemas. Es lo más barato de la lista y lo más visible: son las tres cosas que alguien nota en los primeros diez segundos.

| # | Qué falta | Decisión abierta | Tamaño |
|---|---|---|---|
| **S1** | ✅ **Hecho el 2026-08-12** (commit `b1ee999`). La app se llama **Eder Estructuras**, `lang="es"`, y el nombre y la descripción viven en `src/lib/site-config.ts` — que también exporta `systemLinks` | — | chico |
| **S2** | **Parcial.** Hay una navbar **provisional** desde el 2026-08-12 (el toggle de tema necesitaba vivir en algún lado): nombre, los cuatro sistemas y el toggle, sin estado de link activo y sin footer. La decisión de fondo sigue abierta | Ver abajo — **no cambió** | chico/mediano |
| **S3** | ✅ **Hecho el 2026-08-12** (commit `b9468e0`). `next-themes` montado con `attribute="class"`, y `/armaduras-2d` verificada en oscuro por captura. Faltan los otros tres sistemas en oscuro | Ver abajo — lo que queda es la verificación, no la decisión | chico |

### S2 · Qué forma tiene la navegación

El original tenía navbar + footer y tres zonas (`/programs`, `/learn`, `/thesis`). Acá hoy hay una home con cuatro links y nada más.

Lo que hay que decidir no es "poner una navbar", es **si el layout de los sistemas es el mismo que el del contenido educativo**. El contenido educativo es la Fase 8 del roadmap y probablemente quiera su propia navegación (índice, secciones, anterior/siguiente), mientras que un sistema quiere ancho completo para las matrices. Si eso es así, conviene un route group (`(programs)`) con su layout, antes que meter todo en `src/app/layout.tsx` y después separarlo.

**Conviene decidirlo antes de la Fase 8, no durante.**

### S3 · Modo oscuro: montar el provider no alcanza

> **Montado el 2026-08-12**, y la advertencia de abajo se confirmó: activar el switch fue el principio del trabajo. `/armaduras-2d` se miró entera en oscuro y quedó bien —incluidos los cuatro colores de zona de la partición, medidos—, pero **los otros tres sistemas siguen sin mirarse**.

Montar `ThemeProvider` y un toggle es de una tarde. Lo que había que tener en cuenta es que **nunca se había mirado ningún sistema en oscuro** (deuda D5 del roadmap), así que activar el switch es el principio del trabajo, no el final.

El caso delicado es `/armaduras-3d`: los materiales de three.js no aceptan clases de CSS, así que los colores se leen de los tokens `oklch` y se convierten en `src/components/custom/diagram-3d/theme-colors.ts`. Eso es una lectura, no una suscripción — **hay que verificar que la escena se repinte al cambiar de tema**, y no asumirlo. Está explicado en [`docs/diagram-3d-pattern.md`](./diagram-3d-pattern.md).

---

## Grupo M — El motor (los cuatro sistemas)

| # | Qué falta | Decisión abierta | Tamaño |
|---|---|---|---|
| ~~**M1a**~~ | ✅ **Hecho el 2026-08-13.** `solve()` acepta `{ restrainedFirst }` con `false` por defecto, así que los otros tres sistemas no cambian; la UI va solo en `/armaduras-2d`. Salió tan barato como se había medido: solo hubo que emitir `dofOrder` ordenado por `globalIndex` y acomodar los cuatro bloques en `partition-and-solution.tsx`. Detalle en [`armaduras-2d-cierre.md`](./armaduras-2d-cierre.md) | — | — |
| ~~**M1b**~~ | ✅ **Hecho el 2026-08-13**, y con una corrección al plan: **no es una sugerencia, se respeta tal cual**. Que v1 la tratara como sugerencia era una limitación de v1 —cortaba la matriz por posición, así que necesitaba los grupos contiguos—, no del método. Ver [`armaduras-2d-cierre.md`](./armaduras-2d-cierre.md) | — | — |
| **M2** | No se validan **nombres duplicados** de nudo ni de barra. El original sí (errores e100/e200). Acá los ids son UUID, así que dos nudos llamados `v1` pasan sin protestar y dejan ambiguas las etiquetas de todas las matrices | Ver abajo | chico |

### M1 · Los dos checkboxes del original

**Para qué existían** — lo contó el usuario el 2026-08-13, y es lo que no se puede deducir del código:

- **"¿Los restringidos van arriba?"** — *algunos profesores ensamblan la matriz global con los grados restringidos arriba y otros abajo. Matemáticamente da lo mismo, pero al que recién aprende lo confunde muchísimo.* El checkbox existe para que la pantalla se parezca al pizarrón del que enseña.
- **"¿Desea ingresar los grados de libertad?"** — *el profesor a veces numera los DOF de una forma rara, a propósito, para ver si el alumno entendió el método.* El checkbox agrega inputs en la tabla de nudos y el número que el alumno carga es una **sugerencia, no una orden**: la app la respeta solo si tiene sentido —o sea, si los restringidos y los libres quedan agrupados como corresponde— y si no, la usa nada más como criterio de desempate. En el original eso era literalmente un `sort` por el número del usuario **dentro de cada grupo**, y después la concatenación de los dos grupos según el otro checkbox.

En v1 estas dos features **duplicaron la lógica**: `splitGlobal()` tiene dos ramas de ~30 líneas cada una que hacen lo mismo con los índices corridos, y hay renderizado condicional colgando de los flags.

#### Por qué en v2 sale mucho más barato

**Porque v2 ya separa lo que v1 mezclaba.** El original **cortaba la matriz por posición** (`global[i][j]` contra `global[i+u][j+u]`), así que cambiar el orden obligaba a reescribir el corte entero — de ahí las dos ramas. `System.solve()` en cambio **junta por lista de índices**:

```ts
const kff = this.gather(k, free, free);   // free y restrained son listas de índices
```

`gather` no supone nada sobre el orden: funciona igual con los restringidos arriba, abajo o intercalados. Y todo lo demás cuelga de ahí — `assembleGlobal` usa `byNode`, los pasos salen del mismo ensamblaje, y la UI se etiqueta con `assembly.dofOrder`, nunca con posiciones fijas.

**Consecuencia: en v2 los dos checkboxes no son dos features, son dos entradas de la misma función.** El orden de los DOF es una sola decisión —una lista ordenada de pares `(nudo, dof local)`— y los dos flags son criterios de esa ordenación: agrupar por restricción (y en qué orden van los grupos), y desempatar por el número del usuario.

Lo que hay que tocar, medido contra el código de hoy:

| Dónde | Qué | Tamaño |
|---|---|---|
| `System.buildDOFOrder()` | Recibe la política de orden en vez de numerar por inserción. **Ojo**: `dofOrder` se arma hoy recorriendo los nudos, así que hay que emitirlo ordenado por `globalIndex` para no romper la invariante `dofOrder[i].globalIndex === i` de la que dependen las etiquetas | chico |
| `partition-and-solution.tsx` | Es el **único** lugar que fija un orden a mano (`[...partition.free, ...partition.restrained]` y `cut = free.length`). Con los restringidos arriba, los cuatro bloques se acomodan al revés | chico |
| Store + tabla de nudos (solo M1b) | Dos columnas más por nudo (tres en pórticos y 3D), condicionales al checkbox | mediano |

Lo que **no** hay que tocar, y es la mitad del trabajo de v1: el ensamblaje, los pasos, la partición, las ecuaciones de despeje (están escritas en términos de bloques `Kff`/`Kfr`, no de posiciones), el diagnóstico de mecanismo, el desplazamiento unitario y el modo práctica. Todos leen `dofOrder` o listas de índices.

Y los resultados son **invariantes**: los tests de regresión afirman desplazamientos, reacciones y fuerzas internas **por nudo**, así que no se mueven. Los únicos que verían el cambio son los tres `expect` de `system.test.ts` que fijan el orden de inserción — y solo si se cambia el valor por defecto, que no hay que cambiarlo.

#### Lo que queda por decidir

- **M1a** casi no tiene decisión: es un flag, con `false` (libres arriba) como valor por defecto. La única pregunta es si el flag es por sistema o global de la app.
- **M1b** sí tiene dos:
  1. **Numeración explícita contra reordenar filas.** Sigue en pie la alternativa barata: `buildDOFOrder()` numera por orden de inserción y ese orden lo decide el store, así que **arrastrar filas ya es cambiar la numeración**. Pero ahora sabemos que la numeración del original es una *sugerencia con desempate dentro del grupo*, y eso el arrastre no lo da: reordenar filas permuta de a pares (`v1x`,`v1z` van juntos), y el profesor que numera "raro" puede justamente intercalarlos.
  2. **Qué se le dice al alumno cuando su numeración no se puede respetar.** Es el caso pedagógicamente más interesante —*pediste este orden, no se puede porque mezcla restringidos con libres, así que lo usé para ordenar dentro de cada grupo*— y **no tiene dónde decirse hoy**: no es un error que bloquee. Es el primer caso concreto que empuja a **E2** (el canal de advertencias, ver el grupo E). Conviene hacer E2 antes, o al mismo tiempo.

### M2 · Dónde va la validación de nombres

El motor no conoce los nombres —solo ids—, así que la validación es del store o de la UI de cada sistema, no de `System`. Las decisiones son dos:

- **¿Bloquear o auto-renombrar?** El original bloqueaba. Auto-renombrar es menos molesto pero pisa lo que el usuario escribió.
- **¿Dónde se muestra el error?** Hay un gancho ya listo y sin usar: `DomainError` (en `src/components/custom/errors-panel.tsx`) tiene un campo `refId` que hoy **no se usa para nada**. Está justamente para anclar el error a la fila que lo causó, en vez de listarlo suelto arriba. Si se implementa M2, conviene resolver de paso el resaltado de la fila para todos los errores, no solo para este.

---

## Grupo U — Usabilidad de `/armaduras-2d`

Esto es lo que en la comparación se llamó **P1**: mejoras reales de uso que no son narrativa pedagógica y por eso quedaron fuera del [plan P0](./armaduras-2d-plan.md).

| # | Qué falta | Decisión abierta | Tamaño |
|---|---|---|---|
| **U1** | Encabezados agrupados en la tabla de nudos. El original tenía `Coordenadas` / `Fuerza` / `Desplazamiento` / `Restringido` en dos niveles con `colSpan`; acá son nueve columnas planas ("Fuerza X", "Desplaz. X"…) | Al agrupar, la tabla se angosta bastante. Conviene revisar en la misma pasada si las dos columnas de restricción siguen como checkbox suelto o se compactan | chico |
| **U2** | Combobox buscable en "Desde" / "Hacia". El original lo tenía; acá es un `Select` plano | `cmdk` ya está en dependencias, así que `Command` + `Popover` es directo. La decisión es **cuándo**: con 4 nudos el `Select` está perfecto y el problema recién aparece a los 15. Sumar de paso el rechazo de "Desde = Hacia", que hoy solo se entera el motor (longitud cero) | chico |
| **U3** | Estado vacío del panel de resultados: `ResultsPanel` devuelve `null` si hay error, y queda el título "Resultados" con el selector de decimales al lado y nada debajo | ¿Un mensaje en el lugar de los resultados, o esconder la sección entera incluido el título? Lo segundo es más limpio pero hace saltar el layout | chico |
| ~~**U4**~~ | ✅ **Hecho el 2026-08-12**, junto con D6 como estaba previsto. El número va sobre cada barra de la forma deformada, al 25% del recorrido y corrido hacia afuera de la figura, del mismo color que la barra. Alcanza también a `/frame2d`, que comparte el módulo de diagramas. Ver [`diagram-pattern.md`](./diagram-pattern.md), "Dónde van los números" | — | — |
| ~~**U5**~~ | ✅ **Resuelto el 2026-08-13, y al revés de como estaba planteado.** La app **no lleva unidades, a propósito**; lo que faltaba era decirlo. Ver abajo | — | — |

### U5 · No hay unidades, y es una decisión

> **Este punto estaba mal planteado, y el usuario lo corrigió el 2026-08-13.** Se deja el razonamiento entero porque el error es instructivo y para que nadie vuelva a proponerlo dentro de seis meses.

**Lo que decía**: que una app de análisis estructural no diga si esos `20000000` son kN/m² o kgf/cm² es raro, y en un contexto académico es lo que un profesor marca — así que había que **rotular con un sistema fijo** (kN, m, kN/m²), dejando la conversión para más adelante.

**Por qué está mal.** Ese argumento **asume que la app debería elegir un sistema**, y eso contradice el diseño: en estructuras se trabaja en muchos sistemas —tonf/cm², kgf/cm², kN/m²— y ninguno es el correcto. El método matricial es **dimensionalmente homogéneo**: si los datos están en un sistema coherente, los resultados salen en ese sistema, y el programa nunca necesita saber cuál es.

Y hay algo peor que "no aporta": **un rótulo fijo sería activamente falso**. Un encabezado que dice "kN/m²" sobre un dato cargado en kgf/cm² es una afirmación equivocada, y un rótulo se lee como una afirmación. Eso es peor que no decir nada. La conversión es peor todavía: implicaría que la app sabe qué significan los números.

**Lo que sí faltaba**, y es lo que se hizo: la regla de coherencia estaba **implícita**. `custom/units-note.tsx` la dice una vez, arriba de la página, con la correspondencia entrada→salida (la unidad de longitud sale en los desplazamientos; la de fuerza, en reacciones y esfuerzos) y con el error que el alumno realmente comete, que no es elegir mal el sistema sino **mezclar** — `E` en kgf/cm² con las coordenadas en metros, que da resultados errados por 10⁴ y que **el programa no puede detectar**.

**Descartado y anotado**: un campo de texto libre donde el alumno declare "trabajo en tonf, cm" y la app lo repita en los encabezados. Compra un eco y se desactualiza sola en cuanto cambien los datos y no el rótulo — o sea, vuelve a ser un rótulo que puede mentir.

---

## Grupo N — Lo que ninguna de las dos versiones tuvo nunca

Esto es el **P2**: no son regresiones, son las mejoras que harían que el rework sea *mucho* mejor y no solo *igual*.

| # | Qué | Decisión abierta | Tamaño |
|---|---|---|---|
| **N1** | **Guardar / cargar / compartir un problema.** Hoy un alumno no puede entregar su ejercicio ni retomarlo mañana: recargar la página lo pierde todo | Ver abajo | mediano |
| **N2** | **Ejemplos precargados** (dos o tres armaduras clásicas) elegibles de una lista | Cargar un ejemplo pisa lo que el usuario tenía. Necesita confirmación o deshacer — y eso depende de N1. Dato útil: la semilla actual **es el caso del test de regresión**, así que los números en pantalla ya se pueden cotejar contra valores validados | chico |
| **N3** | **Vincular tabla ↔ diagrama**: pasar el mouse por una fila resalta el nudo o la barra en el esquema, y al revés | Dónde vive el estado de "resaltado": átomo por sistema o contexto local. Es transversal a los cuatro sistemas y a los dos módulos de diagrama, así que conviene definirlo una vez | mediano |
| **N4** | **Vincular matriz ↔ modelo**: pasar el mouse por una celda de K resalta los dos grados de libertad involucrados y las barras que aportan ahí | Ver abajo — es la mejor de la lista | mediano |
| **N5** | **Verificación de equilibrio** (ΣF = 0 por nudo y global) como cierre de los resultados | ¿Sección propia del acordeón, o un cartel de "resultado verificado" arriba? Los scripts de regresión ya hacen esta verificación **fuera del repo**; traerla a la UI cierra el recorrido pedagógico | chico |
| **N6** | **Contenido teórico enlazado desde cada sección** de resultados. El original tenía `/thesis/explanation/armor2d` | Es la **Fase 8** del roadmap, no una decisión suelta. Lo único que conviene adelantar es si el link va por sección del acordeón o si es una página aparte — porque eso condiciona S2 | — |
| **N7** | **Los videos de uso ya grabados.** `app/learn/page.tsx` de v1 enlaza **tres videos de YouTube** que el usuario grabó: guía de resortes (`lY4iRpKh2AM`) y dos ejercicios de armaduras 2D (`vwyqRPN6PNY`, `gXT1ksfbcKM`). No es código: es contenido que ya existe y se pierde si nadie lo anota | Ver abajo | chico |

### N1 · Tres cosas distintas con el mismo nombre

"Guardar" son tres casos de uso que no se resuelven igual:

| Caso | Mecanismo | Qué resuelve |
|---|---|---|
| No perder todo al recargar | `localStorage` | La frustración más común y más barata de evitar |
| Entregar el ejercicio | Descargar/subir un JSON | El caso académico real |
| Mostrárselo al profesor | El modelo serializado en la URL | Compartir sin archivos |

**Recomendación: `localStorage` primero.** Es lo que más molesta hoy y lo más barato.

Todo esto es barato por una decisión ya tomada: los átomos guardan **datos planos, nunca instancias del motor** — está en [`docs/state-pattern.md`](./state-pattern.md). O sea que el estado ya es serializable por diseño, y no hay que inventar un formato: es lo que ya está en los átomos. Lo único a definir es el **versionado** del formato, para que un archivo guardado hoy no explote cuando una tabla gane una columna.

### N4 · La vinculación matriz ↔ modelo es la de mejor retorno

De toda la lista, esta es la que más enseña por unidad de trabajo, y **casi toda la información necesaria ya está calculada**:

- Las etiquetas nudo+eje (`v1x`, `v1z`, …) ya existen en todas las matrices.
- `assembly.steps` ya sabe qué barra tocó qué celdas — es lo que alimenta el resaltado de "celdas que cambiaron en este paso".
- El plan P0 agrega `cellClass` a `MatrixTable`, que es el gancho de estilo que esto necesita.

O sea que hoy esto es sobre todo cablear un `onMouseEnter`. Y lo que responde —*¿por qué aparece un número en esta celda y no en la de al lado?*— es exactamente lo que no se entiende del método matricial.

> **El P0 ya se hizo** (2026-08-12), así que `cellClass` existe y las tres piezas están puestas. **N4 es, de toda esta lista, lo que está más cerca de poder empezarse.**

### N7 · Los videos existen y no están en ningún lado

Son tres videos ya grabados y publicados, o sea trabajo hecho que no cuesta nada recuperar y que se pierde con solo no anotarlo. **La decisión abierta es dónde viven**, y depende de S2: si el contenido educativo termina teniendo su propia zona, los videos son una sección de esa zona; si no, el candidato natural es un enlace desde la página del sistema que cada video explica.

Dos cosas a mirar antes: que los videos **sigan siendo válidos** —la UI de v2 ya no se parece a la de v1, así que una guía de uso puede confundir más de lo que ayuda— y que la miniatura no se cargue de `img.youtube.com` sin pensarlo, porque eso mete un pedido a un tercero en una app que hoy no hace ninguno.

---

## Grupo E — El sistema de errores del original

Sale del barrido del **2026-08-13**: el usuario pidió revisar cómo manejaba los errores v1 —tres átomos derivados que se concatenan, un catálogo de códigos y un "debouncer"— y qué valía la pena rescatar.

> **El análisis completo está en [`docs/errores.md`](./errores.md)**: el contrato de v2, las cuatro trampas del original, qué era realmente el "debouncer" y el bug de input que tapaba. Acá quedan solo las **dos decisiones abiertas** que salieron de ahí.

**El veredicto corto**: la arquitectura de v1 era correcta y v2 ya la tiene (errores como átomo **derivado** del estado, nunca imperativo; mensajes que nombran la fila; resultados bloqueados mientras hay errores). Lo que v1 tenía y v2 **no** son dos ideas, las dos con el cableado mal hecho en el original — o sea que no se copian: se rehacen bien.

| # | Qué | Decisión abierta | Tamaño |
|---|---|---|---|
| **E1** | **Códigos de error estables** (`e114`) y un catálogo que sea la **fuente** de los textos | Ver abajo | chico |
| **E2** | **Canal de advertencias**, separado del de errores bloqueantes | Ver abajo | chico |

### E1 · El catálogo tiene que ser la fuente, no un documento paralelo

v1 tenía `store/errors/errorsCode.ts` con 17 errores, cada uno con `name`, `message`, `typeError`, `errorCode` y `severity`. **Nunca se importó en tiempo de ejecución**: lo único que se usaba era `keyof typeof errorsCode` como tipo, y los textos estaban escritos otra vez a mano en cada `push`. Un catálogo que no es la fuente se desactualiza, y ya lo había hecho: `e211` ("Área no numérica") lleva `errorCode: 210` copiado del anterior, y el aviso del debounce se manda con `errorCode: "e100"`, que en el catálogo es "Nombre de nudo duplicado".

Hoy en v2 los mensajes los tira el motor como texto libre (`throw new Error(...)`), que es simple y funciona, pero un error no tiene identidad: no se lo puede enlazar, contar ni explicar en otro lado.

**Lo que hay que decidir es si hace falta**, y la respuesta depende de N6: si cada error va a poder llevar un *"¿por qué?"* que lleve al contenido teórico —como ya hace el mensaje de mecanismo con `/estabilidad`—, entonces el código estable es el que ancla ese enlace, y conviene **antes** de la Fase 8. Si no, el texto alcanza.

Si se hace, la regla que v1 no cumplió: **el catálogo exporta las funciones que construyen el error**, no constantes que alguien vuelve a tipear. Un mensaje que nombra la fila (`El nudo v3 …`) es una función de sus datos, no una cadena fija — y eso es justamente lo que hizo que en v1 el catálogo quedara decorativo.

### E2 · "Estoy esperando" no es un error

v1 metía un aviso de severidad `warning` en el **mismo array** que los errores, y como los resultados se rendían con `errors.length === 0`, ese aviso los hacía desaparecer. O sea: un warning que bloquea es un error disfrazado.

v2 no tiene el concepto de advertencia: `DomainError` no tiene `severity` y todo lo que entra al panel bloquea. Y ya hay casos que **no deberían bloquear** y hoy no tienen dónde ir: un nudo sin ninguna barra conectada, un modelo que se resuelve pero está mal condicionado, una barra de longitud casi nula. Hoy o se tira todo abajo o no se dice nada.

**La decisión abierta**: si la advertencia es un tercer estado del panel de resultados (se calcula **y** se avisa) o una fila más en el panel de errores con otro color. Dato útil: `ui-custom/alert.tsx` **ya tiene las variantes `warning` e `info`** y ninguna se usa todavía.

---

## Falsos rescates: lo que v1 aparentaba tener

Anotado para que nadie lo "recupere" creyendo que funcionaba, que es la trampa más cara de un barrido como este:

- **Resortes en los nudos de `armor2d`.** Hay columnas en la tabla (`springX`, `springZ`), un diálogo de "condiciones especiales" para cargarlos, y hasta una validación de dominio que impide poner un resorte en un grado de libertad restringido. El valor se guarda en `dataArray.k`… y **nunca se suma a la matriz global**. La rigidez del resorte no entra al cálculo: la app aceptaba el dato y lo ignoraba. Es el mismo caso que las fuerzas internas que `armor3d` declaraba y no calculaba. Los apoyos elásticos siguen siendo una idea válida — pero es una **funcionalidad nueva**, no un rescate.
- **El "debouncer".** No cancelaba el temporizador anterior, así que no era un debounce; y lo que de hecho evitaba el recálculo era una cadena accidental (el aviso desmonta `<Results/>` → nadie lee el átomo → Jotai no lo calcula, porque es perezoso). Existía para tapar un bug de `EderInput`: el valor se confirmaba solo en `onBlur`, pero Enter y el click-away **desmontaban el input** antes. v2 no lo necesita porque `FormulaInput` tiene **un solo camino de confirmación** y el input nunca se desmonta.
- **La exportación a Excel.** `file-saver` está en las dependencias de v1 y no se usa en ningún lado. La Fase 7 del roadmap arranca de cero.
- **Zoom y pan en los diagramas 2D.** `<OrbitControls />` está en el código de `graphic2D.tsx`, **comentado**.

---

## Cuándo volver a este documento

- **Durante el cierre de `/armaduras-2d`**: los grupos **U** y **N** están todos ahí adentro, así que este documento es el que tiene *por qué* de cada uno. El orden y el estado están en [`armaduras-2d-cierre.md`](./armaduras-2d-cierre.md).
- **Antes de arrancar la Fase 8** (contenido educativo): **S2** y **N6** se condicionan mutuamente, y la navbar de hoy es provisional justamente para no adelantar esa decisión.
- **Al cerrar el Tren C** (`frame2d-seismic`), cuando los cinco sistemas base estén completos: es el momento natural para el **grupo M**, que alcanza a todos y toca motor y stores. **Excepción posible: M1a**, que después del análisis del 2026-08-13 quedó en "chico" y no toca ningún store — se puede adelantar sin arrastrar el resto del grupo.
- **Antes de la Fase 8, junto con S2 y N6**: el **grupo E** entero y **N7**. `E1` solo vale la pena si los errores van a enlazar contenido teórico, y `N7` no se puede ubicar hasta saber qué forma tiene la zona educativa.
