# `/frame2d` para la v1: revisión y alcance (2026-10-17)

> **Estado: revisado y con el alcance decidido (2026-10-17).** Las decisiones están en «Decisiones» y en la sección 6. El avance va en la sección 7.

Cómo se revisó: el `frame2d` original entero en lo que toca a **cargas en barras** y **diagramas de corte y momento** (`thesis-structures/src/programs/frame2d/store/fem/`, `store/graphics/`, `components/edgesTable/fem/`, `components/graphs/`, `components/results/graphsForEachEdge/`), lo que heredó `frame2d-seismic`, y el módulo de este repo (`src/app/frame2d/`, 1240 líneas, y `src/lib/engine/frame2d/`). Las fórmulas de empotramiento perfecto del original **se verificaron numéricamente**: la carga repartida integrando cargas puntuales, y el momento concentrado como límite de un par de fuerzas (script en el scratchpad de la sesión, no versionado; la idea se repite en los tests del paso 2).

A diferencia de `/springs` y `/armaduras-2d`, acá **el original no sirve de molde**: el usuario lo dijo de entrada y la revisión lo confirmó. Lo que se rescata es la **lista de tipos de carga** y la idea de poder escribir los FEM a mano; el cálculo y el dibujo se rehacen.

## 1. Lo que hacía mal el original

### Cargas y momentos de empotramiento

| # | Qué | Evidencia |
|---|---|---|
| V1 | **La carga distribuida intermedia nunca entra al cálculo.** Su fórmula está bien, pero `atomSumFEM` suma `point`, `distributed` y `moment` y se olvida de `distributedIntermediate`. Cargarla no cambia nada | `store/fem/fem.tsx:82-110` |
| V2 | **El momento concentrado tiene mal el FEM del extremo j**: usa `b` donde va `a` y además invierte el signo. Con M = 10 en el centro de L = 5 da `+2.5` donde va `−2.5`; aplicado sobre el extremo i da `2M` donde va `0`. Las fuerzas verticales sí están bien. Correcto: `M_j = −M·a·(2b − a)/L²` | `store/fem/loadMoment.tsx:78`, verificado numéricamente |
| V3 | **El FEM queda congelado.** Se calcula en el *setter* de la carga, con la longitud de ese momento: mover un nudo después cambia L y el FEM sigue siendo el viejo | `loadPoint.tsx:70` y sus hermanos |
| V4 | Sin validación: posición > L, `a > b`, todo pasa callado | — |
| V5 | Solo cargas perpendiculares a la barra en ejes locales: no hay gravedad sobre una barra inclinada, ni carga axial, ni triangular/trapezoidal | — |
| V6 | Interfaz: un diálogo por barra con tarjetas y fotos `.jpg`, que no deja ver todas las cargas de la estructura juntas; FEM con 2 decimales fijos | `components/edgesTable/fem/` |

### Diagramas de corte y momento (three.js)

| # | Qué | Evidencia |
|---|---|---|
| V7 | **Corte con carga intermedia mal acotado**: la condición es `x > inicio && x > fin`, así que la carga actúa *después* del tramo, hasta el final de la barra. El sísmico lo corrigió, pero itera `fem.dead` en las dos categorías: la muerta se cuenta dos veces y la viva nunca | `store/graphics/shear/computeShear.ts:132-135` |
| V8 | **El diagrama de momento recalcula el corte por su cuenta y ahí no incluye la carga intermedia** | `computeMoment.ts:126-149` |
| V9 | **Los momentos concentrados casi nunca se aplican**: el lazo reusa el arreglo de banderas de las *cargas puntuales*. Con alguna puntual en la barra, el momento se saltea o se aplica donde no va | `computeMoment.ts:156-163` |
| V10 | Integración numérica (Riemann por izquierda, 50 pasos) que arranca corrida un paso y nunca llega a `x = L`. El valor del extremo j que da el motor se lee y no se usa para cerrar | `computeShear.ts:89-145` |
| V11 | La escala sale solo de los valores de los extremos: el máximo interior (el de la distribuida) no cuenta, y con todo en cero divide por cero | `computeShear.ts:42-55` |
| V12 | Se dibuja como 50 cajas corridas medio paso, no como curva; sin valores en extremos ni máximos, sin signo, sin convención dicha; colores fijos (`black`, `red`) que no siguen el tema | `components/graphs/graphMoment/graphic2Dmoment.tsx:151-168` |
| V13 | **`isDrawable` se calcula y nadie lo lee**: con FEM a mano, el diagrama se dibuja como si la barra no tuviera carga, mostrando algo falso sin avisar | `grep isDrawable` |

El motor del original además sumaba el FEM al vector global **sin transformarlo** (`logic/frame2D.ts:410-430`); eso ya lo corrigió el Tren C (`FrameElement2D.equivalentLoad`).

