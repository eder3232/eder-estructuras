# Diagnóstico y plan de refactor

Este documento diagnostica el estado real de `thesis-structures` (el proyecto anterior, en `D:\programming\repos_clonados\thesis-structures`) y propone un orden concreto para refactorizarlo en este repo. Es un plan vivo: se actualiza a medida que cada fase se completa o cambia de alcance.

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
| C | **frame2d** completo de punta a punta (motor con flexión + patrón de estado del Tren A + visualización del Tren B) ✅ hecho, luego **frame2d-seismic** como extensión real sobre un frame2d ya funcionando (no un fork copiado) ⬅️ siguiente | Frame2d-seismic explícitamente no debe repetir el bug de duplicación encontrado en el diagnóstico — solo se puede extender bien algo que ya está probado de punta a punta, no solo como lógica aislada |
| D | **armor3d** completo (motor con 3 DOF/nodo + three.js) | Su propio tren: no comparte tecnología de visualización con B/C, así que no gana nada por ir empaquetado con ellos |
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

## Próximo paso inmediato

`/springs` y `/armaduras-2d` ya están hechos de punta a punta (springs: commits `d5d041a`/`960a38e`/`932f9e2`; armaduras 2D + visualización SVG: commits `0f55146`/`782aec8`/`828f2e2`), incluyendo la capa de visualización del Tren B (esquema, forma deformada, reacciones). El patrón de estado/resultados está en **[`docs/state-pattern.md`](./state-pattern.md)**; el de visualización, en **[`docs/diagram-pattern.md`](./diagram-pattern.md)** — leer ambos antes de tocar código nuevo de UI. Lo genérico entre sistemas (tablas de matrices, control de decimales, tabla de DOF, y `src/components/custom/diagram-2d/`) vive en `src/components/custom/`, no duplicado por sistema.

`/frame2d` ya está completo de punta a punta (primera mitad del Tren C): `FrameElement2D` en `src/lib/engine/frame2d/` con regresión portada del ejemplo original, momentos de empotramiento perfecto por barra, página con el patrón de estado, y visualización con el DOF rotacional resuelto (empotramiento, arco de momento, color por fuerza axial — ver la sección "El DOF rotacional" de [`docs/diagram-pattern.md`](./diagram-pattern.md)).

### Si estás retomando después de un `/clear`

Hay **dos hilos pendientes independientes**. No dependen entre sí; se pueden hacer en cualquier orden. La recomendación es arrancar por el A, porque cierra el Tren C y desbloquea el Tren D.

**Hilo A — `frame2d-seismic` (segunda mitad del Tren C).** Es la continuación natural. Como extensión real sobre `frame2d`, **no un fork copiado**: ese fue el bug de duplicación diagnosticado en el original, donde `frame2D.ts` de ambos programas era casi idéntico letra por letra. El orden probado sigue siendo motor primero, validado con un test de regresión, antes de tocar estado/UI. Antes de escribir nada: revisar `D:\programming\repos_clonados\thesis-structures\src\programs\frame2d-seismic\` y **diffearlo contra `frame2d`** para aislar qué agrega de verdad el caso sísmico. Lo que quede en común no se copia — se reusa.

**Hilo B — tablas de carga que calculen los FEM.** El mecanismo de momentos de empotramiento perfecto ya está portado y funcionando (ver la sección "Los momentos de empotramiento perfecto (FEM) y el bug de transformación", más arriba en este mismo documento), pero **hoy los 6 valores se cargan a mano por barra**. Falta la UI que los calcule a partir de la carga: distribuida, puntual, momento y distribuida intermedia. Es la UI más grande del frame2d original (`components/edgesTable/fem/`, con imágenes explicativas por tipo de carga). Leer esa sección antes de tocarlo — ahí está la convención de signo y por qué el original transformaba mal.

### Estado de verificación (lo que está y lo que no)

Para no re-verificar de cero ni asumir de más:

- `pnpm test` (17 tests), `npx tsc --noEmit` y `pnpm build` pasan limpios.
- `pnpm lint` da **2 errores preexistentes** en archivos de shadcn/ui (`src/components/ui/carousel.tsx` y `src/hooks/use-mobile.ts`, ambos por `react-hooks/set-state-in-effect`). **No son regresiones y no se tocan**: `ui/` es intocable por convención (ver [`docs/components.md`](./components.md)). Si aparece un tercer error, ese sí es nuevo.
- **Lo que nunca se miró en un navegador**: el arco de momento (`moment-arc.tsx`) y el glifo de empotramiento se verificaron renderizando su markup SVG y comprobando la geometría numéricamente, pero no se vieron con los ojos porque la extensión de Chrome no estaba conectada. Vale la pena un `pnpm dev` sobre `/frame2d` y abrir la sección "5. Forma deformada", donde las reacciones de los empotramientos dibujan arcos reales.
