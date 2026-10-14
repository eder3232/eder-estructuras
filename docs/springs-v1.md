# `/springs` para la v1: revisión (2026-10-14)

> **Estado: terminado (2026-10-14).** `/springs` tiene todo lo acordado para la v1 —ver «Alcance de la v1» al final—. Lo que depende de un dibujo quedó para la v2. Verificado con tests (322 en total), con capturas en los dos temas, y el Excel contra Excel de verdad por COM.

Cómo se revisó: el código entero del módulo (753 líneas, **sin un solo test propio**), la página en pantalla con las cuatro secciones abiertas, y un sondeo del store con casos borde.

## 1. Bugs (lo primero, son baratos)

| # | Qué | Evidencia |
|---|---|---|
| B1 | **Acepta `k ≤ 0`.** `k = −10` y `k = 0` resuelven sin quejarse. Una rigidez negativa no es física, y `k = 0` es un resorte que no existe. `/armaduras-2d` rechaza `A ≤ 0` y `E ≤ 0` en el constructor del elemento; `SpringElement` no valida nada. | Sondeo del store |
| B2 | **Los errores muestran ids internos.** Borrar un nudo que usa un resorte da «El elemento **seed-e4** referencia al nodo **seed-v1**, que no existe». `/armaduras-2d` lo resuelve en el store con los nombres; `/springs` le pasa los ids al motor. | Sondeo del store |
| B3 | **Nombres repetidos al agregar filas.** Borrar `v4` y agregar da `v5` dos veces; borrar `e1` y agregar da `e4` dos veces. Usa `v${length + 1}`; `/armaduras-2d` usa `nextRowName` de `src/lib/row-names.ts`. | Sondeo del store |
| B4 | **El paso de ensamblaje dice «barra»** en un sistema de resortes («Paso 1: barra e1 (k=10)…»). | Captura |
| B5 | **Signo doble** en las fuerzas internas: «F = 4 × -0.3293». Es el mismo bug que `/armaduras-2d` corrigió en `a4aabf3`. | Captura |
| B6 | La tabla de `Rr` ocupa todo el ancho, distinta de las de `Ff`, `Ur` y `Uf` de al lado. | Captura |

## 2. La exportación a Excel

Es **más simple que la de armaduras**: no hay geometría, así que no hay hoja Barras con `L`, `c`, `s` ni transformación. Editables: `k` de cada resorte, cargas y desplazamientos prescritos. Fijos (con la misma nota): apoyos y conectividad. Hojas: Datos, Ensamblaje (cada celda de `K` suma referencias a las `k`), Solución (partición, `Uf`, `Rr`) y Resultados (fuerza en cada resorte y control de equilibrio).

Se reutiliza todo lo genérico (`workbook-model`, `write-xlsx`, `AssemblyStep.dofs`, el test con HyperFormula, la verificación por COM). Hace falta un `springs-workbook.ts` propio y generalizar el test del libro.

### Sin imagen: de acuerdo, con un matiz

Un sistema de resortes **no tiene geometría**: no hay longitudes ni posiciones, solo conectividad. Cualquier dibujo *a escala* inventaría datos. Para el Excel, **sin imagen** es lo correcto: la tabla Desde/Hacia ya dice todo lo que hay.

El matiz: los libros de texto **sí** dibujan sistemas de resortes, como un esquema **topológico** (nudos en fila, resortes en zigzag entre ellos, apoyos como empotramientos). No miente si se rotula «no está a escala», y ayuda a leer qué conecta con qué — sobre todo con resortes en paralelo o un nudo con varios resortes. Sería además lo que le falta a `/springs` para tener los vínculos por hover (N3/N4) y el mecanismo dibujado. **No es para la v1**; queda anotado como idea para la v2.

## 3. Lo que tiene `/armaduras-2d` y `/springs` no

Lista del hilo C ([`armaduras-2d-cierre.md`](./armaduras-2d-cierre.md)), filtrada por lo que **tiene sentido en resortes**:

| Función | ¿Aplica? | Costo |
|---|---|---|
| Estado vacío y por qué no hay resultados (U3) | Sí: hoy el panel devuelve `null` en error | Chico |
| Persistencia con «Deshacer» (N1) y ejemplos precargados (N2) | Sí | Mediano |
| Advertencias (E2) | Sí: el motor ya las devuelve y `/springs` las descarta | Chico |
| Verificación de equilibrio (N5) | Sí: es genérica del motor | Chico |
| Clasificación `g = b + r − n` | Sí: `determinacy` ya acepta los coeficientes | Chico |
| Nota de unidades (U5) | Sí | Chico |
| Insertar fila en el medio (D7) y cascada de decimales (D8) | Sí | Chico |
| Combobox buscable en Desde/Hacia (U2) | Sí, por consistencia | Chico |
| Orden de grados de libertad (M1a/M1b) | Sí: el motor ya lo tiene | Chico/mediano |
| Narrativa pedagógica en KaTeX (D11) | Sí, adaptada: **sin** transformación; ecuación global, partición coloreada, sustituciones | Mediano |
| Mecanismo explicado (D1) | Sí, en texto (qué nudo quedó suelto); sin dibujo | Chico |
| Matriz ↔ modelo por hover (N4) | Parcial: sin dibujo, el resaltado iría a las filas de la tabla | Mediano |
| Tabla ↔ dibujo (N3), deformada, animación | **No**: no hay dibujo | — |
| Encabezados agrupados (U1) | **No**: la tabla de nudos tiene tres columnas | — |
| Desplazamiento unitario, reciprocidad, modo práctica | A decidir: sirven igual en 1D, pero no son imprescindibles | Mediano |

