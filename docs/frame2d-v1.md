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

### Paso 2: cargas en barras en el motor (2026-10-17) — hecho

`src/lib/engine/frame2d/member-loads.ts`, puro y sin tocar `FrameElement2D` ni `System`: el FEM sigue entrando al elemento como antes, solo que ahora sale de las cargas.

- **Modelo**: `MemberLoad` = distribuida lineal (`q1`→`q2` sobre `[a, b]`, con `projected` opcional), puntual o momento. Direcciones `perpendicular` (`+y'`), `axial` (`+x'`), `globalX`, `globalZ`; el momento, antihorario positivo. **Las posiciones van a lo largo de la barra** desde «desde», también en las cargas por proyección: lo que se proyecta es la intensidad, no la ubicación. La UI lo tiene que decir.
- **Cálculo**: carga nodal equivalente por trabajo virtual contra las funciones de forma (lineales en la axial, Hermite en la flexión; sus derivadas para el momento concentrado) y FEM = su opuesto. La distribuida se integra con Gauss de 3 puntos, **exacto** para lineal × cúbica.
- **Validación**: `memberLoadProblem` devuelve el problema en castellano sin nombrar la carga (el store le antepone la fila): posición fuera de `[0, L]` (con tolerancia relativa, porque `L` viene con ruido de punto flotante), `b ≤ a`, valores no numéricos. `loadFixedEndForces` tira si hay problema.
- **Tests (37)**, `member-loads.test.ts`: las tablas de los libros (uniforme, parcial, triangular `3qL/20`–`7qL/20`, puntual, momento concentrado —**el caso V2 del original**—, momento sobre el extremo, axial); direcciones globales en una barra 3-4-5, la proyección (las reacciones verticales suman `q·3`, no `q·5`) y una columna con carga +X; **equilibrio de 21 combinaciones** de carga y orientación integradas a fuerza bruta sin funciones de forma (la prueba que no depende de ninguna tabla); los rechazos; y dos casos con `System` de solución cerrada (simplemente apoyada: `qL/2`, momento nulo en los apoyos, giro `qL³/24EI`; ménsula con `P` al medio: flecha `5PL³/48EI`).

Lo que encontró: **un valor esperado mío estaba mal**, no el código — una carga `+X` sobre una columna es `−y'`, el mismo caso que una carga hacia abajo sobre una viga, y su FEM en «desde» es `+PL/8`, no `−PL/8`. Es exactamente la confusión de signos que la tabla de cargas le tiene que ahorrar al alumno.

Suite: 429 tests, `tsc` limpio.

### Paso 3: la tabla de cargas, el FEM por barra y el dibujo (2026-10-17) — hecho

