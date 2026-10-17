# Estado actual del proyecto (2026-10-16)

> **Empezá acá si retomás en frío.** Este documento es el estado accionable: qué está hecho, qué falta, qué no está verificado y qué leer antes de tocar cada cosa. El README tiene el resumen y la lista de avances; el roadmap ([`refactor-roadmap.md`](./refactor-roadmap.md)) tiene el diagnóstico del proyecto original y la historia hasta el 2026-08-14.

## 1. Dónde está parado

**El objetivo es terminar la v1**, sistema por sistema. Tres de los cuatro sistemas están **cerrados para la v1**:

| Sistema | Cerrado | Detalle |
|---|---|---|
| `/armaduras-2d` | 2026-08-14 (Excel y clasificación el 2026-10-14) | [`armaduras-2d-cierre.md`](./armaduras-2d-cierre.md), [`armaduras-2d-plan.md`](./armaduras-2d-plan.md), [`excel-export.md`](./excel-export.md) |
| `/springs` | 2026-10-14 | [`springs-v1.md`](./springs-v1.md) |
| `/armaduras-3d` | 2026-10-16 | [`armaduras-3d-v1.md`](./armaduras-3d-v1.md) |
| `/frame2d` | **no** — sigue como quedó en el Tren C (2026-08) | ver sección 3 |
| `frame2d-seismic` | **no existe todavía** | ver sección 3 |

Además está la página de teoría [`/estabilidad`](../src/app/estabilidad).

**En curso desde el 2026-10-17: `/frame2d` para la v1** (lo eligió el usuario). La revisión, las decisiones, lo que falta decidir y el plan por pasos están en [`frame2d-v1.md`](./frame2d-v1.md); la sección 3 de acá queda como resumen.

## 2. Qué tiene cada sistema

`✅` hecho · `—` no aplica (y por qué) · `✗` falta

| Función | `/armaduras-2d` | `/springs` | `/armaduras-3d` | `/frame2d` |
|---|---|---|---|---|
| Bugs de la revisión para la v1 | ✅ | ✅ (6) | ✅ (6) | ✗ sin revisar |
| Estado vacío y por qué no hay resultados (U3) | ✅ | ✅ | ✅ | ✗ |
| Advertencias (E2) | ✅ | ✅ | ✅ | ✗ |
| Clasificación `g` cruzada con el motor | ✅ `b+r−2n` | ✅ `b+r−n` | ✅ `b+r−3n` | ✗ (`3b+r−3n`) |
| Verificación de equilibrio (N5) | ✅ | ✅ | ✅ | ✗ |
| Nota de unidades (U5) | ✅ | ✅ | ✅ | ✗ |
| Insertar fila en el medio (D7) | ✅ | ✅ | ✅ | ✗ |
| Decimales por sección y por tabla (D8) | ✅ | ✅ | ✅ | ✗ solo el de página |
| Combobox buscable Desde/Hacia (U2) | ✅ | ✅ | ✅ | ✗ |
| Encabezados agrupados (U1) | ✅ | — 3 columnas | ✅ | ✗ |
| Orden de grados de libertad (M1a/M1b) | ✅ | ✅ | ✅ | ✗ |
| Narrativa en KaTeX (D11) | ✅ | ✅ sin transformación | ✅ | ✗ texto plano |
| Matrices grandes: apilada, pantalla completa, `K` como mapa, pasos cerrados | ✅ | ✅ | ✅ | ✗ usa sus propios `assembly-steps` |
| Modo práctica | ✅ | ✅ | ✅ bloque 3×3 | ✗ |
| Mecanismo explicado en texto | ✅ | ✅ | ✅ | ✗ |
| Mecanismo dibujado | ✅ | — sin dibujo | ✅ | ✗ |
| Tabla ↔ dibujo por hover (N3) | ✅ | — sin dibujo | ✅ | ✗ |
| Matriz ↔ modelo por hover (N4) | ✅ | — | v2 | ✗ |
| Desplazamiento unitario | ✅ | — v2 | v2 | ✗ |
| Persistencia con «Deshacer» (N1) | ✅ | ✅ | ✅ | ✗ |
| Ejemplos precargados (N2) | ✅ 3 | ✅ 3 | ✅ 3 + el inicial | ✗ |
| Excel con el método vivo | ✅ con imagen | ✅ sin imagen | ✅ sin imagen | ✗ |
| Tests del store | ✅ | ✅ | ✅ | ✗ ninguno (solo la regresión del motor) |
| Página ancha `max-w-[84rem]` | ✅ | — `max-w-5xl` alcanza | ✅ | ✗ |

