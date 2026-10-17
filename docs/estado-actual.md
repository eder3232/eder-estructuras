# Estado actual del proyecto (2026-10-17, cierre de `frame2d-seismic`)

> **Empezá acá si retomás en frío.** Este documento es el estado accionable: qué está hecho, qué falta, qué no está verificado y qué leer antes de tocar cada cosa. El README es el mapa del proyecto (páginas, estructura, qué doc leer); la lista de avances está en [`historial.md`](./historial.md); el roadmap ([`refactor-roadmap.md`](./refactor-roadmap.md)) tiene el diagnóstico del proyecto original y la historia hasta el 2026-08-14.

## 1. Dónde está parado

**El objetivo es terminar la v1**, sistema por sistema. **Los cinco sistemas están cerrados para la v1** (el último, `frame2d-seismic`, el 2026-10-17):

| Sistema | Cerrado | Detalle |
|---|---|---|
| `/armaduras-2d` | 2026-08-14 (Excel y clasificación el 2026-10-14) | [`armaduras-2d-cierre.md`](./armaduras-2d-cierre.md), [`armaduras-2d-plan.md`](./armaduras-2d-plan.md), [`excel-export.md`](./excel-export.md) |
| `/springs` | 2026-10-14 | [`springs-v1.md`](./springs-v1.md) |
| `/armaduras-3d` | 2026-10-16 | [`armaduras-3d-v1.md`](./armaduras-3d-v1.md) |
| `/frame2d` | 2026-10-17 | [`frame2d-v1.md`](./frame2d-v1.md) |
| `/frame2d-seismic` | 2026-10-17 | [`frame2d-seismic-v1.md`](./frame2d-seismic-v1.md) (la E.030 2026 y la E.060, leídas en los PDF oficiales, en su sección 3) |

Además está la página de teoría [`/estabilidad`](../src/app/estabilidad), y desde el 2026-10-17 **una home de verdad** (`src/app/page.tsx`, con sus datos e imágenes en `src/app/_home/`): el método en cuatro pasos, una tarjeta con foto por sistema y lo que tienen todos. Las fotos son ilustrativas, generadas con Gemini (`gemini-3-pro-image`) y pasadas a WebP.

**Está en producción en https://tesis.eder3232.com** (desde el 2026-10-17). El código está en el repo **público** [`eder3232/eder-estructuras`](https://github.com/eder3232/eder-estructuras), conectado al proyecto de Vercel **`eder-estructuras`** (cuenta `eder3232s-projects`, también en https://eder-estructuras.vercel.app): **cada push a `main` despliega a producción**. El original sigue público en su proyecto `thesis-structures`, ahora solo en **https://thesis-structures.vercel.app**: el subdominio se le pasó al refactor con el endpoint de *move* de Vercel. El DNS de `eder3232.com` lo maneja Vercel (nameservers `vercel-dns.com`), así que mover un subdominio entre proyectos no toca registros.

**No hay una tarea anotada esperando. Lo siguiente es preguntarle al usuario qué sigue**: con los sistemas cerrados quedan las fases 6 a 8 del roadmap (sección 3), y antes de la 8 conviene decidir S2 y N6. `pnpm build` compila limpio al cierre del 2026-10-17 (ver sección 6).

## 2. Qué tiene cada sistema

`✅` hecho · `—` no aplica (y por qué) · `✗` falta