- **Store** (`store/loads.ts`): `LoadRow` plana para los tres tipos (lo que un tipo no usa queda guardado y la tabla lo deshabilita, así cambiar de tipo y volver no pierde nada). Una carga nueva **copia la de arriba** (la misma carga en varias vigas es lo habitual); la primera va en la primera barra. `toMemberLoad` la traduce al motor con la L actual.
- **«Toda la barra»** (decisión de este paso): una distribuida guarda un interruptor en vez de `b = L` como número, encendido por defecto. Con `b` numérico, mover un nudo dejaba la carga corta o fuera de la barra sin avisar — el V3 del original por otro camino. `FormulaInput` no acepta variables, así que escribir «L» en la celda no era opción.
- **FEM a mano**: `ElementRow.manualFem`. Las seis columnas FEM **salieron de la tabla de barras** (que tenía 13 columnas por un dato que casi ninguna barra usa) a una tabla **«FEM por barra»**: una fila por barra con «a mano»; apagado muestra el FEM calculado de sus cargas (solo lectura, para cotejar con el pizarrón), encendido edita los seis valores. Una carga en una barra con FEM a mano no cuenta y **se avisa** (advertencia, no error).
- **Errores**: `DomainIssue.source` ganó `"load"` («Error en carga c1»). Una carga sin barra, en una barra borrada o con posición fuera de la barra frena el cálculo; la barra queda marcada en `brokenElementIds` y su FEM se muestra «—» (la suma de las demás sería el FEM de otra carga). El FEM sale de un átomo propio, `atomMemberLoads`, que leen el cálculo y la tabla.
- **Dibujo** (`diagram-2d/member-load-glyph.tsx`, prop opcional `memberLoads` del esquema genérico — los otros tres sistemas no cambian): puntual que **llega** a la barra; distribuida como fila de flechas proporcionales con la envolvente por las colas (una triangular se ve triangular, una que cambia de signo cruza la barra); paralela a la barra (axial, o vertical sobre una columna) con flechas cortas al costado; momento con el mismo arco que el nodal. Se apagan con su barra al resaltar. Una carga por proyección se dibuja con lo que de verdad le llega a la barra.
- **Página** a `max-w-[84rem]` (adelantado del paso 6: la tabla de cargas no entraba) con techo de prosa.
- **Tests**: 9 más en `store.test.ts` (FEM de la tabla, igual que escribirlo a mano, mover un nudo lo recalcula, copia de la fila, errores con nombre, FEM a mano con aviso, «toda la barra» apagada), uno en `axial-label.test.ts` y uno en `armaduras-2d/.../element-table.test.tsx` (Enter en el combobox, ver abajo). Suite: 440, `tsc` limpio, lint con los 2 de siempre.

Lo que encontró mirarlo:

- **La primera carga nacía en error** («No tiene barra»): el B1 de las barras, otra vez. Ahora va a la primera barra.
- **Escribir en el combobox y apretar Enter no elegía nada** — en los cuatro sistemas, porque el combobox es compartido. Base UI no marca ninguna opción mientras se escribe; `autoHighlight` lo arregla. Los tests elegían con click y no lo veían; el nuevo falla sin el arreglo (comprobado).
- **La tabla medía 1593 px.** Etiquetas de dirección cortas (los signos van en la nota), encabezados de dos renglones, campos más angostos, sin el rótulo q₁/P/M por fila: 1296 px, que entra justo a 1440 de ventana. Más angosta se scrollea en horizontal.
- **Las flechas de la viga tachaban el nombre «e2»**, porque «afuera de la figura» es justo donde cae la gravedad en la viga de arriba. `axialLabelPoint` acepta ahora un lado `occupied` que le gana al centro. Y 17 flechas en 5 m eran una mancha: ahora una cada 2.5 unidades.
- Los nombres de los nudos «v2» y «v3» siguen cruzados por la primera y la última flecha; se leen por el halo. Es D17 (las etiquetas no se conocen entre sí).
- En oscuro las cargas usan `blue-500`, la misma clase ya medida para las fuerzas nodales (5.26:1).
- **Un test de `/armaduras-3d` es intermitente**: «cada barra tiene su cadena con "Ver apilada"…» tarda ~6.5 s con la suite entera en paralelo y a veces pasa el límite de 5 s. Solo pasa siempre; dos corridas completas seguidas dieron 440/440. No es de este paso, pero conviene subirle el límite.

Quedó **sin cambiar a propósito**: el ejemplo inicial sigue sin cargas en barras (es el de la regresión del motor); los ejemplos con cargas van en el paso 9.

### Paso 4: diagramas N, V, M (2026-10-17) — hecho

