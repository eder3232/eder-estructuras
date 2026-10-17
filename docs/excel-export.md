# Exportación a Excel con el método vivo (Fase 7)

> **Estado (2026-10-16): terminada en `/armaduras-2d`, `/springs` y `/armaduras-3d`** (resortes y armaduras 3D sin imagen: los resortes no tienen geometría, y en 3D los nombres de la escena no están en el lienzo WebGL). Falta `/frame2d`. El libro de 3D y su verificación están en el paso 7 de [`armaduras-3d-v1.md`](./armaduras-3d-v1.md): 12 440 celdas contra Excel por COM, 0 diferencias, y un libro bajado desde la app con el botón real. Las hojas Ensamblaje y Solución y el botón son comunes a los dos (`matrix-method-sheets.ts`, `custom/excel-export-button.tsx`); cada sistema pone su hoja Datos, la de sus elementos y Resultados. La primera versión, en armaduras, — botón «Descargar Excel» en el encabezado, libro con el método vivo e imagen del esquema, verificado de punta a punta (app → descarga → Excel). Falta propagarla a los otros tres sistemas con el hilo C; el diseño ya es genérico para eso.

## Qué hace

Genera un `.xlsx` **sin macros** donde el método matricial sigue vivo: coordenadas, cargas, desplazamientos prescritos, área y elasticidad son celdas editables (amarillas), y todo lo demás —`L`, `c`, `s`, `A·k·Aᵀ` de cada barra, `K` global, la partición, `Uf`, `Rr`, la fuerza axial y el control de equilibrio— son fórmulas que Excel recalcula al editar.

## Decisiones del usuario (2026-10-14)

- **Los apoyos y la conectividad quedan fijos.** Deciden dónde cae cada número en `K` y qué filas van a `Kff`/`Krr`, así que quedan escritos en las fórmulas. Se podían dejar vivos los apoyos (identidad en cada grado restringido y resolver la matriz entera), pero el libro dejaba de mostrar la partición como en el pizarrón. **Partición a la vista, apoyos fijos, y el libro lo dice** en una nota de la hoja Datos: para cambiarlos, generar otro Excel desde la app.
- **Solo Microsoft Excel.** Por eso las fórmulas usan funciones clásicas (`MMULT`, `MINVERSE`, `TRANSPOSE`, `SQRT`) como **fórmulas matriciales clásicas** (`{=...}`), que funcionan desde Excel 2007. Nada de `LET`/`LAMBDA`/`FILTER`.
- **Imagen estática del esquema**, sin cargas ni desplazamientos (pueden cambiar en el libro). No un gráfico vivo.
- **Todo en el navegador**: no hace falta backend (se evaluó Python en una función de nube y se descartó, ver «Qué se verificó»).

## Cómo está armado

| Archivo | Qué es |
|---|---|
| `src/lib/excel/workbook-model.ts` | El libro **como datos**: celdas con rol (`input`, `computed`…), fórmulas con su resultado, bloques matriciales. Sin librerías. |
| `src/lib/excel/matrix-method-sheets.ts` | Las hojas Ensamblaje y Solución, comunes a todos los sistemas: solo necesitan dónde está cada término de rigidez, cada carga y cada desplazamiento prescrito. |
| `src/lib/excel/springs-workbook.ts` | El libro de `/springs`: Datos, Resortes, las dos comunes y Resultados. |
| `src/lib/excel/testing/expectations.ts` | Solo tests: recorrer todo lo que calcula un libro y compararlo recalculado. |
| `src/lib/excel/truss-2d-workbook.ts` | Arma el modelo de una armadura 2D a partir de los nudos, las barras y el `SolveResult`. Hojas: Datos, Barras, Ensamblaje, Solución, Resultados. |
| `src/lib/excel/truss-3d-workbook.ts` | El de una armadura espacial: el de 2D con un eje más (tres cosenos, `A` de 6×2, `K` de barra de 6×6). Mismas hojas, sin imagen. |
| `src/lib/excel/write-xlsx.ts` | El único que conoce a `exceljs`. Lo carga con `import()` (pesa ~250 KB gzip). |
| `src/lib/excel/testing/recalculate.ts` | Solo tests: recalcula el modelo con HyperFormula (GPL-3, dependencia de desarrollo), con `MINVERSE` registrado a mano porque no la trae. |
| `src/components/custom/diagram-2d/schema-png.tsx` | El `SchemaDiagram` de la pantalla como PNG, en tema claro, dibujado en un iframe oculto. Genérico para los sistemas planos. |
| `src/app/armaduras-2d/components/excel-export-button.tsx` | El botón. Solo se habilita si `atomResults` es `ok`. |