## Alcance de la v1 (decidido por el usuario, 2026-10-14)

La v1 va a incluir otros módulos, pero **por ahora se termina `/springs`**. Entra **todo lo de arriba salvo lo que depende de un dibujo**.

**Va para la v2**, junto con el esquema topológico que lo haría posible: el esquema mismo, el vínculo tabla ↔ dibujo (N3), el vínculo matriz ↔ modelo (N4, que sin dibujo quedaría en una versión pobre), el desplazamiento unitario (su gracia es *ver* la columna de `K`) y el mecanismo dibujado.

**Criterio de reuso**: lo que hoy vive dentro de `/armaduras-2d` y `/springs` necesita se **extrae a genérico** (`src/components/custom/`, `src/lib/`) en vez de copiarse, porque los módulos que siguen en la v1 lo van a reusar. Es el trabajo real del hilo C.

Orden, y avance:

1. [x] **Bugs** B1–B6 y los primeros tests del módulo. B2 resultó **compartido con `/armaduras-2d`** (sus mensajes también mostraban `seed-e1`): se arregló en los dos con `src/lib/display-names.ts`, y en el store se revisan las referencias a nudos antes del motor, porque el nombre de un nudo borrado ya no existe. B1 obligó a que un resorte nuevo **herede la `k`** de la fila anterior, si no nacía en error.
2. [x] **Lo barato**: estado vacío (U3), advertencias (E2), equilibrio (N5), clasificación, nota de unidades (U5), insertar filas (D7), cascada de decimales (D8), combobox (U2), orden de grados de libertad (M1a/M1b), mecanismo explicado en texto. Para no copiar, se extrajeron a `src/components/custom/` la verificación de equilibrio, la clasificación (con el veredicto en `src/lib/classification-verdict.ts`), el control de orden, el encabezado de decimales por sección y el combobox de nudos; la nota de unidades ganó el ejemplo como prop. Las advertencias del motor hablan de «barras»: `/springs` las reescribe por código. Mirarlo encontró el `(K)` de la trampa del `uppercase` en el encabezado de la rigidez.
3. [x] **Narrativa en KaTeX** (D11, sin transformación) y **modo práctica**. La ecuación global `F = K·U` y la partición pasaron a `src/components/custom/` (armaduras quedó como adaptador, con su vínculo al esquema en un hueco de la genérica). Mirarlo encontró:
   - **Dos errores de física en textos nuevos.** Uno decía que desplazar un nudo «comprime» el resorte (sin geometría no se sabe hacia qué lado está el otro nudo). El otro, que dar vuelta un resorte en la tabla no cambia su fuerza: **es falso**, `F = k·(u_j − u_i)` cambia de signo. En armaduras sí es invariante porque también se dan vuelta los cosenos. Un test lo fija.
   - **Un bug de `/armaduras-2d` que nunca se había visto**: el `AccordionContent` de `ui/` fija el alto que midió al abrirse, así que el modo práctica quedaba **cortado** al encenderlo. Arreglado con un fork mínimo en `src/components/ui-custom/accordion.tsx`, usado en los dos sistemas. `/frame2d` y `/armaduras-3d` siguen con el de `ui/` (su contenido no crece después de abrir).
   - Más vocabulario de armaduras en componentes genéricos (los quiz decían «esa barra», «ejes globales»). Un test abre todo el panel de `/springs` y exige que la palabra «barra» no aparezca.
4. [x] **Persistencia y ejemplos precargados** (N1/N2). Clave propia (`eder-estructuras:springs`), así un sistema no descarta lo guardado del otro. Tres ejemplos, cada uno con su lección **verificada en un test**: en serie (isostático, la misma fuerza en los dos), en paralelo (hiperestático, la carga se reparte 2 y 6 según `k` 10 y 30) y apoyo que cede (hiperestático **sin cargas** y con fuerzas igual). El guardado, el reset con «Deshacer» y el menú pasaron a `src/components/custom/model-persistence.tsx`. Mirarlo encontró que el menú, alineado al final del botón, se iba afuera de la columna en una página más angosta: ahora la alineación es una prop.
5. [x] **Excel**, sin imagen. Libro de cinco hojas: Datos, Resortes (la `k·[[1, −1], [−1, 1]]` de cada uno, referida a su `k`), Ensamblaje, Solución y Resultados. **Ensamblaje y Solución son ahora comunes a los dos sistemas** (`src/lib/excel/matrix-method-sheets.ts`), y el botón también (`src/components/custom/excel-export-button.tsx`). Verificado igual que el de armaduras: HyperFormula en los tests (el ejemplo inicial y los tres ejemplos, con los dos órdenes, antes y después de editar carga, `k` y desplazamiento prescrito; se comprobó que falla si se invierte el signo de la fuerza) y Excel por COM (253 celdas en 5 libros, 0 diferencias; más la descarga real desde la app).

## Lo que queda para la v2 en `/springs`

El esquema topológico (nudos en fila, resortes en zigzag, «no está a escala») y lo que depende de él: vínculo tabla ↔ dibujo (N3), vínculo matriz ↔ modelo (N4), desplazamiento unitario y mecanismo dibujado. Ver «Excel sin imagen» arriba para el porqué.

## Decisiones que quedaron tomadas

1. Qué entra en la v1: todo menos lo que depende de un dibujo (ver arriba).
2. La v1 incluye otros módulos además de `/springs` y `/armaduras-2d`, pero se encaran después.