- **Motor** (`src/lib/engine/frame2d/member-diagrams.ts`): `memberDiagram(fuerzasDeExtremo, cargas, eje)` por estática del tramo libre `[0, x]`, en forma cerrada (las integrales de la distribuida lineal se hacen a mano, no numéricamente). Devuelve los puntos para la curva (24 por tramo entre bordes de carga; en un salto, dos puntos con el mismo `x`), los **puntos clave** (extremos, los dos lados de cada salto, y los máximos de M donde V = 0, con la raíz cuadrática exacta), el **cierre** contra el extremo «hacia» y `at(x)` para el cursor. `beamConventionEnds` pasa las fuerzas de extremo a la convención de viga.
- **Convención** (la de la sección 4): N tracción +; V horario +; M + si tracciona `−y'`. Conversión desde el elemento: `V(0⁺) = F_i,y'`, `M(0⁺) = −M_i`, `N(0⁺) = −F_i,x'`.
- **Tests** (8 del motor + 4 del store): simplemente apoyada con uniforme (`qL/8`… `qL²/8` en el centro), biempotrada con puntual (`∓PL/8` y el salto de V), ménsula con momento (salto de M, V nulo), triangular (máximo `qL²/9√3` en `L/√3`), columna con peso propio (N lineal), `dM/dx = V`, los extremos en convención de viga, y el **cierre en un pórtico a dos aguas** con todas las clases de carga y dirección. **Prueba de mutación**: invertir el signo del momento de la distribuida rompe 4 tests; contar una carga concentrada justo en `x` de los dos lados rompe 2.
- **Vista sobre el pórtico** (`diagram-2d/internal-force-diagram.tsx`, genérico): selector N / V / M, una escala para todas las barras, N y V positivos del lado `+y'`, **M del lado traccionado**. Violeta, porque azul, verde, rojo y ámbar ya significan otra cosa; texto a 7.3:1 en claro y 10.6:1 en oscuro (medido).
- **Barra aislada «estilo libro»**: la barra horizontal con sus nudos nombrados y sus cargas en ejes locales arriba, y N, V, M alineados debajo, cada uno con su escala, M positivo hacia abajo (lado traccionado, igual que en el pórtico). Un cursor da los tres valores exactos en el punto (`at(x)`).
- **B8 resuelto**: la tabla de fuerzas internas muestra las dos convenciones rotuladas — `f_local` (la de la matriz, la que tiene signos opuestos en los extremos) y los esfuerzos N, V, M de viga — con un párrafo que explica por qué no conviene mezclarlas.
- Las barras con **FEM a mano** no tienen diagrama, y la sección lo dice con la razón (lo contrario de V13).

Lo que encontró mirarlo (con el pórtico semilla y q = −10 sobre la viga):

- **Los números se verificaron contra la física**, no solo contra los tests: la viga da `31.25 − (3.79 + 12.10)/2 ≈ 23.30` contra el máximo de 23.44 (corrido del centro por la asimetría); V baja 50 = qL y cruza cero en x = 2.33; las reacciones horizontales suman −5 y el +0.905 de la base izquierda es el empuje de la gravedad (+3.40) menos el de la carga lateral (−2.49); el cursor en x = 2.5 da lo que da la cuenta a mano.
- **El momento de cada esquina salía dos veces** (viga y columna, que en un nudo de dos barras valen lo mismo por equilibrio). `mergeJointLabels`, solo para M: en V y N dos valores iguales en un nudo serían casualidad.
- **Los números centrados cruzaban las columnas**: se anclan por el lado que da a la barra, como en `axialLabelPoint`; y en una barra horizontal, el número del extremo crece hacia adentro.
- **Un esfuerzo constante con dos números caía en las esquinas**: medido, cuatro números de N se pisaban. Ahora se escribe una vez, a mitad de la barra, como en los textos. Medición final con un script que busca texto que cruce una barra o pise otro texto: **cero en los tres diagramas**.
- La barra aislada tenía una franja de cargas alta y vacía cuando la barra no tiene cargas, y no decía qué nudo es cada extremo: ahora la franja se achica y los nudos van rotulados.

Lo que **no** se miró: un pórtico inclinado en pantalla (sí en el test de cierre), ni una pantalla angosta.

Queda para el paso 5: B7 (el color de la deformada supone N constante, y con carga axial ya no lo es).

### Paso 5: la deformada real (2026-10-17) — hecho