## 3. Lo que falta para la v1

### `/frame2d` para la v1

Es el más atrasado: tiene el motor (`FrameElement2D`, 6×6 con axial y flexión, momentos de empotramiento perfecto) y la visualización con el giro resuelto, pero **ninguna** de las funciones de la tabla de arriba. Por eso conviene hacerlo con **el molde que se repitió en los tres cierres**:

1. **Revisión** del módulo entero, con un sondeo del store con casos borde. En `/springs` y `/armaduras-3d` encontró seis bugs cada una, y cuatro eran los mismos (filas nuevas que nacen en error, ids internos en los mensajes, nombres repetidos, signo doble en las sustituciones): **lo más probable es que `/frame2d` los tenga**.
2. **El alcance lo decide el usuario**, con una tabla «qué tiene 2D y este no» como la de [`armaduras-3d-v1.md`](./armaduras-3d-v1.md) (sección 2).
3. **Un doc `docs/frame2d-v1.md`** con el avance paso por paso y lo que encontró mirarlo.
4. **Extraer a genérico en vez de copiar**: casi todo ya está en `src/components/custom/` y `src/lib/` (ver qué usa `/armaduras-3d`).

Lo propio de pórticos que no se resuelve cableando:

- **La `A` es de 6×6** (el giro entra sin transformar) y la `K` de cada barra también: la cadena `A·k·Aᵀ` es más grande que la de 3D. Para eso están la vista apilada y la pantalla completa.
- **Los momentos de empotramiento perfecto se cargan a mano**, 6 por barra. Falta la UI de tablas de carga que los calcule (distribuida, puntual, momento, distribuida intermedia). Fue el «hilo B» del 2026-08-14.
- **El Excel** tiene que llevar los FEM como vector de cargas equivalentes, y la rigidez 6×6 con flexión.
- **Deudas propias**: la deformada es una recta entre nudos en vez de la cúbica de Hermite (**D3**), y faltan los diagramas de corte y momento (**D4**).
- **Nunca se miró** su forma deformada después de los cambios compartidos del 2026-08-13.

### `frame2d-seismic`

No existe. Va como **extensión real sobre `frame2d`, no un fork copiado**: ese fue el bug diagnosticado en el original (ver el roadmap). Tiene sentido después de `/frame2d`.

### Después de los sistemas

Las fases 6 a 8 del roadmap: armaduras/pórticos plus (temperatura, defectos de fabricación, apoyos inclinados — la Fase 6, ver «v2» abajo), y el contenido educativo (Fase 8), que depende de **S2** (la navegación definitiva; hoy la navbar es provisional) y **N6** (contenido teórico enlazado), ver [`pendientes-comparacion.md`](./pendientes-comparacion.md).

## 4. Lo que quedó para la v2

Decidido por el usuario en cada cierre:

- **Temas del curso** (de `/armaduras-2d`, 2026-10-14): **variación de temperatura** y **defectos de fabricación** (entran como carga nodal equivalente, `N = k·(u − δ₀)`; el motor ya tiene el gancho `Element.equivalentLoad()`), y **apoyos inclinados** (rotar los grados de libertad de un nudo; toca el motor y el Excel).
- **`/springs`**: el esquema topológico (nudos en fila, resortes en zigzag, «no está a escala») y lo que depende de él: N3, N4, desplazamiento unitario y mecanismo dibujado.
- **`/armaduras-3d`**: N4 (matriz ↔ modelo), desplazamiento unitario, Excel con imagen, `K` por bloques de nudo, D16 y vistas predefinidas (planta/elevación).