## 2. Bugs del `/frame2d` de este repo

Por código; son los mismos que encontraron las revisiones de `/springs` y `/armaduras-3d`:

| # | Qué |
|---|---|
| B1 | **Una barra nueva nace en error**: `atomAddElement` la crea con `área = E = I = 0`. Tiene que heredar de la fila de arriba |
| B2 | **Los errores del motor muestran ids internos**: `FrameElement2D` recibe `element.id` («El elemento seed-e1…»). Los otros usan `src/lib/display-names.ts` |
| B3 | **Nombres repetidos**: `v${length + 1}` y `e${length + 1}`; los otros usan `nextRowName` |
| B4 | El panel de resultados devuelve `null` en cualquier error (U3) |
| B5 | **Desde = Hacia** se puede elegir: es un `Select` y el error aparece después («longitud cero») |
| B6 | **Los FEM no dicen su convención de signos.** La nota dice «ejes locales» pero no si `V desde` positivo es hacia `+y'` ni si es la fuerza que la barra hace o recibe. Con la tabla de cargas deja de importar para el caso común, pero el FEM a mano lo sigue necesitando |
| B7 | El color de la deformada es la axial del extremo j, «constante a lo largo de la barra». Con carga axial (sección 4) deja de serlo |

Falta el **sondeo del store con casos borde** que hicieron las otras revisiones; va al principio del paso 1.

## 3. Lo que tiene `/armaduras-2d` y `/frame2d` no

| Función | ¿Aplica? | Costo |
|---|---|---|
| Estado vacío (U3), advertencias (E2), equilibrio (N5), nota de unidades (U5) | Sí, con los genéricos. N5 ya suma la carga equivalente de cada barra (`equilibrium.ts:99`) | Chico |
| Clasificación `g = 3b + r − 3n` | Sí: `determinacy` acepta los coeficientes | Chico |
| Insertar fila (D7), cascada de decimales (D8), combobox (U2), página ancha | Sí | Chico |
| Encabezados agrupados (U1) | **Sí, y hacen falta**: la tabla de nudos tiene 3 coordenadas/fuerzas/desplazamientos/restricciones por nudo | Chico |
| Orden de grados de libertad (M1a/M1b) | Sí. **El `frame2d` original tenía los dos checkboxes** (`areRestrictedsOnTop`, `areDofDefinedByUser`): rescate | Chico/mediano |
| Narrativa en KaTeX (D11) con `A` de 6×6 | Sí; no entra en una fila: para eso están «Ver apilada» y «Pantalla completa» | Mediano |
| Matrices grandes (apilada, pantalla completa, `K` como mapa, pasos cerrados) | Sí: hoy usa sus propios `assembly-steps` | Chico |
| Modo práctica | Sí, con un matiz: una matriz de 6×6 a mano es tediosa. En 3D se resolvió con un bloque de 3×3 | Mediano |
| Mecanismo explicado / dibujado | Sí / sí (el módulo 2D ya dibuja modos) | Chico / mediano |
| Tabla ↔ dibujo por hover (N3) | Sí, y se extiende a la tabla de cargas | Chico |
| Matriz ↔ modelo (N4), desplazamiento unitario | Posibles (es el mismo módulo SVG que 2D) | Mediano |
| Persistencia (N1) y ejemplos (N2) | Sí | Mediano |
| Excel con el método vivo | Sí, con FEM como fórmulas de los parámetros de cada carga | Grande |
| Tests del store | **No hay ninguno** | — |

## 4. La propuesta: cargas en barras y diagramas

### Las cargas son el dato; el FEM se calcula

Cada barra tiene una lista de cargas y el FEM es una **función pura del motor** de esas cargas y de la longitud actual. Elimina V1–V4 de raíz: no hay FEM guardado que se pueda desincronizar.

Tipos de carga:

- **Lineal de `q₁` a `q₂` sobre `[a, b]`** — un solo tipo que cubre uniforme, uniforme parcial, triangular y trapezoidal (el original tenía tres botones para dos de esos casos).
- **Puntual** en `a`.
- **Momento concentrado** en `a`.

Direcciones (decidido): **perpendicular a la barra**, **axial**, o **global X / Z**. Para global sobre una barra inclinada, elegir si la intensidad es **por metro de barra o por metro de proyección** (techos, nieve): es justo la pregunta que confunde en clase, y la app puede mostrar la descomposición.

Cálculo: una sola rutina exacta, `FEM = ∫ Nᵢ(x)·q(x) dx` con las funciones de forma de Hermite (y las lineales para la axial). Gauss de 3 puntos es exacto para cúbica × lineal. Las **fórmulas de tabla** se muestran igual en KaTeX con la sustitución numérica —es lo que el alumno coteja— y los tests verifican cada fórmula de tabla contra la integración.