- **Motor** (`src/lib/engine/frame2d/member-deflection.ts`): deformada de cada barra = **homogénea** (Hermite con desplazamientos y giros de los extremos; lineal para `u`) + **particular** (la flecha de la barra biempotrada bajo su carga, de integrar `EI·v'' = M` con `M` = el diagrama de esa barra con el FEM como fuerzas de extremo; y `EA·u' = N` para la axial). Con `v(0) = v'(0) = 0`, que `v(L) = v'(L) = 0` salga solo es el **cierre**.
- **La integral es exacta**: Gauss de 3 puntos por intervalo entre puntos del diagrama (ahí `M` es a lo sumo cúbica), con `v₁ = v₀ + θ₀h + ∫(x₁ − s)M/EI` para que el integrando sea de grado 4. **La primera versión usaba trapecios** y erraba en la quinta cifra; los tests contra las flechas de los libros la descartaron, y ahora piden 9 cifras.
- **Tests** (6 + 3 del store): simplemente apoyada con uniforme `5qL⁴/384EI`; biempotrada `qL⁴/384EI` con los nudos quietos y tangente horizontal (al doble de distancia del apoyo, el cuádruple de flecha); ménsula `qL⁴/8EI` en la punta y `17qL⁴/384EI` a la mitad; ménsula con carga nodal (Hermite sola, `PL³/3EI` y `5PL³/48EI`); apoyada con puntual `PL³/48EI`; y el cierre de la particular con cargas mezcladas. **Mutación**: invertir el signo de la particular rompe 5 de 6.
- **Vista**: `DeformedDiagram` ganó dos props opcionales — `elementShapes` (la curva de cada barra) y `colorByForce` — y los otros tres sistemas no cambian. En `/frame2d` la deformada muestra **solo la forma**, en el color del texto, sin número de axial (**B7**: con carga axial N varía a lo largo de la barra, y ya tiene su diagrama). La leyenda lo dice, y nombra las barras con FEM a mano, que se curvan solo por sus extremos.

Lo que encontró mirarlo, **midiendo sobre el SVG**:

- **El empotramiento ya no gira**: con la semilla, el primer tramo de cada columna se aparta 0.64° de la vertical contra 5.7° de la cuerda entera (lo que antes era la inclinación de toda la columna, desde la base).
- **Los nudos siguen rígidos**: el ángulo entre la viga y cada columna da 90.5° y 92° con factor 50, y 90.1° y 90.4° con factor 10. La diferencia cae con la escala en proporción, así que es la cuerda de un tramo de L/24 sobre una curva exagerada, no un giro relativo; las tangentes verdaderas coinciden por construcción (Hermite da `v'` = giro del nudo y la particular tiene `v' = 0` en los extremos).
- Con q = −10 en la viga, se flecta con contracurva cerca de las esquinas, donde el momento es negativo — lo mismo que dice el diagrama de M.

Lo que **no** se miró: la deformada en oscuro (el trazo es `stroke-foreground`, el mismo de las barras del esquema), y un pórtico inclinado en pantalla.

### Paso 6: lo genérico de los otros sistemas (2026-10-17) — hecho