| Función | `/armaduras-2d` | `/springs` | `/armaduras-3d` | `/frame2d` |
|---|---|---|---|---|
| Bugs de la revisión para la v1 | ✅ | ✅ (6) | ✅ (6) | ✅ (8, más 2 del motor) |
| Estado vacío y por qué no hay resultados (U3) | ✅ | ✅ | ✅ | ✅ |
| Advertencias (E2) | ✅ | ✅ | ✅ | ✅ |
| Clasificación `g` cruzada con el motor | ✅ `b+r−2n` | ✅ `b+r−n` | ✅ `b+r−3n` | ✅ `3b+r−3n` |
| Verificación de equilibrio (N5) | ✅ | ✅ | ✅ | ✅ con ΣM respecto del origen |
| Nota de unidades (U5) | ✅ | ✅ | ✅ | ✅ |
| Insertar fila en el medio (D7) | ✅ | ✅ | ✅ | ✅ |
| Decimales por sección y por tabla (D8) | ✅ | ✅ | ✅ | ✅ |
| Combobox buscable Desde/Hacia (U2) | ✅ | ✅ | ✅ | ✅ (también la barra de una carga) |
| Encabezados agrupados (U1) | ✅ | — 3 columnas | ✅ | ✅ |
| Orden de grados de libertad (M1a/M1b) | ✅ | ✅ | ✅ | ✅ |
| Narrativa en KaTeX (D11) | ✅ | ✅ sin transformación | ✅ | ✅ con `F = K·U + FEM` |
| Matrices grandes: apilada, pantalla completa, `K` como mapa, pasos cerrados | ✅ | ✅ | ✅ | ✅ |
| Modo práctica | ✅ | ✅ | ✅ bloque 3×3 | ✅ bloque 3×3 global |
| Mecanismo explicado en texto | ✅ | ✅ | ✅ | ✅ |
| Mecanismo dibujado | ✅ | — sin dibujo | ✅ | ✅ |
| Tabla ↔ dibujo por hover (N3) | ✅ | — sin dibujo | ✅ | ✅ (y las cargas) |
| Matriz ↔ modelo por hover (N4) | ✅ | — | v2 | v2 |
| Desplazamiento unitario | ✅ | — v2 | v2 | v2 |
| Persistencia con «Deshacer» (N1) | ✅ | ✅ | ✅ | ✅ |
| Ejemplos precargados (N2) | ✅ 3 | ✅ 3 | ✅ 3 + el inicial | ✅ 3, con cargas en barras |
| Excel con el método vivo | ✅ con imagen | ✅ sin imagen | ✅ sin imagen | ✅ sin imagen, FEM vivo |
| Tests del store | ✅ | ✅ | ✅ | ✅ |
| Página ancha `max-w-[84rem]` | ✅ | — `max-w-5xl` alcanza | ✅ | ✅ |
| **Cargas en barras y FEM calculado** | — | — | — | ✅ (solo pórticos) |
| **Diagramas N, V, M** | — | — | — | ✅ (solo pórticos) |
| **Deformada real entre nudos** | — recta es exacta | — | — recta es exacta | ✅ (solo pórticos) |

**`/frame2d-seismic` no tiene columna propia** porque el procedimiento de cada caso es el de `/frame2d` (los mismos componentes, con la vista de ese caso): tiene todo lo de esa columna salvo **la clasificación** (con el diafragma la cuenta `3b + r − 3n` no vale, y no se muestra) y **el FEM a mano** (no tiene caso). Lo propio: casos de carga, la E.030 paso a paso, diafragma rígido, rigidez lateral por condensación, derivas, combinaciones E.060 editables, envolvente dibujada, tres ejemplos y Excel con el sismo vivo.

## 3. Pendientes por hacer

**De los sistemas, nada**: los cinco están cerrados para la v1. Lo que queda, en el orden en que conviene encararlo (el orden lo decide siempre el usuario):

1. **Decidir qué sigue** —no hay nada empezado—. Las opciones son las fases del roadmap que faltan:
   - **Fase 6, temas del curso** que quedaron para la v2: variación de temperatura, defectos de fabricación y apoyos inclinados (ver la sección 4).
   - **Fase 8, contenido educativo**. Antes hay que decidir **S2** (la navegación definitiva: la barra de hoy es provisional) y **N6** (el contenido teórico enlazado desde los sistemas). Las dos están planteadas, con sus opciones, en [`pendientes-comparacion.md`](./pendientes-comparacion.md).
   - **El grupo M**: ese doc marcaba el cierre del Tren C (este) como el momento para encararlo. De él queda solo **M2** —validar nombres repetidos de nudos y barras, que hoy pasan sin aviso y dejan ambiguas las etiquetas de las matrices—; es chico y alcanza a los cinco sistemas.