## 5. Deudas abiertas

La tabla numerada con el detalle está en el roadmap, sección 4. Estado al 2026-10-16:

| # | Qué | Estado |
|---|---|---|
| D2 | Las tablas de barras de las dos armaduras | ✅ resuelta: una sola, `custom/truss-element-table.tsx` |
| D3 | Deformada de `frame2d` como recta | abierta |
| D4 | Diagramas de corte y momento | abierta |
| D5 | Verificación visual pendiente | queda solo la deformada de `/frame2d` |
| D7, D8, D11 | Insertar filas, decimales en cascada, narrativa | ✅ en tres sistemas; falta `/frame2d` |
| D9 | El stepper de decimales puede saltar de renglón | abierta, afuera a propósito |
| D12 | La ecuación que no se adapta a sus operandos | mitigada: «Ver apilada» y «Pantalla completa» (`custom/chain-equation.tsx`, `MatrixEquation expand`); el responsive sigue abierto |
| D13 | `K` como mapa | ✅ resuelta (`MatrixTable heatmap`, pasados 19 grados de libertad) |
| D14 | Pasos de ensamblaje que crecen | ✅ resuelta (`custom/assembly-steps.tsx`, cerrados pasados 12) |
| D15 | El motor invierte en vez de factorizar | abierta **por decisión del usuario** |
| D16 | El esquema no dibuja los desplazamientos prescritos | abierta (en 2D y 3D) |
| D17 | Las etiquetas no se conocen entre sí | abierta; en 3D depende del ángulo (en la torre de 9 nudos se apilan alrededor de `b4`) |

Detalles chicos vistos y no resueltos: en el Excel de las dos armaduras, en el renglón de propiedades de cada barra el valor queda pegado al rótulo siguiente («3.5 Cx = Δx/L»); el ruido numérico (`-2.22E-15`) sale tal cual; en `F = K·U` los renglones de `K` van ~12 px corridos respecto de `F` y `U`.

## 6. Cómo verificar

**Lo que pasa hoy** (2026-10-16, commit `5748fb6`):

```
pnpm test          # 381 tests, 65 archivos
npx tsc --noEmit   # sin salida
pnpm lint          # 2 errores preexistentes en ui/ (carousel.tsx, use-mobile.ts): no se tocan; un tercero sí es nuevo
```

`pnpm build` **no se corrió** en la sesión del 2026-10-16 (el servidor de desarrollo estaba levantado), así que no está comprobado que la página de 3D con `exceljs` compile en producción; el de `/armaduras-2d` sí compilaba. Conviene correrlo con el servidor apagado antes de dar algo por cerrado.

**Mirar la app.** Desde el 2026-10-16 el proyecto tiene tres servidores MCP configurados en local (`claude mcp list`): **`chrome-devtools`** (el que se usa: abre la app, hace click y hover de verdad, mide con `evaluate_script`, captura), `playwright` (deja una carpeta `.playwright-mcp/` en la raíz con cada snapshot: borrarla o ignorarla) y `context7` (documentación de librerías; para Next.js manda igual `node_modules/next/dist/docs/`, ver `AGENTS.md`). Antes no había forma de hacer hover; la receta de Chrome headless por línea de comandos sigue en el roadmap (sección 5) y la de WebGL en headless, en [`armaduras-3d-v1.md`](./armaduras-3d-v1.md) («Paso 0»).

Recetas que ya funcionaron con `chrome-devtools`:

- **Forzar tema**: `initScript` con `localStorage.setItem("theme", "light")` y recargar.
- **Empezar sin lo guardado**: `initScript` que borre la clave del sistema (`eder-estructuras:<sistema>`).
- **Un toast con «Deshacer»** dura 10 s: hacer click por `evaluate_script` en el mismo paso, no buscar el uid después.
- **Descargar el Excel**: `initScript` que intercepte `URL.createObjectURL` y guarde el blob en `window`, click real en el botón, y `evaluate_script` con `filePath` para volcarlo en base64.

