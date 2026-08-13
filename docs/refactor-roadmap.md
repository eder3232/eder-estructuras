# Diagnóstico y plan de refactor

Este documento diagnostica el estado real de `thesis-structures` (el proyecto anterior, en `D:\programming\repos_clonados\thesis-structures`) y propone un orden concreto para refactorizarlo en este repo. Es un plan vivo: se actualiza a medida que cada fase se completa o cambia de alcance.

> **¿Retomando el trabajo en frío?** El **trabajo activo** está en [`docs/armaduras-2d-cierre.md`](./armaduras-2d-cierre.md) — cerrar `/armaduras-2d` por completo antes de propagar, ya ordenado y autosuficiente. Para el contexto general del proyecto, **[Si estás retomando después de un `/clear`](#si-estás-retomando-después-de-un-clear)** (al final de este documento): estado actual, qué leer, qué falta y qué está verificado. El resto de este archivo es el porqué de las decisiones, útil pero no urgente.

## Resumen ejecutivo

~40,000 líneas en `src`, 5 "programas" independientes (armor2d, armor3d, frame2d, frame2d-seismic, springs), **0 tests**, **0 componentes 3D reutilizados entre programas**, y una capa de dominio que reimplementa el mismo algoritmo (método matricial de rigideces) 5 veces con nombres distintos para los mismos conceptos. El diagnóstico del autor original ("es una desgracia total, en especial three.js") se confirma con evidencia concreta abajo, no es autocrítica exagerada.

## Diagnóstico por área

### 1. Lógica de dominio (la parte que más importa)

Cada programa define su propia versión de `Vertices`/`Edges`/sistema (`Armor2D`, `Frame2D`, `Spring`, etc.) en `src/programs/<programa>/logic/`. **No hay nada compartido en `src/lib`** — ese archivo solo tiene `cn()` para clases de Tailwind. Cada programa reimplementa desde cero: ensamblaje de la matriz de rigidez global, partición en `krr/kru/kur/kuu`, y solución vía `mathjs` (`inv`, `multiply`).

El mismo concepto tiene nombres distintos según el programa:

| Concepto | armor2d / frame2d / frame2d-seismic / springs | armor3d |
|---|---|---|
| Nodo restringido | `isRestricted` | `isRestrained` (`isRestrainedX/Y/Z`) |
| Contenedor de datos del sistema | `this.vertices` / `this.edges` | igual, pero **springs** usa `this.dataVertices` / `this.dataEdges` |
| Tipos de coordenadas/DOF | `xzNumber`/`xzBoolean` (armor2d, ad-hoc) | `xyzNumber`/`xyzBoolean` (armor3d, ad-hoc, **distinto** del anterior) — frame2d/frame2d-seismic usan un tercer sistema, genérico: `IAxisCoordinates<T>`/`IAxisDOF<T>` |

Y métodos que hacen lo mismo, nombrados distinto entre `Armor2D`/`Frame2D` y `Spring`:

```
generateOrderOfDOF()          vs  generateOrderDOF()
generateDataArray()           vs  generateData()
generateDOFPointerInDataArray() vs createDictionary()
buildDisplacements()          vs  buildDisplacement()
calculateInternalForces()     vs  solveInternalForces()
```

`frame2D.ts` de `frame2d` y de `frame2d-seismic` son casi duplicados letra por letra (mismos comentarios, misma clase, mismo `IOrderDOF`) — la versión sísmica es un fork copy-paste con el caso sísmico añadido encima, no una extensión de una base común. `twoDimensionalArray()` y `tablePrinter()` están copiados idénticos en los 5 programas.

**Conclusión**: no son 5 dominios distintos que casualmente se parecen — es el mismo algoritmo (ensamblar K, particionar, resolver, calcular fuerzas internas) escrito 5 veces a mano, con la única diferencia real siendo (a) grados de libertad por nodo (spring=1, armaduras=2/3, pórticos=3) y (b) la fórmula de rigidez de un elemento individual (axial vs. flexión).

### 2. Visualización (three.js)

- **No existe ninguna carpeta compartida** para three.js/2D — cada programa reimplementa `Canvas`, cámara, flechas, soportes y texto desde cero.
- **armor2d, frame2d y frame2d-seismic usan una escena three.js completa (`OrthographicCamera`, `Text3D` con fuente `.json`, `Sphere`, `Line`) para dibujar gráficos que son inherentemente 2D**. Es sobre-ingeniería: fuerza WebGL para algo que un `<svg>` resuelve con una fracción del código.
- Duplicación literal confirmada: `arrow.tsx`, `articulatedSuport.tsx`, `rollerSuport.tsx` son **byte-idénticos** entre `frame2d` y `frame2d-seismic`. `graphic2D.tsx` de ambos difiere en una sola línea (una ruta de import).
- Bug de copy-paste real ya encontrado: `armor2d/components/graphs/graphDeformed/lines.tsx` y `.../graphResults/lines.tsx` son el mismo archivo pegado dos veces, con una variable mal escrita en una copia (`figureRefentialSize` vs `figureReferentialSize`).
- Lógica de cómputo estructural real (`computeMoment.ts`, `computeShear.ts`, ~195 líneas) vive dentro de la carpeta `graphics`/`graphs` — mezclada con la capa de presentación por convención de carpetas, no por diseño.
- 136 `console.log` / bloques comentados en 28 archivos, concentrados justo en los componentes de gráficos.
- `springs` es el único programa sin visualización (ni 2D ni 3D) — decidir si es una omisión a corregir o si nunca hizo falta.

### 3. Infraestructura no usada

`src/db` (Drizzle + `@vercel/postgres`, tablas de usuarios/suscripciones/pagos/cálculos) tiene **cero referencias** desde `src/app`, `src/programs` o `src/components` — es infraestructura de monetización que se dejó scaffolded y nunca se conectó. No es parte de este refactor; si en algún momento se quiere monetizar la app, es una decisión de producto aparte, no algo que arrastrar automáticamente.

### 4. Lo que sí está razonablemente bien

- Dependencias 3D consistentes en versión (no hay drift entre programas, todas vienen del mismo `package.json`).
- El estado de UI (Jotai + immer) está separado del modelo de dominio — la inconsistencia de nombres está en ambas capas, pero al menos son capas distintas, no una sola bola de barro.
- `mathjs` se usa de forma consistente para álgebra lineal en los 5 programas (no hay una mezcla de librerías).

## Principios para el refactor

1. **Un solo motor de cálculo, no cinco.** El método matricial de rigideces es el mismo algoritmo en los 5 programas. Se extrae una vez a un núcleo compartido; cada sistema estructural solo aporta lo que realmente varía (grados de libertad por nodo, fórmula de rigidez del elemento).
2. **Un solo vocabulario.** Node/Element/restrained en vez de vertex/vertice/edge/isRestricted/isRestrained mezclados. Ver tabla de abajo.
3. **Dominio separado de presentación.** El cómputo estructural no vive en la carpeta de gráficos. La visualización consume el resultado del dominio, nunca al revés.
4. **2D no es 3D.** Los sistemas planos (springs, armaduras 2D, pórticos 2D) se dibujan con SVG/Canvas2D. three.js queda reservado para armor3d, que sí es un caso 3D real.
5. **No migrar infraestructura sin usar.** `src/db` no se porta a menos que haya una necesidad de producto concreta y decidida aparte.

## Vocabulario unificado (propuesta inicial)

| Nombre viejo (inconsistente) | Nombre nuevo (único) |
|---|---|
| Vertex / Vertice | `Node` |
| Edge | `Element` |
| `isRestricted` / `isRestrained` | `restrained` (booleano por grado de libertad) |
| `xzNumber`/`xyzNumber`/`IAxisCoordinates<T>` (tres formas distintas) | Un solo tipo genérico parametrizado por cantidad de DOF del sistema (diseño final se define en la Fase 1, no aquí) |
| `generateOrderOfDOF` / `generateOrderDOF` | `buildDOFOrder` |
| `calculateInternalForces` / `solveInternalForces` | `computeInternalForces` |

Esta tabla es un punto de partida, no un contrato cerrado — se termina de definir al implementar la Fase 1, cuando haya que enfrentar el caso real de que springs tiene 1 DOF/nodo y frame2d tiene 3.

## Orden de fases propuesto

**Fase 0-2 (hechas)**: la tentación era migrar programa por programa completo (terminar armor2d de punta a punta, luego armor3d, etc.), pero eso repetiría el error original — cada programa reconstruiría su propia versión del motor antes de que exista una versión compartida probada. Por eso se arrancó de abajo hacia arriba: motor genérico primero, validado contra el caso más simple (springs), luego un segundo caso (armaduras 2D) para confirmar que la abstracción generaliza antes de tocar UI.

**De acá en adelante: trenes por sistema, no por capa.** Se evaluó — y se descartó — hacer "toda la lógica de los 5 programas primero, después todo el UI de los 5": frame2d agrega flexión (un DOF rotacional que es una cantidad físicamente distinta mezclada en el mismo vector, y una matriz de rigidez que depende del momento de inercia, no solo del área) y armor3d es un caso 3D real con three.js — una tecnología de visualización que no comparte con el resto (principio 4). Escribir esa lógica más compleja antes de haber probado el patrón de estado/UI ni una sola vez arriesga tener que retocar 3 sistemas de lógica a la vez si el patrón no encaja. En cambio, cada tren deja un sistema (o grupo chico) **completo de punta a punta** — lógica, estado, UI, resultados — antes de pasar al siguiente, reusando lo ya probado. Los sistemas "plus" (temperatura, defectos de fabricación) quedan bloqueados hasta que los 4 trenes de sistemas base terminen — ver "Fuera de alcance por ahora".

| Tren | Qué | Estado / por qué en este orden |
|---|---|---|
| 0 | Setup de shadcn, convenciones de git/componentes, `NumberInput`/`FormulaInput` | ✅ Hecho — base para todo lo demás |
| 1 | Motor de cálculo genérico (`Node`, `Element` con matriz de rigidez local enchufable, `System` con ensamblaje/partición/solución) + vocabulario unificado, validado portando **springs** (1 DOF/nodo, sin geometría) | ✅ Hecho (commit `3b4a7e5`) |
| 2 | Portar **armaduras 2D** (`TrussElement2D`) al motor: 2 DOF/nodo, rigidez axial con transformación por ángulo, sin tocar `System`/`Element` | ✅ Hecho (commit `11251b0`) — confirma que el motor generaliza de springs a esto |
| A | **springs** (✅ hecho, commits `d5d041a`/`960a38e`/`932f9e2` — página `/springs` real con Jotai de datos planos y resultados pedagógicos por acordeón) y **armaduras 2D** (✅ hecho — página `/armaduras-2d`, 2 DOF/nudo, rigidez axial con transformación geométrica vía `TrussElement2D`) completos de punta a punta, como plantilla única para el resto de los trenes | Con 2 sistemas ya migrados en el motor y en UI se ve el patrón real de uso, no uno hipotético. Springs sirvió además para decidir la mejora pedagógica de resultados (divulgación progresiva, leyendas físicas por paso de ensamblaje) que se replicó en armaduras 2D; con ambos hechos, lo genérico entre los dos (`matrix-table`, decimales, tabla de DOF) se extrajo a `src/components/custom/` |
| B | Capa de visualización 2D compartida en SVG puro (`src/components/custom/diagram-2d/`), reemplazando three.js: esquema no deformado, forma deformada con slider de escala, barras coloreadas por tracción/compresión y reacciones. ✅ Hecho, conectada a `/armaduras-2d` | Separada del motor a propósito — el motor no debería saber cómo se dibuja nada. Documentado en [`docs/diagram-pattern.md`](./diagram-pattern.md) para replicarlo en frame2d/frame2d-seismic |
| C | **frame2d** completo de punta a punta (motor con flexión + patrón de estado del Tren A + visualización del Tren B) ✅ hecho, luego **frame2d-seismic** como extensión real sobre un frame2d ya funcionando (no un fork copiado) ⬅️ pendiente | Frame2d-seismic explícitamente no debe repetir el bug de duplicación encontrado en el diagnóstico — solo se puede extender bien algo que ya está probado de punta a punta, no solo como lógica aislada |
| D | **armor3d** completo (motor con 3 DOF/nodo + three.js) | ✅ Hecho — `/armaduras-3d`. Se adelantó a `frame2d-seismic` por decisión explícita; los dos trenes eran independientes, así que el orden no costó nada. Su propio tren porque no comparte tecnología de visualización con B/C |
| 6 | **Armaduras plus** y **frame plus**: variación por temperatura y defectos de fabricación, vía el hook `equivalentLoad` ya reservado en `Element` (ver "Fuera de alcance por ahora") | Bloqueado hasta que A–D estén completos |
| 7 | Feature nueva: exportación a Excel con fórmulas vivas (ver sección dedicada abajo) | Depende de que el motor tenga una estructura de ensamblaje estable y única — generar el exportador contra 5 clases inconsistentes hubiera significado escribirlo 5 veces |
| 8 | Migración de contenido educativo (`src/content`, sección `learn`/`thesis`) | Bajo riesgo, sin dependencias técnicas fuertes, se hace cuando convenga sin bloquear nada |

## Los momentos de empotramiento perfecto (FEM) y el bug de transformación

El método es el estándar y no se discute: una carga repartida a lo largo de una barra se convierte, con las tablas de siempre, en fuerzas y momentos en sus extremos; la estructura se resuelve **como si las cargas fueran solo nodales**; y al calcular las fuerzas internas de cada barra se le devuelve su carga real por superposición (`f = k·u + FEM`). Eso es lo que hacía el original y es lo que hace este port.

**El bug que sí tenía el original** era de ejes, no de método. El FEM está definido en **ejes locales** de la barra — se confirma mirando `store/fem/loadDistributed.tsx`, que calcula `qL/2` y `qL²/12` y nunca escribe la componente axial, o sea asume la carga perpendicular al elemento. Con eso, de los dos usos que hacía `frame2D.ts`:

- `calculateInternalForces()` los sumaba a las fuerzas locales de extremo → **correcto**.
- `buildForcesFixedEndMoments()` los volcaba directo al vector global **sin multiplicar por `Tᵀ`** → **incorrecto**.

Lo que decide si hace falta transformar es **el ángulo de la barra**, no la dirección de la carga: `T` es la identidad solo en barras horizontales. Por eso el error queda escondido — las cargas distribuidas casi siempre se ponen en vigas horizontales. En una columna, ese `qL/2` perpendicular terminaba sumado en el DOF vertical global en vez del horizontal, o sea empujando la estructura para el lado equivocado.

Cómo quedó acá (`FrameElement2D`):

- `equivalentLoad()` devuelve `−Tᵀ · FEM_local`. Los dos detalles son la transformación y el signo: la carga nodal equivalente es el **opuesto** del FEM.
- `internalForce()` suma `+ FEM_local` a `k_local·u_local`.
- Convención de signo, la misma de las tablas del original para que los números del usuario sirvan tal cual: `q > 0` es carga hacia `−w` local (hacia abajo en una viga horizontal), y el FEM resulta `[0, qL/2, qL²/12, 0, qL/2, −qL²/12]`.

Los tests de `frame-element-2d.test.ts` lo fijan con física, no con valores copiados: viga biempotrada (reacciones `qL/2`, momentos `±qL²/12`), **columna** (la reacción sale horizontal y la vertical da exactamente cero — esa es la regresión del bug), y viga simplemente apoyada (el momento en los extremos da cero porque `k·u` cancela exactamente el `qL²/12`).

Dos cosas que quedan pendientes acá:

- **Las tablas de carga** (distribuida, puntual, momento, distribuida intermedia) que calculan el FEM a partir de la carga, en vez de pedir los 6 números a mano. Es la UI más grande del frame2d original (`components/edgesTable/fem/`, con sus imágenes explicativas por tipo de carga).
- **Peso propio de barras inclinadas**: el input del original no lo podía expresar, porque asumía la carga siempre perpendicular a la barra y nunca llenaba la componente axial. Acá los 6 valores son editables, así que **sí se puede** descomponer la gravedad en componente perpendicular y axial — pero cuando se hagan las tablas del punto anterior, conviene que la de carga distribuida ofrezca explícitamente "perpendicular a la barra" vs. "vertical (gravedad)" y haga la descomposición sola, en vez de dejársela al usuario.

## La exportación a Excel con fórmulas vivas

El requisito real: el usuario cambia fuerza, área o módulo de elasticidad en el Excel exportado, y el archivo **recalcula solo**, sin volver a generarlo desde la app. Eso solo es posible si las celdas contienen fórmulas de Excel de verdad, no valores calculados en JS y pegados como texto.

**La parte fácil**: el álgebra lineal en sí. Excel moderno tiene `MINVERSE()` y `MMULT()` como fórmulas de array dinámico que operan sobre rangos NxN completos — no hace falta escribir eliminación gaussiana celda por celda. Un rango con `=MINVERSE(Kuu)` y otro con `=MMULT(inversa, F)` resuelven el sistema `Ku=F` igual que lo hace `mathjs` en la app, pero como fórmula.

**La parte difícil**: qué celda del Excel corresponde a qué grado de libertad, y qué términos de la matriz de rigidez de cada elemento caen en qué celda de la matriz global — eso sí depende 100% de la topología (cuántos nodos, cuántos elementos, cómo están conectados, cuáles DOF están restringidos). Pero esa es exactamente la información que el motor de la Fase 1 ya calcula para hacer el ensamblaje en JS. La idea es: **reusar el mismo recorrido de ensamblaje del motor, pero en vez de sumar números, emitir una fórmula de Excel (`=SUMA(referencias de celda)`) por cada celda de la matriz global**. Así el generador de Excel no es un sistema aparte por topología — es el mismo motor, con un "modo de salida" distinto.

Riesgos técnicos a resolver antes de comprometerse con esto como feature:

- **Librería para escribir fórmulas en `.xlsx`** (no solo valores): `exceljs` soporta escribir fórmulas y su resultado precalculado (`cell.value = { formula, result }`), a diferencia de `xlsx`/SheetJS en su edición gratuita, más limitada para esto. Hay que confirmar contra la documentación actual de `exceljs`, no asumir de memoria (la misma regla que ya aplicamos con Base UI y mathjs).
- **Fórmulas de array/dinámicas en `.xlsx` generado programáticamente**: `MINVERSE`/`MMULT` como fórmulas de array necesitan definirse correctamente en el rango de salida para que Excel las reconozca al abrir el archivo (comportamiento distinto entre Excel 365 con spilling dinámico y versiones más viejas con fórmulas CSE clásicas). Esto no se sabe si funciona bien hasta probarlo.
- **`result` precalculado obligatorio**: si no se guarda un valor de resultado junto a la fórmula, algunos visores de Excel no recalculan automáticamente al abrir y el archivo se ve vacío o en error hasta forzar un recálculo manual.

**Recomendación concreta**: antes de escribir el generador, hacer un spike manual — construir a mano un Excel con fórmulas vivas para el caso más simple posible (un resorte de 2 nodos, o una armadura de 3 barras) y confirmar que `MINVERSE`/`MMULT` recalculan correctamente al cambiar fuerza/área/E. Recién con eso validado se automatiza contra el motor de la Fase 1-2. Construir el generador antes de validar el mecanismo de Excel sería apostar el diseño completo a una suposición no probada.

## Fuera de alcance por ahora

- `src/db` (usuarios, suscripciones, pagos): no se migra sin una decisión de producto explícita.
- Contenido educativo (`src/content`): se migra en el Tren 8, no bloquea nada antes.
- **Armaduras plus / frame plus** (temperatura, defectos de fabricación): en el método matricial ambos efectos se modelan como una carga nodal equivalente (`F = K·u + F0`, y la fuerza interna pasa de `f = k·u` a `f = k·(u − δ0)`), no como un cambio en la rigidez. Por eso `Element` expone el hook opcional `equivalentLoad()` — que **ya está en uso**, estrenado por los FEM de `FrameElement2D` (ver la sección dedicada arriba), así que el mecanismo está probado de punta a punta y esta fase no arranca de cero. La *implementación* de temperatura/defectos igual queda bloqueada hasta que los Trenes A–D (los 5 sistemas base, completos de punta a punta) terminen, para no diversificar antes de tener una base consistente.

## Qué quedó hecho en cada sistema

> Si venís de un `/clear`, saltá a **[Si estás retomando después de un `/clear`](#si-estás-retomando-después-de-un-clear)** — esta sección es el detalle histórico de cada sistema, aquella es el estado accionable.

`/springs` y `/armaduras-2d` ya están hechos de punta a punta (springs: commits `d5d041a`/`960a38e`/`932f9e2`; armaduras 2D + visualización SVG: commits `0f55146`/`782aec8`/`828f2e2`), incluyendo la capa de visualización del Tren B (esquema, forma deformada, reacciones). El patrón de estado/resultados está en **[`docs/state-pattern.md`](./state-pattern.md)**; el de visualización, en **[`docs/diagram-pattern.md`](./diagram-pattern.md)** — leer ambos antes de tocar código nuevo de UI. Lo genérico entre sistemas (tablas de matrices, control de decimales, tabla de DOF, y `src/components/custom/diagram-2d/`) vive en `src/components/custom/`, no duplicado por sistema.

`/frame2d` ya está completo de punta a punta (primera mitad del Tren C): `FrameElement2D` en `src/lib/engine/frame2d/` con regresión portada del ejemplo original, momentos de empotramiento perfecto por barra, página con el patrón de estado, y visualización con el DOF rotacional resuelto (empotramiento, arco de momento, color por fuerza axial — ver la sección "El DOF rotacional" de [`docs/diagram-pattern.md`](./diagram-pattern.md)).

`/armaduras-3d` cierra el **Tren D**: `TrussElement3D` en `src/lib/engine/trusses-3d/` (la misma barra axial del caso plano, con un coseno director más), página con el patrón de estado, y visualización con three.js documentada en [`docs/diagram-3d-pattern.md`](./diagram-3d-pattern.md). Se hizo **antes** que `frame2d-seismic` por decisión explícita: los dos hilos eran independientes y el orden no tenía costo.

**Sesión de UI sobre `/armaduras-2d`** (2026-08-10, fuera de los trenes). Tres cosas, todas disparadas por mirar la app por primera vez:

- **Arreglo del render de los apoyos** en `diagram-2d/` — alcanza también a `/frame2d`, que comparte el módulo.
- **Botón de insertar una fila en el medio**, que el original tenía (`splice(index + 1, 0, …)`) y el port había perdido sin que nadie lo decidiera. De paso se corrigió un bug que el original también tenía: el nombre de la fila nueva salía de `filas.length + 1`, que repite nombres apenas se borra una fila del medio.
- **Precisión configurable en cascada** (página → bloque → tabla) en vez de un único selector global. El original tenía un selector por tabla con estado local; esto es un superconjunto. Está descrito en [`docs/state-pattern.md`](./state-pattern.md).

Las tres quedaron **solo en `/armaduras-2d`** a propósito: propagarlas es el hilo C del punto 3 de la sección de retomada, y estaba pendiente de que el usuario validara la UX.

Dos cosas que el port mejora respecto del original, además del motor compartido:

- **Fuerzas internas**: `armor3d` nunca las calculaba. Su store declaraba un `internalForces` que quedaba siempre vacío, y la UI no las mostraba. Acá salen de `TrussElement3D.internalForce()` como en cualquier otro sistema. Efecto lateral: los valores de fuerza interna de la regresión **no se pueden cotejar contra la app vieja** — salen de un script Node independiente que además verifica equilibrio nudo por nudo.
- **Resortes de nudo**: el original pedía un `springs: {x, y, z}` por nudo en la UI y en la clase `Vertices`, pero ese valor **nunca entraba al ensamblaje** (`buildGlobal` solo recorre barras; el `dataArray.k` que lo guardaba no se leía en ningún lado). Era entrada muerta, así que no se portó. Si alguna vez se quiere de verdad, es una feature nueva —sumar `k` en la diagonal del DOF correspondiente—, no una regresión a recuperar.

## Si estás retomando después de un `/clear`

Todo lo que hace falta para seguir está en esta sección. Última actualización: **2026-08-13, sesión pedagógica + estabilidad (8 commits)**.

> **Antes que nada: hay una lista de trabajo activa.** El 2026-08-12 el usuario decidió **terminar `/armaduras-2d` por completo antes de saltar a los otros sistemas**, y todo lo pendiente de ese sistema —que estaba repartido entre las deudas de acá abajo y los grupos U y N de [`pendientes-comparacion.md`](./pendientes-comparacion.md)— se juntó y se ordenó en **[`docs/armaduras-2d-cierre.md`](./armaduras-2d-cierre.md)**. Ese documento es de dónde se sigue. Esta sección es el contexto.
>
> **Quedan 11 puntos** y el siguiente es **U1** (encabezados agrupados en la tabla de nudos). La lista se **replanificó el 2026-08-13**: eran 8, y el barrido de v1 sumó **E2** (canal de advertencias) y **M1a/M1b** (los dos checkboxes de orden de grados de libertad del original). El motor gana la capacidad de ordenar los DOF con el valor por defecto de hoy, así que **los otros tres sistemas no cambian**; la UI va solo en `/armaduras-2d`. Ya están hechos: S1, S3, el entorno DOM para tests de componentes, D6 + U4, D10, las matrices que crecen, el desplazamiento unitario, D1, la reciprocidad, la animación de la deformada, el modo práctica, la sección de estabilidad y U3.

**Ninguna de las cinco últimas sesiones movió un tren.** Los 4 sistemas siguen igual de completos y `frame2d-seismic` sigue sin empezar. Las tres trabajaron sobre `/armaduras-2d`, que por eso está bastante más adelante que los otros tres — ver el punto **1.b**, es lo primero que sorprende al abrir otro sistema.

### Qué pasó en las últimas tres sesiones

**2026-08-10** (commits `0813f5d`, `9f9eaa2`, `c906e4b`, `74f9d17`) — arreglos y mejoras de UI. Dejó dos cosas que cambian cómo trabajar: se descubrió **cómo mirar la app sin la extensión de Chrome** (headless por línea de comandos, punto 5), y aparecieron las deudas **D6, D7, D8**.

**2026-08-12, primera parte** (commit `412bb76`) — el usuario miró los controles de decimales y encontró **dos problemas de UX**, los dos arreglados: el desplegable de sección mostraba la frase larga del item cortada por la mitad (`SelectValue` sin children rinde el texto entero del `SelectItem`), y el stepper `− n +` se corría de abajo del cursor en cada click (estaba con `justify-between`, pegado al borde de una tabla que se ensancha al subir decimales). Las trampas quedaron en [`docs/components.md`](./components.md) y [`docs/state-pattern.md`](./state-pattern.md). Dejó la deuda **D9**.

**2026-08-12, segunda parte** (commits `5953e3e` → `4d01a82`, diez commits) — **la sesión más grande de las tres.** El usuario pidió comparar `/armaduras-2d` contra el `armor2d` del proyecto original, archivo por archivo, con el criterio de que *si esto es un rework tiene que ser mucho mejor, no peor*. El resultado, que conviene tener presente porque explica varias decisiones:

> El rework había ganado **infraestructura** (motor con tests, etiquetas nudo+eje en todas las matrices, celdas resaltadas por paso, SVG en vez de three.js) y perdido la **narrativa**: la matriz de transformación `A`/`Aᵀ`, la ecuación global `F = K·U`, la partición mostrada como partición, las sustituciones numéricas y KaTeX. Un alumno ve la narrativa, no el motor — por eso se sentía peor a pesar de estar mejor construido.

De ahí salieron tres cosas, y las tres importan para seguir:

1. **Se implementó la recuperación completa** (el "P0"): está en [`docs/armaduras-2d-plan.md`](./armaduras-2d-plan.md), con una sección final de lo que apareció al hacerlo.
2. **Lo que quedó afuera se documentó en vez de olvidarse**: [`docs/pendientes-comparacion.md`](./pendientes-comparacion.md), cuatro grupos con **la decisión abierta de cada punto**. Nada de eso está en curso. Es el documento a abrir cuando haya que decidir sobre el shell, las unidades, la persistencia o la numeración de DOF.
3. **Aparecieron tres componentes compartidos nuevos** (`custom/math.tsx`, `custom/matrix-equation.tsx`, y el prop `cellClass` de `MatrixTable`) que sirven a los cuatro sistemas aunque hoy solo los use uno.

Dejó la deuda **D10** y **agrandó mucho la superficie del hilo C** (ver el punto 3): propagar ya no son dos funciones, son cinco.

**2026-08-12, tercera parte** (commits `b1ee999`, `b9468e0`) — **el shell de la app**, y la decisión de orden que manda hoy. El usuario pidió revisar todo lo pendiente de `/armaduras-2d` y decidió **terminarlo por completo antes de saltar a otro sistema**, con todo adentro: las deudas de render, el grupo U entero, el grupo N entero, y un entorno DOM para poder probar clicks. Eso quedó ordenado en [`armaduras-2d-cierre.md`](./armaduras-2d-cierre.md). De paso se hicieron los dos puntos del shell que lo destrababan:

- **S1**: la app se llama **Eder Estructuras**, `lang="es"`, y nombre/descripción centralizados en `src/lib/site-config.ts`.
- **S3**: `next-themes` **montado por fin** — estaba instalado desde el principio pero nunca se había montado, así que los tokens `.dark` eran código muerto. Con una **navbar provisional**, porque el toggle tenía que vivir en algún lado y S2 sigue sin decidirse.

Y la primera verificación en oscuro que se hizo nunca (ver el punto 5): los cuatro colores de zona de la partición **funcionan**, y el intento de juzgarlos a ojo **falló** — hubo que medir.

> **La validación del usuario sobre la UI de decimales sigue abierta.** Aprobó los arreglos puntuales que encontró, nunca el conjunto. **Preguntá antes de propagar nada a los otros tres sistemas.**

**2026-08-13** (commits `5a9230d` → `2a75080`, ocho commits) — **la sesión más larga de todas**, y la única que agregó contenido que el proyecto original nunca tuvo. Arrancó cerrando puntos de la lista (D10, matrices que crecen) y terminó en una página de teoría que no estaba en ningún plan.

Salió así: al cerrar el diagnóstico del mecanismo (D1) apareció que **una armadura sin apoyos horizontales se resolvía igual y mostraba números** — `inv` de mathjs solo falla con determinante exactamente cero. El usuario preguntó qué dice la teoría al respecto, dijo que **eso no se lo enseñaron en la cursada**, y pidió una sección que lo explique. De ahí salió `/estabilidad`.

Lo que dejó, ordenado por lo que conviene saber al retomar:

1. **Un bug de fondo que estaba desde siempre**, ya arreglado: el motor ahora rechaza el mecanismo con tres controles (filas nulas, número de condición contra 10¹², y el error de `inv`). Vive en `System.solve()`, así que alcanza a los cuatro sistemas.
2. **Cinco agregados pedagógicos en `/armaduras-2d`** (el plan completo está en [`armaduras-2d-cierre.md`](./armaduras-2d-cierre.md)): el desplazamiento unitario que muestra qué **es** una columna de `K`, el error singular convertido en lección con el mecanismo dibujado, la reciprocidad `k_ij = k_ji` al pasar el mouse, la animación de la deformada, y un modo práctica con dos ejercicios corregidos.
3. **La página `/estabilidad`**, primera de teoría, con su propia lista de navegación (`theoryLinks`) para no decidir de costado la navegación definitiva (S2).
4. **Tres módulos nuevos en el motor**, todos puros y testeados: `mechanism.ts` (diagnóstico, núcleo, Fredholm), `factorization.ts` (`LDLᵀ`) y `unit-displacement.ts`.
5. **`MatrixTable` ganó tres cosas** que llegan a los cuatro sistemas: notación compacta con factor común, etiquetas fijas al scrollear y resaltado de la celda simétrica.

**2026-08-13, segunda parte** — **U3**, el estado vacío del panel de resultados. Lo que conviene saber al retomar: el `ErrorsPanel` se partió en dos, y el **diagnóstico de mecanismo dejó de vivir arriba de las tablas y pasó al panel de resultados** (`armaduras-2d/components/results/mechanism-explanation.tsx`), que es donde corresponde porque no es un dato mal cargado sino una salida del motor. Las alertas rojas siguen arriba, pegadas a las filas que señalan, y el error de mecanismo **se filtra** de ellas para no decir lo mismo dos veces. El detalle está en [`armaduras-2d-cierre.md`](./armaduras-2d-cierre.md).

**Una decisión del usuario que acota lo que sigue**: `System.solve()` **sigue resolviendo con la inversa**, no con la factorización. Fue explícito —quería riesgo cero para el resto de la app— y la página lo aclara en vez de disimularlo. Que el motor factorice queda como mejora posible, anotada abajo.

### 1. Dónde está parado el proyecto

Cuatro sistemas completos de punta a punta — motor con tests, estado, tablas de entrada, resultados pedagógicos y visualización:

| Ruta | Motor | DOF/nudo | Visualización |
|---|---|---|---|
| `/springs` | `src/lib/engine/springs/` | 1 | — (no la necesita) |
| `/armaduras-2d` | `src/lib/engine/trusses-2d/` | 2 (x, z) | SVG (`diagram-2d/`) |
| `/frame2d` | `src/lib/engine/frame2d/` | 3 (x, z, θ) | SVG (`diagram-2d/`) |
| `/armaduras-3d` | `src/lib/engine/trusses-3d/` | 3 (x, y, z) | three.js (`diagram-3d/`) |

Trenes 0, 1, 2, A, B, D ✅ · Tren C a la mitad (falta `frame2d-seismic`) · Fases 6-8 sin empezar.

**Dato útil**: la página de cada sistema arranca con los mismos datos semilla que su test de regresión, así que los números en pantalla se pueden cotejar contra valores ya validados sin calcular nada a mano.

### 1.b Ojo: `/armaduras-2d` ya no es igual a los otros tres

Los cuatro sistemas comparten motor, patrón de estado y estructura de resultados, pero **la UI de `/armaduras-2d` tiene tres cosas que los demás no**. Es a propósito: se hicieron ahí primero para poder mirarlas antes de replicarlas cuatro veces.

| | `/armaduras-2d` | `/springs`, `/frame2d`, `/armaduras-3d` |
|---|---|---|
| Agregar filas | `+` en el encabezado (al final) **y `+` por fila** (inserta debajo) | solo el `+` del encabezado |
| Decimales | cascada **página → bloque → tabla** | un único selector de página |
| Álgebra | KaTeX, con el paso de transformación, la ecuación global, la partición coloreada y las sustituciones numéricas | texto plano, y sin esos cuatro pasos |

Los otros tres **no están rotos**: `useDecimals()` cae en `atomDecimals` fuera de todo scope, así que se comportan igual que siempre. Simplemente les falta la función. Propagarlo son las deudas **D7**, **D8** y **D11**, y conviene hacerlo de una sola pasada por sistema.

**Ojo con la tercera fila: no se copia y pega.** Las dos primeras son cableado casi idéntico entre sistemas; el álgebra no, porque cada sistema tiene la suya. `springs` no tiene transformación —1 DOF, sin geometría, la matriz local ya está en ejes globales— y `frame2d` tiene una `A` de 6×6 con el DOF rotacional adentro, que no es la de 4×2 de una armadura. Lo que sí se reusa tal cual son los componentes: `custom/math.tsx`, `custom/matrix-equation.tsx` y el `cellClass` de `MatrixTable`.

Consecuencia práctica: **si vas a tocar la UI de otro sistema, mirá primero cómo quedó `/armaduras-2d`** — es la referencia, no `/springs`.

### 2. Qué leer antes de escribir código (en este orden)

1. Este documento — el porqué del orden de trabajo y el diagnóstico del proyecto original.
2. [`docs/state-pattern.md`](./state-pattern.md) — **obligatorio antes de armar la página de un sistema nuevo**.
3. [`docs/diagram-pattern.md`](./diagram-pattern.md) si tocás visualización de un sistema **plano**; [`docs/diagram-3d-pattern.md`](./diagram-3d-pattern.md) si es **espacial**. Son módulos hermanos, ninguno importa del otro.
4. [`docs/errores.md`](./errores.md) — **obligatorio antes de tocar algo que produzca, transporte o muestre un error**: el contrato de hoy y las cuatro trampas del sistema del original (el catálogo que no era fuente, el tercio de errores que no llegaba a la pantalla, la validación duplicada, y el "debouncer" que no era un debounce).
5. [`docs/components.md`](./components.md) — qué es intocable en `ui/` y cómo forkear. **Tiene cuatro trampas que ya costaron tiempo cada una**: el `mb-4` de `AccordionContent`, el `SelectValue` que muestra el texto del item, el `text-transform` que reescribe los símbolos de KaTeX, y el patrón "mounted" (`useState` + `useEffect`) que rompe el criterio de lint del repo.
6. [`docs/git-workflow.md`](./git-workflow.md) — commits directos a `main`, Conventional Commits.

**Y antes de tocar `/armaduras-2d`**: [`docs/armaduras-2d-cierre.md`](./armaduras-2d-cierre.md), que es la lista de trabajo activa — qué sigue, en qué orden, qué quedó afuera y por qué.

Los dos de la comparación con el original se leen **cuando toque ese tema**, no antes: [`docs/armaduras-2d-plan.md`](./armaduras-2d-plan.md) si vas a replicar la narrativa pedagógica en otro sistema (ahí está el porqué de cada decisión y lo que salió mal al implementarla), y [`docs/pendientes-comparacion.md`](./pendientes-comparacion.md) si vas a decidir sobre shell, unidades, persistencia o numeración de DOF.

Regla general: **ante una discrepancia, gana el código**. Estos documentos pueden quedar desactualizados; `src/app/<sistema>/` y `src/lib/engine/` no.

### 3. Los hilos pendientes

> **Los tres están en pausa.** Desde el 2026-08-12 el trabajo activo es cerrar `/armaduras-2d` ([`armaduras-2d-cierre.md`](./armaduras-2d-cierre.md)); estos hilos se retoman después. Se dejan acá porque el porqué de cada uno no está en ningún otro lado, y porque el hilo C **cambia de tamaño** con cada cosa que se agregue a `/armaduras-2d`.

Ninguno depende de otro. Cuando se retomen: el **A** cierra el Tren C y deja los 5 sistemas base completos; el **C** conviene hacerlo recién con `/armaduras-2d` terminado, que es justamente la decisión vigente.

**Hilo A — `frame2d-seismic` (segunda mitad del Tren C).** Como extensión real sobre `frame2d`, **no un fork copiado**: ese fue el bug de duplicación diagnosticado en el original, donde `frame2D.ts` de ambos programas era casi idéntico letra por letra. Antes de escribir nada: revisar `D:\programming\repos_clonados\thesis-structures\src\programs\frame2d-seismic\` y **diffearlo contra `frame2d`** para aislar qué agrega de verdad el caso sísmico. Lo que quede en común no se copia — se reusa. El orden probado sigue siendo: motor primero, validado con un test de regresión, antes de tocar estado/UI.

**Hilo B — tablas de carga que calculen los FEM.** El mecanismo de momentos de empotramiento perfecto ya está portado y funcionando (ver la sección "Los momentos de empotramiento perfecto (FEM) y el bug de transformación", más arriba en este mismo documento), pero **hoy los 6 valores se cargan a mano por barra**. Falta la UI que los calcule a partir de la carga: distribuida, puntual, momento y distribuida intermedia. Es la UI más grande del frame2d original (`components/edgesTable/fem/`, con imágenes explicativas por tipo de carga). Leer esa sección antes de tocarlo — ahí está la convención de signo y por qué el original transformaba mal. Ojo con el pendiente que ya está anotado ahí: la tabla de carga distribuida debería ofrecer "perpendicular a la barra" vs. "vertical (gravedad)" y hacer la descomposición sola.

**Hilo C — propagar la UI de `/armaduras-2d` a los otros tres sistemas** (deudas **D7**, **D8** y **D11**). Era el hilo más corto; después de la sesión del 2026-08-12 **ya no lo es**, porque la superficie a propagar creció de dos funciones a cinco. Sigue siendo el que el usuario dejó explícitamente en la puerta: quedó pendiente de que mirara la UI antes de replicarla, y **eso no cambió**.

D7 y D8 son cableado casi idéntico entre sistemas. D11 no: cada sistema tiene su propia álgebra, así que es trabajo de verdad y no copiar y pegar (ver el punto 1.b).

- **D7 (insertar filas)**: en `store/nodes.ts` y `store/elements.ts` de cada sistema, hacer que `atomAdd*` tome un `afterId` opcional y use `insertIndex`/`nextRowName` de [`src/lib/row-names.ts`](../src/lib/row-names.ts) — copiar el cuerpo de `src/app/armaduras-2d/store/nodes.ts`. En las tablas, agregar la columna del `+` por fila.
- **D8 (cascada de decimales)**: en `results-panel.tsx` de cada sistema, envolver todo en `<DecimalsScope id="<sistema>">` y cada `AccordionItem` en su propio scope con el control; en `results/*.tsx`, cambiar `useAtom(atomDecimals)` por `useDecimals()` y sumar `<ScopeDecimalsStepper />` por tabla. Está descrito en la sección "La cascada de decimales" de [`docs/state-pattern.md`](./state-pattern.md).

Al terminar D7 en `/armaduras-3d`, su `element-table.tsx` vuelve a quedar idéntico al de `/armaduras-2d` — ahí es el momento de decidir si se extraen a `src/components/custom/` (ver **D2**).

**Hilo D — recuperar la narrativa pedagógica de `/armaduras-2d`. ✅ Hecho el 2026-08-12.** Salió de comparar la página contra el `armor2d` original archivo por archivo (2026-08-12, a pedido del usuario). El resultado: el port ganó infraestructura y **perdió el andamiaje que explicaba el método** — la matriz de transformación `A`/`Aᵀ`, la ecuación global `F = K·U`, la partición mostrada como un corte de la matriz en vez de cuatro tablas sueltas, las sustituciones numéricas, y KaTeX en todo el álgebra. El plan completo, con sus cuatro habilitadores y el orden de commits, está en [`docs/armaduras-2d-plan.md`](./armaduras-2d-plan.md); lo que la comparación encontró y **no** entró en ese plan quedó documentado aparte en [`docs/pendientes-comparacion.md`](./pendientes-comparacion.md) —shell de la app, numeración de DOF por el usuario, nombres duplicados, unidades, persistencia, vinculación matriz ↔ modelo—, con la decisión abierta de cada punto. **No es un hilo: no está en curso ni bloquea nada**, pero conviene mirarlo al terminar el P0 (deja un punto a un paso) y antes de la Fase 8.

> **Orden respecto del hilo C**: se hizo **D antes que C** justamente para propagar una sola vez. Ahora `/armaduras-2d` está más adelante todavía respecto de los otros tres: además de insertar filas y la cascada de decimales, tiene KaTeX, el paso de transformación, la ecuación global, la partición coloreada y las sustituciones. Nada de eso está en `/springs`, `/frame2d` ni `/armaduras-3d`, y **son sistemas distintos: no se copia y pega**. `springs` no tiene transformación (1 DOF, sin geometría) y `frame2d` tiene una `A` de 6×6 con el DOF rotacional adentro.

Lo que sí quedó listo para reusar en los cuatro: `custom/math.tsx`, `custom/matrix-equation.tsx` y el prop `cellClass` de `MatrixTable`.

**Trampa que ya costó una vez**: `AccordionContent` aplica `[&_p:not(:last-child)]:mb-4`, así que poner un control al lado de una etiqueta en `<p>` desalinea la fila entera. Las etiquetas van en `<span>`. Está explicado en [`docs/components.md`](./components.md).

### 4. Deudas chicas anotadas al pasar

Ninguna bloquea nada. Están acá para que no haya que redescubrirlas, y para poder agarrar una si sobra tiempo:

| # | Qué | Dónde | Tamaño |
|---|---|---|---|
| ~~D1~~ | ✅ **Resuelta el 2026-08-13**, y mucho más grande de lo que decía. No se tradujo el mensaje: se **diagnostica**. Que `Kff` no se pueda invertir significa que la estructura es un mecanismo, así que la app lo dice en castellano, nombra el nudo y el eje sueltos y **dibuja el movimiento**. Buscándolo apareció un bug de fondo: `inv` de mathjs solo falla con determinante exactamente cero, y un mecanismo real daba 10⁻¹⁰ — la app **resolvía igual y mostraba números sin sentido, en silencio**. Ahora hay tres controles (filas nulas, número de condición contra 10¹², y el error de `inv`). Alcanza a los cuatro sistemas. Ver [`armaduras-2d-cierre.md`](./armaduras-2d-cierre.md) | — | — |
| D2 | `element-table.tsx` de `/armaduras-2d` y `/armaduras-3d` **eran** byte-idénticos salvo el import del store, y se dejaron duplicados a propósito (el tercer caso dispara la extracción a `src/components/custom/`). Divergieron el 2026-08-10: la de 2D recibió el botón de insertar por fila. Al propagar **D7** vuelven a coincidir, y ahí conviene decidir si se extraen | `src/app/armaduras-{2d,3d}/components/element-table.tsx` | chico |
| D3 | La forma deformada de `frame2d` es una recta entre nudos. Con flexión el tramo real es una cúbica de Hermite gobernada por los giros de los extremos — mejora pedagógica clara, pero hay que muestrear con las funciones de forma del elemento, no solo mover los extremos | `diagram-2d/deformed-diagram.tsx` | mediano |
| D4 | Los diagramas de corte y momento a lo largo de la barra (`graphShear`/`graphMoment` del original) no se portaron. Son otra vista, no una variante de la deformada | — | mediano |
| D5 | Verificación visual pendiente — ver punto 5. Ya no es "todo": `/armaduras-2d` se miró entera **y en los dos temas**, y el esquema de `/frame2d` también; falta la deformada de `/frame2d` y `/armaduras-3d` (que en oscuro importa más que el resto, porque sus colores pasan por la conversión `oklch → sRGB` de `theme-colors.ts` en vez de por clases de CSS) | — | chico |
| ~~D6~~ | ✅ **Resuelta el 2026-08-12**, junto con U4. El diagnóstico estaba incompleto: el problema no era la distancia a la punta sino que la etiqueta iba **centrada** ahí, así que media volvía sobre su propia cabeza de flecha. Se aplicaron las dos salidas anotadas (correr las etiquetas **y** halo con `paint-order: stroke`, este último en *todo* el texto de los diagramas vía `DiagramLabel`) más una tercera que apareció mirando: subir el margen del `viewBox` del 15% al 28%, porque los números se cortaban contra el borde del lienzo. Ver [`diagram-pattern.md`](./diagram-pattern.md), "Dónde van los números" | — | — |
| D7 | El botón de **insertar una fila en el medio** (`+` por fila) solo está en `/armaduras-2d`. `/springs`, `/frame2d` y `/armaduras-3d` siguen con el `+` del encabezado nada más, o sea solo se puede agregar al final. Es una regresión del port, no una decisión. La lógica ya está lista y probada en `src/lib/row-names.ts`: falta pasar el `afterId` en cada `atomAdd*` y sumar la columna en cada tabla | `src/app/{springs,frame2d,armaduras-3d}/` | chico |
| D8 | La **cascada de decimales** (página → bloque → tabla) solo está cableada en `/armaduras-2d`. Los otros 3 sistemas siguen con el selector único de página: funcionan igual que antes porque `useDecimals()` cae en `atomDecimals` fuera de todo scope, pero no tienen control por bloque ni por tabla. Se propaga envolviendo cada `AccordionItem` de su `results-panel.tsx` y cambiando su `internal-forces-table.tsx` — ver la sección "La cascada de decimales" de [`docs/state-pattern.md`](./state-pattern.md) | `src/app/{springs,frame2d,armaduras-3d}/` | chico |
| D11 | La **narrativa pedagógica** (KaTeX, el paso de transformación, la ecuación global, la partición coloreada, las sustituciones numéricas) solo está en `/armaduras-2d`. Los otros tres siguen con el álgebra en texto plano y sin esos pasos. Los componentes ya son compartidos (`custom/math.tsx`, `custom/matrix-equation.tsx`, `cellClass` de `MatrixTable`), pero **el contenido no se copia**: `springs` no tiene transformación y la `A` de `frame2d` es de 6×6 con el DOF rotacional adentro. Leer [`docs/armaduras-2d-plan.md`](./armaduras-2d-plan.md) antes de replicar | `src/app/{springs,frame2d,armaduras-3d}/components/results/` | mediano |
| ~~D10~~ | ✅ **Resuelta el 2026-08-12.** Medida, no estimada: la cadena pide ~1220 px y en los 976 útiles de `max-w-5xl` **no entra a ninguna precisión que sirva** (con 2 decimales quedan ~1190, con `text-xs` ~1076, con las dos cosas ~1010), y bajar de 2 decimales arruina los cosenos directores de `A`. O sea que las dos salidas anotadas acá no servían: la de los decimales no alcanzaba y la de colapsar los operandos deshacía la narrativa pedagógica de doce días antes. Se ensanchó **la página** de `/armaduras-2d` a `max-w-[84rem]` —el acordeón tiene que nacer ancho, porque `AccordionContent` recorta con `overflow-hidden`— dejándole techo aparte a la prosa. Los otros tres sistemas siguen en `max-w-5xl`: eso es hilo C. Detalle en [`armaduras-2d-cierre.md`](./armaduras-2d-cierre.md) | — | — |
| D9 | El stepper de decimales de una tabla puede **saltar de renglón** al subir decimales: las matrices viven en un `flex flex-wrap` y en la partición ya entran dos por fila a 1400 px, así que ensanchar una que no es la primera de su fila la manda al renglón siguiente y el control se mueve en vertical bajo el cursor. No es el bug de corrimiento horizontal que se arregló el 2026-08-12 (ese pasaba en **cada** click y ya no pasa): esto es un salto único al cruzar el umbral de ancho. Las dos salidas evaluadas: pasar esas filas a una grilla de columnas de ancho fijo (posición 100% estable, pero una matriz 2×2 ocupa la misma columna que una 4×4), o dejarlas en una sola fila con scroll horizontal (nunca rewrapea, pero en pantalla angosta se scrollea en vez de apilarse). Se dejó como deuda a propósito: cualquiera de las dos cambia el layout responsive de todo el panel de resultados | `results/partition-and-solution.tsx` y `results/local-stiffness-list.tsx` (los `flex flex-wrap`) | mediano |
| D12 | **La ecuación no se adapta al tamaño de sus operandos.** `MatrixEquation` pone los operandos en fila y nunca envuelve, que es lo correcto mientras entren. Con la narrativa propagada a pórticos (`A` de 6×6, 18 columnas numéricas) no entra ni con la página ancha, y en pantalla angosta tampoco entra ninguna. Salida anotada: cuando no entra, la **ecuación simbólica en KaTeX arriba** —que no crece nunca— y los operandos numéricos apilados debajo, uno por bloque; la decisión se toma con las dimensiones, no midiendo el DOM. Es también la respuesta al diseño responsive del panel de resultados | `custom/matrix-equation.tsx` | mediano |
| D13 | **Matrices grandes como mapa y no como números.** Pasados unos 12–15 DOF, una tabla de números deja de ser legible aunque scrollee bien. Salida anotada: una grilla de celdas chicas coloreadas por signo y magnitud, con los ceros en blanco y el valor exacto al pasar el mouse. Para un sistema grande **muestra más** que los números: se ve la estructura en banda y qué barra aporta dónde. Se apoya en el mecanismo de N4 (vincular matriz ↔ modelo), así que conviene hacerla después de esa | `custom/matrix-table.tsx` | mediano |
| D14 | **Los pasos de ensamblaje crecen peor que lineal**: es una matriz global (`DOF × DOF`) **por barra**. Con 20 nudos y 40 barras son 40 matrices de 40×40, o sea unas 64.000 celdas en el DOM — deja de ser un problema de ancho y pasa a ser uno de rendimiento. Salida anotada: pasados N elementos, los pasos vienen colapsados y se abren de a uno | `results/assembly-steps.tsx` de cada sistema | mediano |
| D15 | **El motor resuelve invirtiendo, no factorizando.** `System.solve()` hace `inv(kff)` y comprueba la estabilidad con el número de condición; `ldl()` existe (`src/lib/engine/factorization.ts`, con tests) pero **solo la usan la página `/estabilidad` y el bloque de control de la sección 3**. Factorizar sería más rápido, más estable, y el pivote que falla nombraría el grado de libertad sin necesidad de autovalores. **No es un olvido**: el 2026-08-13 el usuario eligió explícitamente no tocar el solver para no arriesgar regresiones, y la página lo aclara en vez de disimularlo. El riesgo es bajo y medible: las regresiones toleran 1e-8/1e-10 y el cambio de redondeo es ~1e-14 | `src/lib/engine/system.ts` | mediano |

### 5. Estado de verificación (lo que está probado y lo que no)

Para no re-verificar de cero ni asumir de más.

**Pasa limpio hoy** (`main`, después del Tren D):

```
pnpm test          # 155 tests, 29 archivos (motor, stores, geometría de diagramas y componentes)
npx tsc --noEmit   # sin salida
pnpm build         # prerrenderiza las 4 rutas + home
```

`pnpm lint` da **2 errores preexistentes** en archivos de shadcn/ui (`src/components/ui/carousel.tsx` y `src/hooks/use-mobile.ts`, ambos por `react-hooks/set-state-in-effect`). **No son regresiones y no se tocan**: `ui/` es intocable por convención. Si aparece un tercer error, ese sí es nuevo.

**Cómo mirar la app sin la extensión de Chrome.** La extensión no se conectó en ninguna sesión hasta ahora, y eso dejó pasar un bug de render que ninguna verificación numérica iba a encontrar (ver abajo). No hace falta la extensión: **Chrome headless saca capturas desde la línea de comandos**, y eso alcanza para revisar una vista.

```bash
"/c/Program Files/Google/Chrome/Application/chrome.exe" --headless --disable-gpu --no-sandbox \
  --user-data-dir="<dir temporal>" --window-size=1400,3000 \
  --screenshot="<ruta absoluta>\shot.png" --virtual-time-budget=12000 \
  "http://localhost:3000/armaduras-2d"
```

Dos detalles que cuestan tiempo si no se saben: el `--screenshot` necesita **ruta absoluta de Windows** y un `--user-data-dir` propio (si no, "Acceso denegado"), y `--window-size` alto captura la página entera de una (no hay scroll). Lo que **no** se puede es clickear: para ver una sección del acordeón que arranca cerrada (la forma deformada es la número 5), hay que tocar `defaultValue` del `<Accordion>` en `results-panel.tsx`, sacar la captura y revertir.

**Lo que ya se miró** (2026-08-10, por headless): de `/armaduras-2d`, el esquema, la forma deformada, las dos tablas de entrada y los controles de decimales; de `/frame2d`, el esquema. Aparecieron dos bugs que **ninguna verificación numérica iba a encontrar**, y las dos lecciones valen más que los bugs:

- El trazo de los apoyos se dibujaba de ~144 px y tapaba el diagrama. El markup SVG era correcto atributo por atributo y la geometría daba bien; lo que fallaba era que **`vector-effect` no es heredable**. Ver [`docs/diagram-pattern.md`](./diagram-pattern.md), "Decisiones técnicas a mantener".
- Los controles de decimales colgaban debajo de su etiqueta. No era la alineación de la fila: **`AccordionContent` le mete `mb-4` a todo `<p>` que no sea `:last-child`**, y al ponerle un control al lado el título dejó de serlo. Ver [`docs/components.md`](./components.md).

Método que funcionó para diagnosticar el segundo: **pintar las cajas con `bg-red-200`/`bg-blue-200`/`bg-green-100` y medir los píxeles sobre la captura**. Con un margen invisible metido en el medio, razonar sobre el CSS lleva a conclusiones equivocadas; medir, no.

**Lo que se miró el 2026-08-12** (también por headless, y esta vez el usuario además lo usó a mano): el desplegable de decimales de sección en estado automático, y los steppers `− n +` de las matrices locales y de las 7 tablas de partición. Los dos arreglos de ese día se confirmaron por captura. Dos detalles del método que sirven para la próxima:

- **Recortar y ampliar la captura con PIL** (`Image.crop` + `resize(..., LANCZOS)`) para leer un control chico. La captura entera a 1400×5200 no deja ver si un texto está cortado; el recorte ×2 sí.
- **No usar `--force-device-scale-factor=2` para ampliar**: cambia el viewport CSS (a 700 px de ancho), el layout se reacomoda y las coordenadas del recorte dejan de valer. Ampliar es cosa del recorte, no del navegador.

**Lo que se miró el 2026-08-12, segunda parte** (headless, tras implementar el P0): las cinco secciones del acordeón de `/armaduras-2d` abiertas, o sea las matrices locales con la cadena de transformación, la ecuación global, la partición coloreada, las sustituciones y la tabla de fuerzas internas. **La primera captura encontró dos problemas con los tests, `tsc` y el build ya en verde** — el encabezado que decía `Δ` mientras la fórmula decía `δ`, y un signo doble heredado del original. Tercera sesión seguida en que pasa lo mismo.

Dos cosas del método que sirven para la próxima:

- **KaTeX hay que mirarlo, no leerlo.** Contar los `class="katex"` del HTML no prueba nada: si el CSS o las fuentes no resuelven, el DOM sale perfecto y la pantalla muestra tipografía del sistema con los símbolos apilados mal. Lo que sí sirve como chequeo rápido en el HTML es `katex-error`, que cuenta las fórmulas que no parsearon (debe dar 0).
- **El dev server puede estar ya levantado.** Si `pnpm dev` falla con "Another next dev server is already running", es el del usuario en el 3000 sirviendo este mismo repo: usalo, no lo mates.

**Lo que se miró el 2026-08-12, tercera parte** (headless, al montar el shell): `/armaduras-2d` entera **en los dos temas**, forzando cada uno. Resultado y método, que es lo que sirve para la próxima:

- **Los cuatro colores de zona de la partición funcionan en oscuro.** Es lo que hasta ese día figuraba acá mismo como afirmado *por construcción y no por captura*. Distancias RGB medidas contra el fondo: sky 80, emerald 61, amber 80, violet 90 — se distinguen del fondo y entre sí.
- **Y el ojo se equivocó.** A simple vista parecía que `Kff` (sky) se perdía contra el fondo; medir lo desmintió. Es la misma lección del `mb-4`, ahora en color: **sobre una captura hay que medir, no mirar**. La receta es la moda de color de la zona contra la moda del fondo, con `collections.Counter` sobre los píxeles (está escrita en [`armaduras-2d-cierre.md`](./armaduras-2d-cierre.md)).
- **Para forzar un tema en headless**: agregarle `forcedTheme="light"` o `"dark"` al `<ThemeProvider>` de `layout.tsx`, capturar y **revertir**. Sin eso, headless resuelve `prefers-color-scheme` por su cuenta y no necesariamente da el tema que se quiere ver.
- **Truco que ahorra tiempo**: para mirar una sección del acordeón, abrir *solo* esa en el `defaultValue`. Queda arriba y se recorta sin buscarla dentro de una captura de 16000 px.

**Lo que se miró el 2026-08-13** (headless, ocho commits): el bloque del desplazamiento unitario, el diagnóstico del mecanismo en sus dos formas (nudo suelto y mecanismo global), el modo práctica en **los dos temas**, y la página `/estabilidad` entera, también en los dos temas. Cuatro cosas del método que sirven para la próxima:

- **Sembrar un modelo distinto y revertirlo** es la técnica que más rindió: una armadura de 8 nudos para ver las matrices grandes, una sin apoyos horizontales para el mecanismo, un nudo sin conectar para el otro caso. El modelo semilla de 4 nudos no muestra ninguno de esos problemas.
- **Headless no scrollea.** Para ver una matriz *scrolleada* el `#fragmento` no sirve (dos capturas idénticas); lo que funcionó fue **`dir="rtl"` en el contenedor**, que lo hace arrancar en el extremo derecho.
- **La captura corrigió un texto, no solo un layout**: en la página de estabilidad, el pivote falla en `v3x` y se afirmaba que ahí "no hay nada que se oponga", cuando `v3` está perfectamente sujeto. En un mecanismo global el pivote dice **dónde se agota el cálculo**, no quién lo causó.
- **Medir siguió ganándole al ojo**: el resaltado de la celda simétrica quedaba a 8/255 del color de zona de la partición — a simple vista, el mismo verde.

**Lo que se miró al cerrar U3** (headless, los cuatro estados del panel de resultados sembrados a mano y revertidos, y los dos temas en el estado de error):

- **La captura encontró algo por quinta sesión seguida**, con los 155 tests, `tsc` y el build en verde: la sección **«Esquema» tenía el mismo agujero** que U3 venía a tapar en los resultados —el diagrama genérico devuelve `null` sin nudos y quedaba el título solo—. Se tapó con el mismo componente.
- **Medir siguió siendo el método**: el título del bloque queda a 354 (claro) y 277 (oscuro) de distancia RGB del fondo, y su borde punteado da 42 en oscuro contra los 52 del borde de la caja del esquema — el mismo token, la diferencia es el antialias de la línea cortada.
- Sembrar un estado degenerado se hace igual que un modelo distinto: tocando el valor inicial de `atomNodesBase`/`atomElementsBase` (`[]`, un `filter`, un `map`), capturar y **revertir**.

**Lo que sigue sin mirarse:**

- **Los otros tres sistemas después de los cambios compartidos de esta sesión.** `MatrixTable` (notación compacta, etiquetas fijas), el contexto de escala de los diagramas y el botón de animar llegan a `/springs`, `/frame2d` y `/armaduras-3d` sin que se los haya vuelto a mirar. Se capturó `/springs` y `/frame2d` **después de la notación compacta** y estaban bien; lo que **no** se volvió a ver es `/frame2d` con el botón de animar y con los números del diagrama ya escalados. Es lo primero a mirar si algo se ve raro ahí.
- **El diagnóstico del mecanismo en 3D.** `System.solve()` lo aplica a los cuatro sistemas, pero `nullSpace`/`eigs` solo se probó en matrices planas. En 3D los modos de cuerpo rígido son **6**, no 3, y eso nunca se ejercitó.

- ~~**`/frame2d`**, sección "5. Forma deformada"~~ — ✅ **mirada el 2026-08-12**, al cerrar D6 + U4. Valió exactamente lo que prometía: apareció el número de la reacción horizontal **cortado por el borde del lienzo** y el del momento **encima** del de la reacción vertical, en los dos empotramientos. Los dos arreglados. El arco de momento en sí (geometría, sentido de giro) se ve bien.
- **`/armaduras-3d`**: la escena entera. Sí se comprobó que la ruta responde 200 con las tablas y las matrices locales ya calculadas en el HTML, que `pnpm build` la prerrenderiza, y que `src/app/armaduras-3d/store/results.test.ts` fija que el store arma los vectores de 3 componentes en el orden correcto (cruzar `y` con `z` daría números plausibles pero falsos, y ninguna revisión visual lo detectaría). Falta lo puramente visual: encuadre inicial de la cámara, legibilidad de los glifos de apoyo, y que las etiquetas DOM (`<Html>` de drei) queden donde deben.
- **Modo oscuro en `/springs`, `/frame2d` y `/armaduras-3d`.** Desde el 2026-08-12 el tema **se puede activar** (`next-themes` montado, punto **S3** ya hecho), y `/armaduras-2d` se miró entera en oscuro — pero los otros tres no. Para la escena 3D importa más que en SVG, porque los colores pasan por la conversión `oklch → sRGB` de `theme-colors.ts` en vez de por clases de CSS: eso es una lectura, no una suscripción, así que **hay que verificar que la escena se repinte al cambiar de tema**, no asumirlo.
- ~~**El desplegable de sección en estado `Fijo (n)`**~~ — ✅ **cubierto el 2026-08-12** por un test de componente que abre el desplegable y elige un valor (`decimals-scope.test.tsx`). Sigue sin haber una *captura* de ese estado: lo que se afirma es que el rótulo cambia a `Fijo (n)` y que la tabla lo sigue, no cómo se ve la caja.
- ~~**El click del toggle de tema**~~ y ~~**ningún click, en ninguna parte**~~ — ✅ **resueltos el 2026-08-12**: el repo ya tiene entorno DOM (`happy-dom` + testing-library, pedido por archivo con el docblock `// @vitest-environment happy-dom`; las decisiones están en [`armaduras-2d-cierre.md`](./armaduras-2d-cierre.md)). Ejercitados: el toggle de tema (escribe y saca la clase `dark` de `<html>`), el stepper de decimales entero —incluida la secuencia de clicks seguidos que antes solo se afirmaba por layout—, el `↺`, el «Restablecer» en cascada y las tres acciones de la tabla de barras, «Aplicar a las N barras» incluido. **Y los desplegables también**: se dio por hecho que un `Select` de Radix no iba a abrirse en happy-dom por los eventos de puntero, se probó antes de escribirlo acá, y abre bien. Eso cerró de paso otra deuda de esta lista — el desplegable de sección en estado `Fijo (n)`, que solo se podía ver sembrando el átomo a mano.

  Lo que **no** cambió: seguir mirando la app. Las dos verificaciones encuentran cosas distintas y ninguna reemplaza a la otra — headless muestra lo que el markup no deja ver (un texto cortado contra el borde, un color que no contrasta), los tests muestran lo que la captura no puede tocar.

**Truco para verificar sin poder clickear**: sembrar temporalmente el estado inicial del átomo, sacar la captura y revertir. Con `atomDecimalsByScope` en `src/components/custom/decimals.ts`, por ejemplo:

```ts
export const atomDecimalsByScope = atom<Record<string, number>>({
  "armaduras-2d/partition": 2,        // toda la sección en 2
  "armaduras-2d/partition/uf": 6,     // salvo Uf, fijada en 6
});
```

Eso alcanzó para confirmar que la herencia resuelve bien y que se distingue a simple vista una tabla en automático de una fijada. **Acordate de revertirlo antes de commitear.**

**Pendiente de validación del usuario**: la UX de los controles de decimales de `/armaduras-2d` se rehízo el 2026-08-10 (rótulo "Automático" en vez de "heredar", stepper `− n +` por tabla, `↺ Restablecer` por bloque). El usuario la miró el **2026-08-12** y encontró dos problemas, los dos arreglados ese día (el texto cortado del desplegable y el stepper que se corría del cursor — ver el detalle al principio de esta sección de retomada). **Eso no es el visto bueno al conjunto: sigue sin darlo, así que no propagues nada a los otros tres sistemas sin preguntar.** El argumento es el mismo de antes y ahora tiene evidencia: dos revisiones visuales dieron dos problemas cada una, y cambiar algo en un sistema es barato mientras que en cuatro no. Preguntá primero; si dice que sí, el hilo C se destraba y son D7 + D8 juntas.

Un `pnpm dev` y mirar lo de arriba es media hora bien gastada apenas haya navegador de verdad.

**Si hace falta regenerar valores esperados de una regresión**: los de armaduras 2D y 3D salieron de scripts Node aislados, escritos aparte y **sin reutilizar código del repo** (ensamblaje y eliminación gaussiana propios), que además verifican equilibrio nudo por nudo. Esos scripts fueron temporales y no están versionados a propósito: el valor está en el test, no en el script. Si necesitás otros, escribí uno nuevo con el mismo criterio — reusar el motor para generar los valores que validan al motor no probaría nada.