2. **La v2 de cada sistema**, decidida en cada cierre: sección 4.
3. **Las deudas abiertas** (D9, D12, D15, D16, D17) y los detalles chicos vistos: sección 5.
4. **Lo que no está verificado**: al final de la sección 6.

El resto de esta sección es el resumen del último sistema cerrado.

### `frame2d-seismic` (cerrado el 2026-10-17)

**Cerrado.** Todo está en [`frame2d-seismic-v1.md`](./frame2d-seismic-v1.md): los bugs del original (S1 a S9: los factores 1.4/1.7 nunca entraban al cálculo, no había combinaciones de norma, la «envolvente» comparaba contra un solo número y nunca se dibujaba), la normativa leída en los PDF oficiales (**E.030 2026**, modificada por la RM 183-2026-VIVIENDA, y **E.060 2009**), el alcance y el plan por pasos.

Resumen del alcance (decidido por el usuario el 2026-10-17):

- **Entran los tres niveles**: casos CM/CV/CS con combinaciones y envolvente; el generador sísmico estático E.030 (V = ZUCS/R·P, αᵢ, Fᵢ); y **diafragma rígido, rigidez lateral por condensación estática y derivas**.
- **Las combinaciones vienen de la E.060 por defecto** (1.4CM+1.7CV, 1.25(CM+CV)±CS, 0.9CM±CS) y son editables.
- Es **una extensión de `/frame2d`, no un fork**: los casos de carga son exclusivos de este módulo (decisión del 2026-10-17), y `/frame2d` no cambia de comportamiento.
- **Tocó el motor**: el diafragma hace que varios nudos compartan un índice global en `System` (`addDiaphragm`), y `src/lib/engine/seismic/` tiene la E.030, la condensación, las derivas y las combinaciones (pasos 1 y 2).
- **Tocó `/frame2d` sin cambiarle el comportamiento**: el cálculo salió a funciones puras y los componentes de resultados leen de `Frame2DViewProvider` (paso 3). Tres piezas genéricas ganaron algo opcional: la columna «Diafragma» del equilibrio, «todo el nivel» en la tabla de grados de libertad y `skipCrowdedLabels` en el dibujo de esfuerzos. Y el esquema plano esquiva choques del nombre de una barra (D17 a medias).

Dos cosas de la norma que son fáciles de pasar por alto: para el cortante estático, C = 2.5 en todo 0 ≤ T ≤ T_P (18.3, el tramo nuevo 1 + 7.5T/T_P no aplica); y los desplazamientos se calculan **sin** el mínimo C/R ≥ 0.11 (50.3).

### Después de los sistemas: lo que hay que preguntarle al usuario

Las fases 6 a 8 del roadmap: armaduras/pórticos plus (temperatura, defectos de fabricación, apoyos inclinados — la Fase 6, ver «v2» abajo), y el contenido educativo (Fase 8), que depende de **S2** (la navegación definitiva; hoy la navbar es provisional) y **N6** (contenido teórico enlazado), ver [`pendientes-comparacion.md`](./pendientes-comparacion.md).

## 4. Lo que quedó para la v2

Decidido por el usuario en cada cierre:

- **Temas del curso** (de `/armaduras-2d`, 2026-10-14): **variación de temperatura** y **defectos de fabricación** (entran como carga nodal equivalente, `N = k·(u − δ₀)`; el motor ya tiene el gancho `Element.equivalentLoad()`), y **apoyos inclinados** (rotar los grados de libertad de un nudo; toca el motor y el Excel).
- **`/springs`**: el esquema topológico (nudos en fila, resortes en zigzag, «no está a escala») y lo que depende de él: N3, N4, desplazamiento unitario y mecanismo dibujado.
- **`/armaduras-3d`**: N4 (matriz ↔ modelo), desplazamiento unitario, Excel con imagen, `K` por bloques de nudo, D16 y vistas predefinidas (planta/elevación).
- **`/frame2d`** (2026-10-17, delegado al criterio de estabilidad): N4, desplazamiento unitario, el ejercicio de calcular el FEM de una carga, los diagramas en el Excel y el Excel con imagen.
- **`/frame2d-seismic`** (2026-10-17, sección 4 de su doc): el sismo vertical (artículo 38) como un cuarto caso, la alternancia de la carga viva (E.060 8.9), el análisis modal espectral (el paso natural después de la rigidez lateral), la separación entre edificios (artículo 52) y Z/U/S/R₀ como selectores de las tablas. Y detalles vistos: la clasificación con el diafragma, el diafragma dibujado en el esquema, nombre accesible en los campos de la E.030 (`FormulaInput` no acepta `aria-label`), la fila de un nivel que enciende solo su primer nudo, y «Procedimiento del caso …» es un `h2` adentro de la sección «1.», que también es `h2`.

## 5. Deudas abiertas

La tabla numerada con el detalle está en el roadmap, sección 4. Estado al 2026-10-17:

| # | Qué | Estado |
|---|---|---|
| D2 | Las tablas de barras de las dos armaduras | ✅ resuelta: una sola, `custom/truss-element-table.tsx` |
| D3 | Deformada de `frame2d` como recta | ✅ resuelta el 2026-10-17 (`member-deflection.ts`: Hermite + flecha biempotrada; [`frame2d-v1.md`](./frame2d-v1.md), paso 5) |
| D4 | Diagramas de corte y momento | ✅ resuelta el 2026-10-17 (`member-diagrams.ts`, N/V/M exactos; paso 4) |
| D5 | Verificación visual pendiente | ✅ la deformada de `/frame2d` se miró y se midió el 2026-10-17 |
| D7, D8, D11 | Insertar filas, decimales en cascada, narrativa | ✅ en los cuatro sistemas |
| D9 | El stepper de decimales puede saltar de renglón | abierta, afuera a propósito |
| D12 | La ecuación que no se adapta a sus operandos | mitigada: «Ver apilada» y «Pantalla completa» (`custom/chain-equation.tsx`, `MatrixEquation expand`); el responsive sigue abierto |
| D13 | `K` como mapa | ✅ resuelta (`MatrixTable heatmap`, pasados 19 grados de libertad) |
| D14 | Pasos de ensamblaje que crecen | ✅ resuelta (`custom/assembly-steps.tsx`, cerrados pasados 12) |
| D15 | El motor invierte en vez de factorizar | abierta **por decisión del usuario** |
| D16 | El esquema no dibuja los desplazamientos prescritos | abierta (en 2D, 3D y pórticos) |
| D17 | Las etiquetas no se conocen entre sí | **a medias** en el esquema: desde el 2026-10-17 el nombre de una barra esquiva los nombres de los nudos y los números de las fuerzas (al 25%, si choca al 50% o al 75%, paso 7 de `frame2d-seismic-v1.md`); siguen sin conocerse los nombres de nudos con las flechas de una carga (el nudo «c» del pórtico a dos aguas de `/frame2d`), y en 3D depende del ángulo. **Resuelta en los diagramas N/V/M** de `/frame2d` y en la envolvente sísmica |

Detalles chicos vistos y no resueltos: en el Excel de las dos armaduras, en el renglón de propiedades de cada barra el valor queda pegado al rótulo siguiente («3.5 Cx = Δx/L»); el ruido numérico (`-2.22E-15`) sale tal cual; en `F = K·U` los renglones de `K` van ~12 px corridos respecto de `F` y `U`; en la barra aislada de `/frame2d`, una carga global se dibuja en los ejes de la barra con el valor escrito (el viento +X sobre una columna se ve como flechas «hacia abajo» con un 3).

## 6. Cómo verificar

**Lo que pasa hoy** (2026-10-17, cierre de `/frame2d-seismic`):

```
pnpm test          # 608 tests, 84 archivos
npx tsc --noEmit   # sin salida
pnpm lint          # 2 errores preexistentes en ui/ (carousel.tsx, use-mobile.ts): no se tocan; un tercero sí es nuevo
```

