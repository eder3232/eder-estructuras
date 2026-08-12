# Plan: recuperar la narrativa pedagógica de `/armaduras-2d`

> **Estado: implementado el 2026-08-12.** Los cuatro habilitadores y los seis cambios están hechos, verificados por captura, y con `pnpm test` (51 tests), `npx tsc --noEmit` y `pnpm build` en verde. Lo que el plan no anticipó está al final, en [Qué apareció al implementarlo](#qué-apareció-al-implementarlo). El resto del documento se deja como quedó escrito: es el porqué de cada decisión.

Este documento planifica **una sola actualización, sobre un solo sistema**: `/armaduras-2d`. No es un tren del [roadmap](./refactor-roadmap.md) ni toca el motor compartido — es la reparación de lo que el port perdió respecto del `armor2d` original (`D:\programming\repos_clonados\thesis-structures\src\programs\armor2d\`).

Sale de una comparación archivo por archivo entre las dos versiones, pedida por el usuario el **2026-08-12** después de dos sesiones seguidas de arreglos de UI. La pregunta que la disparó vale la pena dejarla escrita, porque es el criterio con el que hay que juzgar todo lo de abajo: **si esto es un rework, tiene que ser mucho mejor que el original, no peor.**

## 1. Por qué: el rework ganó infraestructura y perdió narrativa

La comparación dio un resultado bastante limpio, y explica por qué la app se siente peor a pesar de estar mejor construida. Lo que mejoró es la infraestructura; lo que se perdió es **todo el andamiaje que explicaba el método**. Un alumno ve la narrativa, no el motor.

| Lo que hacía la versión original | Estado hoy |
|---|---|
| **Matriz de transformación `A` y `Aᵀ`**, con su forma simbólica en cosenos directores al lado de la numérica (`locals.tsx:225-283`) | **No existe.** `local-stiffness-list.tsx` salta de la rigidez axial 2×2 a la global 4×4 rotulada "T·k·Tᵀ", sin mostrar `A` ni el producto |
| **Ecuación global `[F] = [K]·[U]`** con los tres operandos lado a lado (`results.tsx:78-117`) | **No existe.** Del ensamblaje se pasa directo a la partición |
| **La partición como partición**: los cuatro bloques en su posición 2×2 real, con `Fu/Fr` y `Uu/Ur` a los costados (`results.tsx:152-238`) | **Degradada.** `partition-and-solution.tsx` los pone como cuatro tablas sueltas en un `flex-wrap`. Se pierde que son un corte de una misma matriz |
| **Sustitución numérica** de `Uu = Kuu⁻¹·{Fu − Kur·Ur}` y de `Fr = Kru·Uu + Krr·Ur`, con todos los operandos y después el resultado | **Degradada.** Queda una línea de texto con la fórmula y la tabla del resultado. El paso del medio desapareció |
| **KaTeX** en todo el álgebra | **No existe** — `katex` no está en `package.json`. Todo es ASCII: `Kff⁻¹`, `T·k·Tᵀ`, `δ` |
| **Matriz factorizada** `k = E·A·[[1,−1],[−1,1]]`, la forma del libro | **No existe.** Solo el escalar `EA/L` en una línea de texto y la matriz ya multiplicada |
| **Fijar E y A para todas las barras de un saque** (`changePropertiesForAllEdges.tsx`) | **No existe.** Con 15 barras son 30 campos a mano |

### Lo que ya es mejor y no hay que tocar

Igual de importante, para no "arreglar" hacia atrás:

- **Etiquetas nudo+eje (`v1x`, `v1z`, …) en todas las matrices.** El original solo las tenía en un lugar. Es la mejor mejora pedagógica del port.
- **Ensamblaje con las celdas que cambiaron resaltadas** más la leyenda de qué barra aporta dónde (`assembly-steps.tsx:35-56`). El stepper del original mostraba una matriz sin decir qué cambió.
- **Columna "Incógnita a resolver en esta posición"** en la tabla de DOF (`dof-order-table.tsx:26`).
- **Fuerzas internas con la sustitución escrita término a término** (δ y N), más legible que la cadena de matrices del original.
- **Cascada de decimales persistente** (el original tenía un `useState` por tabla que se perdía al desmontar).
- **SVG en vez de three.js** para los diagramas planos, y la deformada superpuesta a la original punteada.

### Lo que queda explícitamente afuera

Este plan es **solo `/armaduras-2d`**. Todo lo que toca el shell de la app o el motor compartido —y el resto de las mejoras de usabilidad que salieron de la misma comparación— está documentado aparte en [`docs/pendientes-comparacion.md`](./pendientes-comparacion.md), agrupado por qué lo excluye y con la decisión abierta de cada punto. No se pierde; se afronta después.

## 2. Habilitadores (van primero y no se ven)

### H1 · `src/components/custom/math.tsx`

Dependencia `katex` y un wrapper propio: `<Math>` (inline) y `<MathBlock>` (display), sobre `katex.renderToString(tex, { throwOnError: false, displayMode })` con `dangerouslySetInnerHTML`. Va en `custom/` por la convención de [`docs/components.md`](./components.md): es propio, no derivado de shadcn.

**No usar `react-katex`**, que es lo que usaba el original: está sin mantener y arrastra peer deps de React 18. El wrapper propio son veinte líneas y no depende de nadie.

El CSS (`katex/dist/katex.min.css`) se importa en `src/app/layout.tsx`. **Antes de escribirlo hay que verificar en `node_modules/next/dist/docs/` cómo Next 16 resuelve CSS importado desde `node_modules`** — es la regla de [`AGENTS.md`](../AGENTS.md), y acá importa de verdad porque el CSS de KaTeX referencia sus fuentes `.woff2` con `url()` relativo.

### H2 · `TrussElement2D.breakdown()`

`src/lib/engine/trusses-2d/truss-element-2d.ts`. Hoy `cos`, `sin` y `eaOverL` son privados, y `stiffness()` arma `transform` y `localStiffness` adentro (líneas 48-64). Como la UI necesita esos intermedios para explicar el método, **hoy hay tres copias de la misma fórmula**: la del motor, la de `local-stiffness-list.tsx:65-71` y la de `internal-forces-table.tsx:51-60`, las dos últimas recalculando desde las coordenadas de los nudos.

Agregar:

```ts
breakdown(): {
  length: number; cos: number; sin: number; eaOverL: number;
  transform: number[][];        // A, 4×2
  localStiffness: number[][];   // k local, 2×2
  globalStiffness: number[][];  // A · k · Aᵀ, 4×4
}
```

y que `stiffness()` devuelva `this.breakdown().globalStiffness`. Es **aditivo y contenido**: no toca `System` ni la interfaz `Element`, así que no alcanza a los otros tres sistemas. Efecto lateral bueno: las matrices que se muestran en pantalla pasan a ser, demostrablemente, las que se usan para calcular.

Test en `truss-element-2d.test.ts`: que `breakdown().globalStiffness` sea idéntica a `stiffness()`, y que multiplicar `A · k · Aᵀ` a mano reproduzca la 4×4.

### H3 · `src/components/custom/matrix-equation.tsx`

Una fila de operandos con operadores de KaTeX entre medio (`=`, `·`, `−`, `⁻¹`, llaves), sin wrap y con su propio `overflow-x-auto`. Es lo que el original resolvía a mano, repetido, con `flex min-w-min items-center` en cada bloque de `results.tsx`.

> **Ojo con D9.** Este componente es exactamente la salida *"una sola fila con scroll horizontal"* que el roadmap evaluó para la deuda **D9** (el stepper que salta de renglón cuando el `flex-wrap` rewrapea) y dejó pendiente por no querer cambiar el layout de todo el panel. Si acá funciona bien, D9 se cierra con el mismo componente en vez de con una grilla de columnas fijas.

### H4 · `MatrixTable`: prop `cellClass`

`src/components/custom/matrix-table.tsx` ya tiene `highlight`, pero es binario (resaltada o no). Agregar un prop opcional:

```ts
cellClass?: (row: number, col: number) => string | undefined
```

Opcional y aditivo, así que los otros tres sistemas que consumen el componente no se enteran.

## 3. Los seis cambios visibles

### C1 · El paso de transformación

`src/app/armaduras-2d/components/results/local-stiffness-list.tsx`, sección 1 del acordeón.

Mostrar la cadena completa `k_global = A · k_local · Aᵀ` con los tres operandos vía `MatrixEquation`, en vez de saltar de la 2×2 a la 4×4. Incluye la forma factorizada `k = EA/L · [[1,−1],[−1,1]]` en KaTeX al lado de la numérica (lo que el original llamaba "sin EA"), y `A` con su forma simbólica en cosenos directores al lado de sus números.

**Es el punto más importante de los seis.** La transformación es lo único que distingue una armadura de un resorte —el motivo por el que existe esta página y no alcanza con `/springs`— y hoy es una caja negra.

### C2 · La ecuación global `F = K·U`

Cierre de la sección 2 (ensamblaje). `assembly.globalStiffness` ya está en `AssemblyResult`; los vectores F y U globales se arman desde `assembly.dofOrder`, los nudos y `solved`.

Mejora sobre el original: **marcar las incógnitas** en F y U con `cellClass`. El original mostraba números en todo sin distinguir dato de incógnita, que es justo lo que confunde; acá ya existe la columna que lo dice en palabras en `dof-order-table.tsx`, así que es coherente decirlo también en color.

### C3 · La partición mostrada como partición

`results/partition-and-solution.tsx`, sección 3.

Encabezar el bloque con **la K global permutada** —libres primero, restringidas después— en una sola tabla, con las cuatro zonas sombreadas y rotuladas `Kff`/`Kfr`/`Krf`/`Krr` vía `cellClass`, y la leyenda explícita: *es la misma matriz, con las filas y columnas reordenadas*. Un alumno entiende la partición cuando ve el corte, no cuando ve cuatro tablas.

Debajo siguen los cuatro bloques sueltos con su stepper, como están hoy: el comentario de `partition-and-solution.tsx:75-80` explica por qué ahí el override de decimales por tabla se justifica de verdad (Kff maneja ~10⁶ y Uf ~10⁻³, y están una al lado de la otra).

### C4 · Las sustituciones numéricas

Misma sección. Para `Uf = Kff⁻¹ · (Ff − Kfr · Ur)` y para `Rr = Krf · Uf + Krr · Ur`: primero la fórmula simbólica en KaTeX, después la misma con los operandos numéricos vía `MatrixEquation`, y recién entonces el resultado.

> **Trampa del original que no hay que copiar**: en `results.tsx:325-328` la sustitución mostraba `u.unrestricted` rotulado como `Ur`. Es el vector equivocado con la etiqueta correcta — el tipo de error que un alumno copia sin dudar.

### C5 · E y A para todas las barras

`components/element-table.tsx` y `store/elements.ts`. Un `atomSetAllElementsNumber` nuevo, y debajo de la tabla dos `FormulaInput` con un botón, como el `changePropertiesForAllEdges.tsx` del original.

De paso, un bug de usabilidad que se encontró planificando esto: `atomAddElement` crea la fila con `area: 0, elasticity: 0` (`store/elements.ts:45-46`) y `TrussElement2D` rechaza área no positiva. O sea que **cada barra nueva rompe los resultados hasta terminar de completarla**. Que herede el área y el E de la última fila.

### C6 · Sanear el ASCII que quede

Barrer los `Kff⁻¹`, `Tᵀ`, `δ` y demás sueltos de `partition-and-solution.tsx` e `internal-forces-table.tsx` y pasarlos por `<Math>`. Sin esto, C1–C4 conviven con texto plano y el contraste se nota más, no menos.

## 4. Orden y verificación

**Orden**: H1 → H2 → H3 y H4 → C1 → C2 → C3 → C4 → C5 → C6. Cada C es un commit.

**Verificación**, con las reglas ya escritas en la sección 5 del [roadmap](./refactor-roadmap.md#5-estado-de-verificación-lo-que-está-probado-y-lo-que-no):

- `pnpm test` (51 tests, incluidos los cuatro de `breakdown()`); `npx tsc --noEmit`; `pnpm build`.
- `pnpm lint` da **2 errores preexistentes** en `ui/`. Un tercero sí sería nuevo.
- Captura por **Chrome headless** con la receta del roadmap. Las secciones 2 a 5 del acordeón arrancan cerradas: hay que tocar el `defaultValue` del `<Accordion>` en `results-panel.tsx`, capturar y revertir.
- **KaTeX hay que mirarlo, no leerlo.** Si el CSS o las fuentes no resuelven, el HTML sale perfecto y en pantalla se ve tipografía del sistema. Es exactamente el tipo de bug que las dos sesiones anteriores encontraron mirando y no calculando.
- El botón de C5 **no se puede probar con clicks**: el repo no tiene entorno DOM. Se verifica sembrando el estado a mano, como está documentado en el roadmap.

## Qué apareció al implementarlo

Lo que el plan no anticipó, para que no haya que redescubrirlo.

**Mirar la app volvió a encontrar lo que los tests no.** Tercera sesión seguida, tercera vez. Los dos problemas aparecieron en la primera captura, con `tsc`, los 51 tests y el build ya en verde:

1. **El encabezado decía `Δ` y la fórmula `δ`.** Los `TableHead` del tema van en `uppercase`, y KaTeX emite los símbolos como texto, así que el `text-transform` heredado se los reescribe. Arreglado en el componente —`Math` y `MathBlock` se aplican `normal-case` a sí mismos, así que ningún call site tiene que acordarse— y anotado como trampa en [`docs/components.md`](./components.md). Es la misma clase de bug que el de `vector-effect` en los SVG: una propiedad heredada que rompe algo que el markup muestra correcto.
2. **Signo doble en la sustitución de <code>δ</code>**: `−-0.6000×0.0000` en cuanto un coseno director da negativo, o sea en la barra `e6` del ejemplo semilla. **Es un bug heredado**, no una regresión: la versión anterior de la tabla concatenaba igual, y nadie lo había visto. Ahora los operandos negativos van entre paréntesis.

**Dos cosas salieron mejor de lo planeado**, las dos por `breakdown()`:

- `transformTransposed` terminó en el `breakdown` en vez de transponerse en la UI. `Aᵀ` es un operando visible de la cadena, no un detalle de cálculo.
- La tercera copia de la fórmula de `cos`/`sin`/`EA/L` —la de `internal-forces-table.tsx`— también se pudo borrar, no solo la de las matrices locales. Las tres implementaciones son ahora una.

**Una limitación conocida**: con 4 decimales y `EA/L` del orden de 10⁴, la cadena `K = A · k · Aᵀ` no entra en 1500 px y el último operando queda fuera de pantalla hasta scrollear. Es el compromiso deliberado de `MatrixEquation` (nunca envuelve), y por eso `K` va **primero**: lo que no se puede perder de vista es el resultado. Quedó anotado como **D10** en el roadmap.