- **Nudos**: encabezados en dos niveles (U1) con los grupos propios de un pórtico —Coordenadas tiene dos ejes, el resto tres, y el tercero dice `M` en las fuerzas y `θ` en desplazamientos, restricciones y numeración—; insertar fila (D7); **numeración manual de grados de libertad (M1b)**, rescatada del original (`areDofDefinedByUser`). Medido: la tabla entra justo en 1296 px sin valores cortados.
- **Barras**: insertar fila (D7) y **«Aplicar a las n barras»** con A, I y E (el `changePropertiesForAllEdges` del original).
- **Orden de grados de libertad (M1a)**: «los restringidos van arriba», en la sección 1, rescatado (`areRestrictedsOnTop`).
- **Clasificación** `g = 3b + r − 3n` entre el esquema y los resultados, con el veredicto cruzado con el motor. El pórtico inicial da `9 + 6 − 12 = 3`, hiperestático; con articulado y móvil, 0.
- **Nota de unidades (U5)** con el ejemplo de pórticos (inercia en m⁴, momentos en tonf·m, giros en radianes) y su error típico: la inercia en cm⁴ de una tabla de perfiles con coordenadas en metros, 10⁸.
- **Cascada de decimales (D8)** por sección (`DecimalsScope` en cada sección del acordeón); la tabla de fuerzas internas lee `useDecimals`. El stepper **por tabla** llega con las matrices del paso 7 — hasta entonces el texto de la sección lo menciona sin que exista.
- El acordeón pasó al de `ui-custom/` (el contenido puede crecer después de abierto: la sección de diagramas cambia de alto al cambiar de barra o de esfuerzo).
- **Verificación de equilibrio (N5)**, sección 7, con el sello en el título.

**Lo que encontró** — dos bugs del motor que estaban escondidos porque `/frame2d` nunca mostró esta verificación:

1. **El equilibrio global de un pórtico daba siempre «no cierra»**, aun con el pórtico inicial sin cargas en barras: sumaba los momentos de los nudos como una componente más, sin brazos de palanca (con dos empotramientos, 4.58 + 4.60 = 9.19 de «residuo»). Ahora la tercera componente global es **ΣM respecto del origen**: `Element` ganó `nodePositions` opcional (solo lo tiene `FrameElement2D`; armaduras y resortes no cambian) y las cargas de barra entran por su carga nodal equivalente, que tiene la misma resultante.
2. **La columna «carga» del nudo incluía la carga equivalente de las barras**, y la fuerza de cada barra sobre el nudo era solo `−k·u`. La suma daba igual, pero el alumno veía en un nudo una carga que nunca puso, y fuerzas de barra que no eran las de la tabla de fuerzas internas. Ahora cada barra aporta su **fuerza de extremo verdadera** `−(k·u + Tᵀ·FEM)` y la carga del nudo es solo la del nudo: el diagrama de cuerpo libre de verdad.
- Por lo mismo, el texto genérico de la fila final («las barras se cancelan de a pares») era falso en un pórtico: `EquilibriumSection` ganó `structureTotal`, y en `/frame2d` esa fila muestra solo el residuo global, con un párrafo que explica por qué (una barra cargada no tira igual de sus dos extremos, y sus momentos se equilibran con el corte por el largo).

Lo que encontró mirarlo:

- **La fórmula de la clasificación salía «3cdot3»**: al escribir el archivo con un heredoc de bash se perdió una barra del `\\cdot` dentro del template literal. Verificado en el DOM de KaTeX que ahora es `3⋅3`.
- La tabla de equilibrio se cortaba con el tope `max-w-5xl` de las armaduras (13 columnas numéricas): sin el tope, entra.
- **«−0.0000»** en los momentos de los nudos libres: ruido redondeado con signo. El componente genérico ahora escribe sin signo lo que se redondea a cero (alcanza a los cuatro sistemas).

Tests: 2 del motor (cuerpo libre de un pórtico cargado; una reacción de momento que sobra no pasa el control global) y 8 del store (equilibrio del inicial y del cargado, clasificación, orden, numeración, «aplicar a todas», insertar). Suite: 471, `tsc` limpio, lint con los 2 de siempre.

### Paso 7: narrativa, matrices grandes y modo práctica (2026-10-17) — hecho