**`pnpm build` compila limpio** (2026-10-17, cierre de `/frame2d-seismic`): TypeScript sin errores y las ocho rutas generadas como estáticas, `/frame2d-seismic` incluida. Hay que correrlo con el servidor de desarrollo apagado. La revisión final de `/frame2d-seismic` se hizo **sobre la build de producción** (`pnpm start`), en claro y en oscuro.

**Desplegar en Vercel**: mergear un PR a `main` (protegida: no acepta push directo, ver [`git-workflow.md`](./git-workflow.md)). Cada rama tiene su preview, publicado en el PR. El build de Vercel es el mismo `pnpm build` y lista las ocho rutas como estáticas. Trampa que ya pasó: un proyecto creado con `vercel project add` nace con el preset **«Other»**, publica `public/` y **todas las rutas dan 404 aunque el build termine bien**. Se arregla con `vercel api /v9/projects/<id> -X PATCH -f framework=nextjs` y otro deploy. Después de desplegar, pedir las rutas y mirar la home: el «Ready» del CLI no dice que la app se vea.

**Mirar la app.** El proyecto tiene tres servidores MCP configurados en local (`claude mcp list`): **`chrome-devtools`** (el que se usa: abre la app, hace click y hover de verdad, mide con `evaluate_script`, captura), `playwright` (deja una carpeta `.playwright-mcp/` en la raíz con cada snapshot: borrarla o ignorarla) y `context7` (documentación de librerías; para Next.js manda igual `node_modules/next/dist/docs/`, ver `AGENTS.md`). La receta de Chrome headless por línea de comandos sigue en el roadmap (sección 5) y la de WebGL en headless, en [`armaduras-3d-v1.md`](./armaduras-3d-v1.md) («Paso 0»).

Recetas que ya funcionaron con `chrome-devtools`:

- **Forzar tema**: `initScript` con `localStorage.setItem("theme", "light")` y recargar; o el botón del tema, sin recargar (no pierde el modelo).
- **Empezar sin lo guardado**: `initScript` que borre la clave del sistema (`eder-estructuras:<sistema>`).
- **Un toast con «Deshacer»** dura 10 s: hacer click por `evaluate_script` en el mismo paso, no buscar el uid después.
- **Descargar el Excel**: `initScript` que intercepte `URL.createObjectURL` y guarde el blob en `window`, click real en el botón, y `evaluate_script` con `filePath` para volcarlo en base64.
- **Los uid de una captura (`take_snapshot`) vencen** al cambiar la página: sacar una nueva antes de cada click. Guardarla a archivo (`filePath`) y buscar con `grep`: inline gasta miles de líneas.
- **El hover de la herramienta no alcanza una barra del esquema** (una línea: caja de ancho o alto cero, «no interactiva»). Se verifica con un nudo, y la barra con el test de componentes.
- **Medir superposiciones de texto** en un SVG: comparar los `getBoundingClientRect()` de todos los `text`, y contra el borde del `svg` para los que se salen.
- **`FormulaInput` no se edita con `fill`**: el borrador vive en el estado del componente y el valor vuelve. Click, `Control+A`, `type_text` con `submitKey: Enter`.
- **El menú «Ejemplos» (Base UI) desde un script**: despachar `pointerdown`, `mousedown`, `pointerup`, `mouseup` y `click` sobre el botón y después sobre el `[role=menuitem]`; `.click()` solo no lo abre.
- **Abrir todas las secciones de un procedimiento**: solo `[data-slot=accordion-trigger][aria-expanded=false]`. Hacer click en todo lo que tenga `aria-expanded` abre también los diálogos de «Ver apilada».

**Excel de verdad**: Excel 16 está instalado y se maneja por COM desde PowerShell. La receta y lo que se verificó están en [`excel-export.md`](./excel-export.md), en el paso 7 de [`armaduras-3d-v1.md`](./armaduras-3d-v1.md) y en el paso 10 de [`frame2d-v1.md`](./frame2d-v1.md) (que deja el script de comparación descripto). Al leer un JSON con tildes en PowerShell 5.1, `Get-Content -Encoding UTF8`.