**Excel de verdad**: Excel 16 está instalado y se maneja por COM desde PowerShell. La receta y lo que se verificó están en [`excel-export.md`](./excel-export.md) y en el paso 7 de [`armaduras-3d-v1.md`](./armaduras-3d-v1.md). Al leer un JSON con tildes en PowerShell 5.1, `Get-Content -Encoding UTF8`.

**Reglas de método** que se confirmaron sesión tras sesión:

- **Mirar la app encuentra lo que los tests no**: en cada cierre apareció algo (en el paso 6 de 3D, la cámara del modelo anterior y el menú fuera de la columna).
- **Sobre una captura hay que medir, no mirar.** Para texto, la razón de contraste WCAG (4.5); la distancia RGB sirve para «¿esta zona se distingue?».
- **Una lección de un ejemplo se mide antes de escribirla**: dos veces una lección supuesta resultó falsa (el asentamiento de la primera cercha de 2D y el del tetraedro de 3D: *hiperestática + asentamiento* no implica esfuerzos).
- **Trampas que se repitieron**: lo que se dibuja en unidades del modelo y no en píxeles (un `stroke` sin `vector-effect`); el `uppercase` de `ui/` reescribiendo texto (KaTeX, títulos, menús); estrenar un componente de `ui/` que nadie usó (el `Alert` warning ilegible, el `Toaster` con otra tipografía, el `Dialog` angosto y en mayúsculas); en three.js, un material que se atenúa tiene que nacer `transparent`.

**Lo que NO está verificado a mano**: la deformada de `/frame2d` después de los cambios del 2026-08-13; el hover de N3 y N4 en `/armaduras-2d` con el mouse de verdad (se verificó sembrando el estado y con tests; ahora `chrome-devtools` lo permite).

## 7. Qué leer antes de tocar cada cosa

| Antes de… | Leer |
|---|---|
| construir o cerrar un sistema | [`state-pattern.md`](./state-pattern.md), y el doc de cierre del sistema más parecido |
| propagar una función de `/armaduras-2d` | [`armaduras-2d-cierre.md`](./armaduras-2d-cierre.md) (el porqué de cada una) |
| tocar algo que produce o muestra un error | [`errores.md`](./errores.md) |
| tocar diagramas planos / la escena 3D | [`diagram-pattern.md`](./diagram-pattern.md) / [`diagram-3d-pattern.md`](./diagram-3d-pattern.md) |
| tocar la exportación a Excel | [`excel-export.md`](./excel-export.md) |
| tocar componentes de `ui/` | [`components.md`](./components.md): `ui/` es intocable, se forkea a `ui-custom/` |
| hacer commits | [`git-workflow.md`](./git-workflow.md): commits directos a `main` hasta `v1.0.0`, Conventional Commits |
| decidir algo que el original tenía | [`pendientes-comparacion.md`](./pendientes-comparacion.md) |
| tocar APIs de Next.js | `node_modules/next/dist/docs/` (ver `AGENTS.md`: esta versión tiene cambios) |

## 8. Últimos commits

| Commit | Qué |
|---|---|
| `5748fb6` | `/armaduras-3d`: exportación a Excel sin imagen (paso 7, cierre) |
| `003738d` | `/armaduras-3d`: persistencia y tres ejemplos (paso 6) |
| `9a5011a` | `/armaduras-3d`: hover tabla ↔ escena y el mecanismo dibujado (paso 5) |
| `269186a` | `/armaduras-3d`: narrativa de 2D y modo práctica de 3×3 (paso 4) |
| `e1eb504` | matrices grandes en los tres sistemas (paso 3) |
| `d15609a` | `/armaduras-3d`: lo de 2D que no pide dibujo (paso 2) |
| `5d70090` | `/armaduras-3d`: los bugs de la revisión (paso 1) |
| `09477f3` | la escena 3D sigue al tema (paso 0) |
| `84b20a9` | el plan de `/armaduras-3d` |
| `5f66cea` | `/springs` terminado para la v1 |