**FEM a mano (decidido: se mantiene)**: por barra, «calcular desde las cargas» o «ingresar a mano», como en el original. Con FEM a mano **esa barra no tiene diagramas interiores** y la app lo dice en su lugar (lo contrario de V13); el resto de la estructura se dibuja igual.

### Cómo se cargan: una tabla, no un diálogo

Una tabla **«Cargas en barras»**, una fila por carga: barra (combobox), tipo, dirección, valores y posiciones. Es el patrón del resto de la app, así que hereda `FormulaInput`, insertar en el medio, persistencia, Excel y errores con nombres. Las seis columnas de FEM salen de la tabla de barras.

- Validación con nombres: posición fuera de `[0, L]`, `a ≥ b`, barra inexistente.
- Las cargas **se dibujan en el esquema** (flecha, fila de flechas con la envolvente lineal, arco del momento), y el hover fila ↔ dibujo que ya existe las vincula.

### Diagramas N, V, M en SVG, exactos

Por estática de un tramo libre: las fuerzas del extremo i más las cargas en `[0, x]`. Quedan **polinomios por tramos**, así que se evalúan exactos: en los saltos a los dos lados, y el máximo de M donde V = 0 (raíz analítica). Nada de integrar con 50 pasos.

Dos vistas:

1. **Sobre el pórtico**: cada barra con su diagrama relleno perpendicular a ella, valores en extremos y máximos.
2. **Por barra, «estilo libro»**: la barra aislada con sus cargas y fuerzas de extremo, y debajo N, V, M alineados en el mismo eje x, con un cursor que lee los tres en el punto (y la pendiente de M es V).

**Cierre**: el diagrama evaluado en `x = L` tiene que dar lo que el motor da en el extremo j. Es un test, y puede mostrarse como el equilibrio.

### Convención (decidido: la de los textos usuales — Hibbeler, Beer)

- Ejes locales: `x'` de i a j; `y'` es `x'` girado 90° antihorario (es lo que ya usa `FrameElement2D.transform`).
- **N**: tracción positiva.
- **V y M**: convención de viga de Hibbeler/Beer aplicada a cada barra mirada de i a j con `y'` «arriba»: V positivo si hace girar el segmento en sentido horario; M positivo si tracciona la fibra del lado `−y'`.
- **M se dibuja del lado traccionado**. Es la práctica en ingeniería civil (indica dónde va el acero) y la de los textos universitarios peruanos encontrados. En una viga horizontal de izquierda a derecha, el momento positivo queda **abajo**.

**Sin verificar**: no se pudo leer el texto de Hibbeler directamente. La atribución del lado traccionado a su *Structural Analysis* viene de Wikipedia (cita las pp. 146-148), y la práctica peruana de un texto universitario de la UNISCJSA. Además, Beer y el *Mecánica de materiales* de Hibbeler grafican vigas con M positivo **hacia arriba**: ver la pregunta abierta de la sección 6.

Lo que la vista hace con el motor: las fuerzas de extremo de `FrameElement2D` están en la convención **del elemento** (fuerza sobre la barra, positivo según los ejes locales, momento antihorario), no en la de viga. La conversión es `V(0⁺) = Fᵢ,y'` y `M(0⁺) = −Mᵢ` (y en j, `V(L⁻) = −Fⱼ,y'`, `M(L⁻) = Mⱼ`); vive en el motor, no en el componente.

### La deformada real (D3)

Hermite con los desplazamientos de los extremos **no alcanza**: una viga biempotrada con carga distribuida tiene giros nulos en los extremos y aun así se flecta. La deformada es Hermite **más la flecha del tramo biempotrado bajo su carga**, que sale de integrar M/EI de la solución particular. Muestreada en el motor.

## 5. Lo propio de pórticos que no se resuelve cableando

- `A` y `k` de 6×6: la cadena `A·k·Aᵀ` es la más grande de la app.
- El Excel tiene que llevar las cargas, los FEM como fórmulas de ellas, la rigidez con flexión y `F_eq = −Tᵀ·FEM`.
- La deformada de `/frame2d` **nunca se miró** después de los cambios compartidos del 2026-08-13.

## 6. Alcance de la v1 (decidido el 2026-10-17)

El usuario delegó estas tres con un criterio: **que la v1 quede estable y confiable**. Por eso se eligió en cada caso lo que reusa algo ya probado:

1. **M del lado traccionado en las dos vistas** (pórtico y barra aislada), con el signo en la etiqueta. Beer y el *Mecánica de materiales* de Hibbeler grafican vigas con M positivo arriba, pero dos reglas en la misma página confunden más de lo que ayudan.
2. **N4 y desplazamiento unitario quedan para la v2**, como en 3D. **Modo práctica: el bloque de 3×3** que ya usa `/armaduras-3d`. El ejercicio de calcular el FEM de una carga es mejor idea pedagógica, pero es nuevo: v2.
3. **El Excel llega hasta las fuerzas de extremo**, con los FEM como fórmulas vivas de los parámetros de cada carga. Los diagramas por estación en Excel quedan para la v2.

Para la v2, además: el ejercicio de FEM, N4, desplazamiento unitario, diagramas en Excel.

## 7. Plan propuesto

| Paso | Qué |
|---|---|
| 0 | Mirar la app con `chrome-devtools`, sobre todo la deformada, que nunca se miró |
| 1 | Sondeo del store y los bugs B1–B7 |
| 2 | Motor: modelo de cargas en barras, FEM por integración, direcciones y proyección, FEM a mano; tests contra las fórmulas de tabla y contra V2 |
| 3 | Tabla «Cargas en barras», validación, dibujo en el esquema; las columnas FEM salen de la tabla de barras |
| 4 | Diagramas N/V/M: estaciones exactas y cierre en el motor, SVG sobre el pórtico y vista por barra |
| 5 | Deformada real (D3) |
| 6 | Lo genérico de 2D (sección 3, filas «chico») |
| 7 | Narrativa en KaTeX, matrices grandes, el paso del FEM con su fórmula, modo práctica |
| 8 | Hover y mecanismo dibujado |
| 9 | Persistencia y ejemplos |
| 10 | Excel |

### Paso 0: lo que encontró mirar la app (2026-10-17) — hecho

- **La deformada es peor que «una recta»: miente sobre los apoyos.** Las dos columnas están empotradas y la línea sale de la base inclinada, como si fueran articuladas. Con la deformada real (paso 5) la tangente en un empotramiento tiene que salir vertical.
- Los números están bien: reacciones horizontales −2.4944 − 2.5056 = −5.0 contra la carga de 5; verticales ±1.6625 iguales a la axial de las columnas; la viga en tracción (2.4944), que es lo correcto porque la carga en v3 tira de v2 a través de ella.
- El lienzo es cuadrado (500×500) para un modelo de 8.3 × 6.5: sobra alto. Menor.
- **El área salía cortada en la tabla de barras**: 31 px de input para 34 de contenido. Con 13 columnas la tabla desborda y el navegador encoge cada columna al ancho de su encabezado, y «ÁREA» es el más corto. Arreglado en el paso 1 con un ancho fijo (`w-28`) para los números; el rediseño de la tabla (paso 3, sin las seis columnas FEM) lo vuelve menos crítico.

### Paso 1: sondeo y bugs (2026-10-17) — hecho

El sondeo del store confirmó B1–B4 y agregó dos:

- **Sin nudos ni barras el estado era `ok`**: un «resuelto» vacío. Va con B4.
- **B8 — la tabla de fuerzas internas muestra las fuerzas de extremo en la convención del elemento**: la viga sale con N = +3.40 en un extremo y −3.40 en el otro, y un alumno lo lee como que la axial cambia de signo. **No se tocó**: se resuelve con la convención de viga del paso 4.

Hecho: B1 (barra nueva hereda A, I, E; no los FEM), B2 (`withDisplayNames` + `refName`), B3 (`nextRowName` en nudos y barras; los dos `atomAdd*` aceptan `afterId`, falta el botón por fila del paso 6), B4 (estado `empty`, `NoResults`, título de Resultados adentro del panel, advertencias en el panel de errores, mecanismo con explicación propia de pórticos en `results/mechanism-explanation.tsx`), B5 (`NodeCombobox`), B6 (la nota de la tabla dice la convención, y un test la fija: q hacia abajo → V = +25, reacciones hacia arriba, momento antihorario en el extremo i). B7 queda para el paso 4/5.

Tests: `src/app/frame2d/store/store.test.ts`, 11 casos (el primer archivo de tests del store de `/frame2d`). Suite: 392 tests, `tsc` limpio, lint con los 2 errores preexistentes.

Lo que **no** se miró todavía: el estado vacío en pantalla (sí el de mecanismo), y nada en tema oscuro.

## Decisiones (2026-10-17)

- **Convención**: la de los textos usuales en Perú (Hibbeler, Beer); M del lado traccionado. Ver sección 4 y la pregunta 1 de la sección 6.
- **FEM a mano**: se mantiene, da flexibilidad. Esa barra queda sin diagramas interiores y la app lo dice.
- **Direcciones de carga**: perpendicular, axial y global X/Z con la opción de proyección.
- **Casos de carga (muerta/viva)**: **no** van en `/frame2d`. Son exclusivos de `frame2d-seismic`.