**Reglas de método** que se confirmaron sesión tras sesión:

- **Mirar la app encuentra lo que los tests no**: en cada cierre apareció algo. En `/frame2d`, casi todo lo de los diagramas apareció recién al cargar los ejemplos, que tienen formas que el pórtico inicial no tiene.
- **Sobre una captura hay que medir, no mirar.** Para texto, la razón de contraste WCAG (4.5); la distancia RGB sirve para «¿esta zona se distingue?».
- **Una lección de un ejemplo se mide antes de escribirla**: dos veces una lección supuesta resultó falsa (el asentamiento de la primera cercha de 2D y el del tetraedro de 3D).
- **Un número de la pantalla tiene que poder rehacerse con los otros números de la pantalla**: así apareció que la tabla rotulada `K_ff⁻¹` mostraba `K_ff` en los cuatro sistemas.
- **En un componente que importa `Math` de `custom/math`, el `Math` global no existe**: `Math.abs` rompe (tsc lo atrapa). Pasó dos veces en `frame2d-seismic`.
- **Un carácter invisible no se escribe con `\u`**: Edit, Write y Python lo convierten en el carácter, y en el reemplazo de `sed` `\u` es «mayúscula siguiente». Usar `String.fromCharCode(0xa0)` con nombre (`NBSP`).
- **TeX solo con Edit/Write**, nunca por el texto de un comando de shell: las barras invertidas dobles se pierden (rompió la partición en los cuatro sistemas, antes del commit). Después de tocar fórmulas, buscar `.katex-error` y TeX colado con todas las secciones abiertas.
- **En Excel, `-x^2` es (−x)²**: la negación unaria va antes que la potencia. HyperFormula lo reproduce, así que el test lo atrapa.
- **Trampas que se repitieron**: lo que se dibuja en unidades del modelo y no en píxeles (un `stroke` sin `vector-effect`); el `uppercase` de `ui/` reescribiendo texto (KaTeX, títulos, menús); estrenar un componente de `ui/` que nadie usó; en three.js, un material que se atenúa tiene que nacer `transparent`; un bloque (`div`) dentro de un `<p>`, que la consola marca como error de hidratación.

**Lo que NO está verificado a mano**: el hover de N3 y N4 en `/armaduras-2d` con el mouse de verdad (se verificó sembrando el estado y con tests); el hover sobre una barra del esquema de `/frame2d` con la herramienta (sí con el test de componentes); un pórtico inclinado en la pantalla de la deformada; en `/frame2d-seismic`, el hover de la tabla de niveles con el mouse de verdad. **Y de la normativa: que la E.060 2009 no tenga modificaciones posteriores** —no se encontró ninguna, pero la búsqueda no fue concluyente; por eso las combinaciones son editables (sección 3 de [`frame2d-seismic-v1.md`](./frame2d-seismic-v1.md)).

## 7. Qué leer antes de tocar cada cosa

| Antes de… | Leer |
|---|---|
| construir o cerrar un sistema | [`state-pattern.md`](./state-pattern.md), y el doc de cierre del sistema más parecido |
| propagar una función de `/armaduras-2d` | [`armaduras-2d-cierre.md`](./armaduras-2d-cierre.md) (el porqué de cada una) |
| tocar algo que produce o muestra un error | [`errores.md`](./errores.md) |
| tocar diagramas planos / la escena 3D | [`diagram-pattern.md`](./diagram-pattern.md) / [`diagram-3d-pattern.md`](./diagram-3d-pattern.md) |
| tocar cargas en barras, diagramas N/V/M o la deformada de pórticos | [`frame2d-v1.md`](./frame2d-v1.md), secciones 4 y pasos 2–5 (la convención de signos está en la sección 4) |
| tocar `frame2d-seismic`, el diafragma rígido o algo de la E.030/E.060 | [`frame2d-seismic-v1.md`](./frame2d-seismic-v1.md): la sección 3 tiene los artículos con lo que dicen y cómo bajar y leer los PDF |
| tocar la exportación a Excel | [`excel-export.md`](./excel-export.md) |
| tocar componentes de `ui/` | [`components.md`](./components.md): `ui/` es intocable, se forkea a `ui-custom/` |
| hacer commits | [`git-workflow.md`](./git-workflow.md): **rama + PR a `main`, nunca push directo** (está en producción); merge por rebase; Conventional Commits |
| decidir algo que el original tenía | [`pendientes-comparacion.md`](./pendientes-comparacion.md) |
| tocar APIs de Next.js | `node_modules/next/dist/docs/` (ver `AGENTS.md`: esta versión tiene cambios) |