- **Sección 1**: las fórmulas una vez arriba (la `k` de 6×6 con los términos de flexión, `T` y por qué deja el giro intacto) y por barra la cadena **`K = Tᵀ·k·T`** con `ChainEquation` («Ver apilada», «Pantalla completa») y stepper de decimales propio — con esto existe el «por tabla» de la cascada (D8). Debajo de cada barra cargada, **el FEM**: cada carga con su vector, la superposición y el pasaje a globales `Tᵀ·FEM`; con FEM a mano, el vector escrito. Un desplegable con **las fórmulas de tabla** de los tres casos de libro y la integral general que usa el programa.
- **Sección 2**: el ensamblaje y la ecuación global genéricos (reemplazan a los propios, que mostraban todos los pasos abiertos). Con cargas en las barras la ecuación es **`F = K·U + FEM`**.
- **Sección 3**: la partición genérica, con **`Uf = Kff⁻¹·(Ff − FEMf − Kfr·Ur)`** y **`Rr = Krf·Uf + Krr·Ur + FEMr`**.
- **Sección 4**: por barra, la cuenta **`f = k·u + FEM`** con sus operandos (plegada si hay más de 4 barras).
- **Modo práctica**: dónde aporta una barra y el **bloque de 3×3** del nudo de origen en ejes globales, con su fórmula. A diferencia de 3D, el texto **no** dice que los otros bloques son el mismo con el signo cambiado: en un pórtico no lo son (`2EI/L` contra `4EI/L`).
- **Motor**: `AssemblyResult.fixedEndForces`, el FEM global por índice (`−F_eq`). Las ecuaciones genéricas muestran el término solo si no es todo cero: armaduras y resortes quedan como estaban (verificado en las tres páginas: cero términos FEM).

Lo que encontró:

- **Un bug en los cuatro sistemas**: la tabla rotulada `K_ff⁻¹` en el despeje de `Uf` mostraba **`K_ff`**. No era una decisión documentada (lo que sí está decidido es que el motor invierte en vez de factorizar, D15). Ahora muestra la inversa; verificado en la página: con los números mostrados (4 decimales), `Kff⁻¹·(Ff − FEMf − Kfr·Ur)` da `Uf` a 3–4 cifras — con `Kff` habría dado del orden de 10⁶.
- **El test que importa**: con q en la viga, las ecuaciones de la pantalla reproducen la solución del motor (desplazamientos a 12 cifras, reacciones a 8). Si el signo de `fixedEndForces` estuviera invertido, el alumno haría la cuenta y no le daría.
- **Las barras invertidas dobles se pierden en el texto de los comandos de shell** (heredoc, `python -`, aun con cadenas crudas): rompieron la ecuación de la partición en los cuatro sistemas (`F_f \ F_r`), el `\\mathrm` de la sección 4 y, en el paso 6, el `\\cdot` de la clasificación. Ningún test lo ve —son strings válidos—. Regla nueva: **TeX solo con Edit/Write**, y verificación en la app buscando `.katex-error` y TeX colado en el texto de KaTeX con todas las secciones abiertas: 135 fórmulas en `/frame2d`, 125/66/96 en las otras tres, **cero** errores.
- **Un error de hidratación**: la fórmula del modo práctica iba en la `instruction` del ejercicio, que el componente envuelve en un `<p>`, y un bloque de KaTeX es un `div`. Lo marcó la consola (y el «2 Issues» de Next); la fórmula pasó afuera, y la matriz ganó `\arraystretch` porque los renglones con fracciones se tocaban.
- «por superposición de sus carga» con una sola carga: ahora «de su carga».

Tests: 2 del store (la sustitución reproduce la solución; sin cargas de barra el vector FEM es todo ceros, sin `−0`). Suite: 473, `tsc` limpio, lint con los 2 de siempre.

## Decisiones (2026-10-17)

- **Convención**: la de los textos usuales en Perú (Hibbeler, Beer); M del lado traccionado. Ver sección 4 y la pregunta 1 de la sección 6.
- **FEM a mano**: se mantiene, da flexibilidad. Esa barra queda sin diagramas interiores y la app lo dice.
- **Direcciones de carga**: perpendicular, axial y global X/Z con la opción de proyección.
- **Casos de carga (muerta/viva)**: **no** van en `/frame2d`. Son exclusivos de `frame2d-seismic`.