**El ensamblaje es el del motor.** `AssemblyStep.dofs` (agregado para esto) dice a qué fila/columna de `K` va cada grado local de cada barra; el generador recorre eso y escribe `='Barras'!I5+'Barras'!K23` en vez de sumar. El orden de grados de libertad sigue al de la pantalla (`restrainedFirst`, numeración del alumno).

## Qué se verificó, y cómo

- **Test** (`src/app/armaduras-2d/store/excel-workbook.test.ts`): el ejemplo inicial y los tres precargados, cada uno con los dos órdenes de grados de libertad. Recalcula el libro con HyperFormula y exige (1) que cada fórmula dé lo del motor y (2) que **editar dentro del libro** —mover un nudo, cambiar una carga, un área y un desplazamiento prescrito— dé lo mismo que el motor resolviendo el modelo editado. Se comprobó que falla: sacarle una barra a la suma de `K` rompe 16 casos señalando la celda.
- **Excel de verdad, por COM** (Excel 16, la máquina del usuario): los 5 libros, **1675 celdas calculadas, 0 diferencias** al abrir y después de editar. Las fórmulas matriciales se reconocen (`HasArray`) y Excel las traduce solo (`MINVERSA`, `;`). `MINVERSE` resolvió 150 grados de libertad sin problema.
- **Navegador**: Chrome generó un `.xlsx` con `exceljs` y un PNG desde un SVG con colores `oklch` vía `canvas`; Excel lo abrió y recalculó.
- **Mirado** (exportando a PDF desde Excel): las cinco hojas.
- **De punta a punta en la app**: Chrome headless manejado por el protocolo de DevTools (un script de Node con el `WebSocket` global, sin Puppeteer) abre `/armaduras-2d`, aprieta el botón y espera la descarga real; después Excel por COM verifica las 332 celdas del ejemplo inicial, antes y después de editar. Con la página **en oscuro y en claro**: la imagen sale idéntica byte a byte, en claro. `pnpm build` empaqueta `exceljs` sin problema.

## Trampas de `exceljs` que ya costaron

1. **Sin `views` en la hoja, Excel abre todas las filas a 2/3 del alto pedido** (una nota de dos renglones a 30 pt salía a 20 y cortaba el segundo). Se aisló por trasplante de XML contra un archivo guardado por Excel: falta `<sheetViews>`. `write-xlsx.ts` pasa `views: [{ state: "normal" }]`.
2. Los tipos no declaran `shareType`/`ref` de las fórmulas matriciales, aunque la librería los escribe.
3. Para generar archivos fuera del navegador con `tsx`, el alias `@/` y la ruta relativa cargan **dos copias** del mismo módulo de átomos: leer los nudos de un store distinto del que se restauró. Tomarlos del modelo.

## Trampas del PNG

1. **Las hojas de estilo no se copian como `<link>`**: Next las enlaza con rutas relativas y en un iframe `about:blank` no resuelven. La primera versión salió sin una sola regla —barras invisibles, todo negro, letra con serifa— con los números del libro perfectos. Se copia el texto de `document.styleSheets`.
2. **Un SVG dentro de `<img>` no carga fuentes web**: los rótulos salen en Consolas (la monoespaciada del sistema).
3. Para probar descargas en headless, `Browser.setDownloadBehavior` necesita la ruta **con barras invertidas de Windows**; con `/` acepta el comando y no descarga nada, sin error. (No era el `revokeObjectURL` inmediato: se probó que en Chrome no corta la descarga.)

## Lo que falta

- **Propagar** a `/frame2d` (`/springs` y `/armaduras-3d` ya lo tienen). Lo genérico ya está (`workbook-model`, `write-xlsx`, `schema-png` para los planos, `AssemblyStep.dofs` en el motor); cada sistema necesita su propio armado como `truss-2d-workbook.ts`, porque cambia la rigidez de la barra (`frame2d` tiene 6×6 y momentos de empotramiento; `springs` no tiene transformación) y `armaduras-3d` no tiene esquema SVG sino three.js.
- La imagen **incluye los apoyos** (decisión del usuario: son fijos en el libro, así que el dibujo no se desactualiza) y **no las cargas** (se editan en el libro).

Detalles chicos vistos y no resueltos: el ruido numérico (`-2.22E-15` donde va 0) sale tal cual lo calcula Excel; la nota de una línea de Datos queda con alto de dos.