## 8. Últimos commits

| Commit | Qué |
|---|---|
| (este, primer PR) | docs: el flujo pasa a ramas y PR con `main` protegida |
| `5cc67f8` | docs: repo en GitHub, deploy desde `main` y tesis.eder3232.com |
| `52b0fac` | docs: el despliegue en Vercel y la home |
| `837ee6f` | la home: el método, los sistemas con fotos y lo que tienen todos |
| `cdacce5` | docs: los pendientes juntos en la sección 3 y el README al día |
| `34d21ca` | `frame2d-seismic`: el cierre — `pnpm build`, la revisión en producción en claro y en oscuro, y los docs (paso 9) |
| `60b8a0e` | `frame2d-seismic`: el Excel con el sismo, la rigidez lateral y las combinaciones vivos (paso 8) |
| `9bc246b` | `frame2d-seismic`: tres ejemplos con lecciones medidas; los rótulos del esquema y de la envolvente que se pisaban (paso 7) |
| `da6d48d` | `frame2d-seismic`: los resultados — procedimiento por caso, rigidez lateral, derivas y envolvente (paso 6) |
| `e98b6ba` | `frame2d-seismic`: la página y las tablas, con el esquema por caso (paso 5) |
| `e16b654` | `frame2d-seismic`: el store — casos, niveles, E.030, rigidez lateral, derivas, combinaciones y envolvente (paso 4) |
| `e02d7b7` | `frame2d-seismic`: `/frame2d` reutilizable — cálculo puro y contexto de vista (paso 3) |
| `569f332` | `frame2d-seismic`: el motor sísmico — E.030, condensación, derivas, combinaciones y envolvente (paso 2) |
| `83ab572` | `frame2d-seismic`: el diafragma rígido en el motor (paso 1) |
| `bf2b7ee` | docs: revisión, normativa y plan de `frame2d-seismic` (paso 0) |
| `6089a2a` | docs: el README pasa a ser un mapa y el historial de avances se muda a `historial.md` |
| `134fc59` | docs: `pnpm build` verificado al cierre de `/frame2d` |
| `d7aeefa` | `/frame2d`: exportación a Excel con el FEM vivo (paso 10, cierre) |
| `d590e1d` | `/frame2d`: persistencia y tres ejemplos con cargas en barras (paso 9) |
| `128f3a7` | `/frame2d`: hover tabla ↔ esquema y el mecanismo dibujado (paso 8) |
| `fd6fd26` | `/frame2d`: narrativa, matrices grandes y modo práctica (paso 7); fix de `K_ff⁻¹` en los cuatro sistemas |
| `79f2363` | `/frame2d`: lo genérico de los otros sistemas, y el equilibrio de un pórtico (paso 6) |
| `74e35eb` | `/frame2d`: la deformada real (paso 5) |
| `aee8af7` | `/frame2d`: diagramas N, V, M (paso 4) |
| `3505d80` | `/frame2d`: tabla de cargas, FEM por barra y su dibujo (paso 3) |
| `02a2fdf` | `/frame2d`: cargas en barras y su FEM en el motor (paso 2) |
| `d4a81e8` | `/frame2d`: los bugs de la revisión (paso 1) |
| `3aa24bd` | la revisión y el plan de `/frame2d` |
| `5748fb6` | `/armaduras-3d`: exportación a Excel sin imagen (cierre) |
