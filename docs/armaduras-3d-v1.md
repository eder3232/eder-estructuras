# `/armaduras-3d` para la v1: revisión y alcance (2026-10-15)

> **Estado: alcance decidido (2026-10-15), trabajo sin empezar.** El plan es la sección 5 y las decisiones, la sección «Decisiones». Lo primero es el **paso 0**.

Cómo se revisó: el código entero del módulo (1202 líneas, **un solo archivo de tests**, el del store), el motor 3D, el patrón de visualización ([`diagram-3d-pattern.md`](./diagram-3d-pattern.md)), el `armor3d` original, y un sondeo del store y del motor con casos borde. **La escena no se miró**: nunca se miró, y es el primer paso (ver «Paso 0»).

## 1. Bugs (los mismos que tenía `/springs`, más uno)

| # | Qué | Evidencia |
|---|---|---|
| B1 | **Una barra nueva nace en error**: `atomAddElement` la crea con `área = 0` y `E = 0`, que el motor rechaza. Es lo de `/springs` con `k`: tiene que heredar `A` y `E` de la fila de arriba. | Código |
| B2 | **Los errores del motor muestran ids internos.** `TrussElement3D` recibe `element.id`, así que un área inválida dice «El elemento **seed-e1**…» (o un UUID en una barra nueva). `/armaduras-2d` y `/springs` ya lo resuelven con `src/lib/display-names.ts`. | Código |
| B3 | **Nombres repetidos.** Borrar `e1` y agregar dos barras da `e6, e6, e7`. Usa `e${length + 1}`; los otros dos usan `nextRowName`. | Sondeo |
| B4 | **Sin barras, el panel dice «mecanismo»** en vez de «no hay nada que resolver». Y en cualquier error el panel de resultados devuelve `null` (U3). | Sondeo |
| B5 | El **signo doble** en las sustituciones de las fuerzas internas: con un desplazamiento negativo sale `(0.0065 − -0.0012)` y `N = 13333 × -0.0012`. Es el bug que `/armaduras-2d` corrigió en `a4aabf3`. | Código |
| B6 | **Desde = Hacia** se puede elegir: el `Select` ofrece todos los nudos y el error recién aparece después («longitud cero»). En los otros dos, el combobox lo previene. | Código |

Lo que **sí está bien** y conviene saberlo: el store ya revisa las referencias a nudos borrados antes del motor (con nombres), y el **diagnóstico de mecanismo funciona en 3D**. El roadmap lo tenía como no probado («en 3D los modos de cuerpo rígido son 6») y el sondeo lo probó: un tetraedro aplastado (el nudo `d` en `z = 0`) da el grado suelto exacto, **`d` en z**, y una estructura sin apoyos da un modo de cuerpo rígido coherente.

## 2. Lo que tiene `/armaduras-2d` y `/armaduras-3d` no

| Función | ¿Aplica? | Costo |
|---|---|---|
| Estado vacío (U3), advertencias (E2), equilibrio (N5), nota de unidades (U5) | Sí, con los genéricos de `custom/` | Chico |
| Clasificación `g = b + r − 3n` | Sí: `determinacy` ya acepta los coeficientes | Chico |
| Insertar fila (D7), cascada de decimales (D8), combobox (U2) | Sí | Chico |
| Orden de grados de libertad (M1a/M1b) | Sí. **El `armor3d` original tenía los dos checkboxes** (`areRestrictedsOnTop`, `areDofDefinedByUser`): es un rescate, no algo nuevo | Chico/mediano |
| Encabezados agrupados (U1) | **Sí, y acá hacen más falta**: la tabla de nudos tiene 13 columnas de datos (con M1b, 16) | Chico |
| Persistencia con «Deshacer» (N1) y ejemplos (N2) | Sí, con clave propia | Mediano |
| Narrativa en KaTeX (D11): `A·k·Aᵀ`, `F = K·U`, partición coloreada, sustituciones | Sí, **pero no entra** (ver «Limitaciones») | Mediano |
| Modo práctica | Sí, con un matiz: completar a mano una matriz de **6×6** es tedioso | Mediano |
| Mecanismo explicado | En texto, sí (nombra el nudo y el eje). **Dibujado** es otra cosa: ver «Decisiones» | Chico / mediano |
| Tabla ↔ dibujo por hover (N3) | **Posible**: `@react-three/fiber` trae eventos de puntero sobre las mallas. En 3D vale más que en 2D: es la forma de saber **cuál barra es cuál** después de rotar | Mediano |
| Matriz ↔ modelo por hover (N4) | Difícil: en 2D dibuja un modelo chico al lado de la matriz, y acá sería un **segundo lienzo WebGL** | Grande |
| Desplazamiento unitario | Posible, reusando la escena deformada | Mediano |
| Animación de la deformada | Posible | Chico/mediano |
| Excel | Ver la sección 3 | Mediano |

## 3. La exportación a Excel

**El libro sale casi gratis.** Ensamblaje y Solución ya son hojas comunes (`matrix-method-sheets.ts`), así que hace falta una hoja Barras con `Δz`, `L = √(Δx² + Δy² + Δz²)`, tres cosenos y la `A` de 6×2 en vez de 4×2. Se verifica igual que los otros dos: HyperFormula en los tests y Excel por COM.

**La imagen no.** Exportar el lienzo WebGL a PNG es fácil, pero **los nombres de los nudos no están en el lienzo**: son etiquetas DOM (`<Html>` de drei), a propósito ([`diagram-3d-pattern.md`](./diagram-3d-pattern.md)). La captura saldría sin nombres, y entonces no sirve para leer el libro. Además, una vista 3D fija elige un ángulo desde el que alguna barra tapa a otra. **Propuesta: sin imagen en la v1**, como `/springs`, y el libro lo dice.

## 4. Limitaciones propias del 3D (lo que no se arregla con cablear)

1. **La cadena `K = A·k·Aᵀ` no entra.** En 2D ya hizo falta ensanchar la página a `max-w-[84rem]` para la versión 4×2 · 2×2 · 2×4 = 4×4. En 3D es 6×2 · 2×2 · 2×6 = 6×6: cuatro columnas más **por lo menos**. Es la deuda **D12** (la ecuación que no se adapta a sus operandos), que esta página obliga a encarar, o a mostrar la cadena con scroll horizontal.
2. **Las matrices globales crecen más rápido**: 3 grados por nudo. El ejemplo inicial tiene 12×12; una armadura chica de 6 nudos, 18×18. Los pasos de ensamblaje son una matriz global **por barra** (D14). Alcanza con que los ejemplos sean chicos, pero hay que **medirlo**, no suponerlo.
3. **La escena nunca se miró** (D5), ni en claro ni en oscuro. Y en oscuro importa más que en el resto, porque los colores pasan por `theme-colors.ts`, que **lee el tema una vez** y no se suscribe: lo más probable es que **no se repinte al cambiar de tema**.
4. **Headless y WebGL**: la receta de captura que usa el repo no se probó nunca con un lienzo WebGL. Chrome headless suele necesitar un renderizador por software (SwiftShader). Si no anda, la verificación visual de la escena queda a mano.
5. **Hover y rotación compiten por el mouse.** Si entra N3, pasar el mouse sobre una barra no puede disparar la rotación de `OrbitControls` ni al revés. Es la decisión de UX más delicada de este módulo.

## Paso 0: lo que encontró mirar la escena (2026-10-15)

**Cómo capturar WebGL en headless**: la receta de siempre, pero **sin `--disable-gpu`** y con `--enable-unsafe-swiftshader`. Con `--use-angle=swiftshader` la escena sale vacía aunque el DOM tenga el lienzo y las etiquetas. Para saber si una escena corre sin mirarla: `--dump-dom` y buscar el `<canvas data-engine="three.js ...">` y las etiquetas `<Html>` con su `translate3d`.

1. **La escena nunca siguió al tema.** ✅ Arreglado. Tailwind v4 compila los tokens a `lab(...)`, el conversor `oklch → sRGB` escrito a mano no lo reconocía, y **todos** los colores caían a la reserva, que es la paleta clara: en oscuro, barras casi negras sobre fondo negro. Los tests del conversor pasaban porque probaban el formato de `globals.css`, no el que devuelve el navegador. Además se descartaba la transparencia: `--border` de oscuro es blanco al 10% y la grilla salía **blanca pura**. Ahora el navegador resuelve el color (lienzo 2D de 1×1), la transparencia se compone sobre `--background`, y la lectura es una **suscripción** a la clase de `<html>` (`useDiagramColors`), así que la escena se repinta al cambiar de tema. Verificado en oscuro y con un cambio de tema en caliente.
2. **Las columnas X, Y, Z de la tabla de nudos están aplastadas**: las coordenadas no se leen, en los dos temas. Va con los bugs (paso 1).
3. **Las tres reacciones de cada apoyo se escriben en el mismo lugar** en la deformada (`14.2857` encima de `-2.8571` encima de `0.0000`), y se dibuja `-0.0000`. Va con los bugs.
4. **Los nombres de nudo** son de 10 px y van en el verde de `--primary`: en oscuro casi no se leen. Va con los bugs, midiendo el contraste.

## 5. Alcance de la v1 (decidido por el usuario, 2026-10-15)

**Paso 0: mirar la escena** antes de cualquier otra cosa, en los dos temas. Es lo único del módulo que no se vio nunca, y lo que encuentre puede cambiar el resto.

**v1**, extrayendo a genérico en vez de copiar (el criterio de `/springs`), y en este orden:

1. [x] **Bugs** B1–B6 y los hallazgos 3 y 4 del paso 0, con tests (2026-10-15). B6 se resolvió con el `NodeCombobox` compartido. La función que pone entre paréntesis los negativos de una sustitución (B5) estaba copiada en 2D y en `/springs`: pasó a `src/lib/operand.ts`. Las reacciones van ahora **en una sola etiqueta por apoyo**, una componente por renglón, y no se dibuja lo que a los decimales actuales se lee como cero; las flechas eran un 5% de la figura y no se veían, ahora son más del doble. Los nombres de nudo usan el mismo arreglo que el esquema 2D (`dark:text-green-500`). **El hallazgo 2 (columnas X, Y, Z aplastadas) pasó al paso 2**, porque la tabla de nudos se reescribe ahí entera (encabezados agrupados, insertar filas, numeración de grados de libertad), y los encabezados agrupados son justamente lo que les da ancho en 2D.
2. [x] **Lo de `/armaduras-2d` que no pide dibujo** (2026-10-15): U3, E2, N5, U5, clasificación `g = b + r − 3n`, D7, D8, U2, U1, M1a/M1b, el mecanismo explicado en texto, y la página a `max-w-[84rem]`. Con tests del store (clasificación, los dos órdenes, advertencias). Lo que apareció:
   - **D2 resuelta**: la tabla de barras de las dos armaduras es una sola, `custom/truss-element-table.tsx`, que recibe los átomos de cada sistema. 3D ganó así insertar por fila y «aplicar a todas las barras».
   - **La clasificación ve el tetraedro aplastado**: `d` en `z = 0` da `g = 1` y el veredicto «inestable por su disposición», y el mecanismo nombra **`d` en z** y explica por qué (todas sus barras en un plano). Un test lo fija.
   - **El texto del mecanismo decía algo falso**: hablaba de «un giro del conjunto» cuando lo único que se mueve es el grado suelto. Ahora ese párrafo sale solo si el modo mueve otros nudos.
   - **Una barra de scroll sobre una tabla que entra**: el `Checkbox` de `ui/` agranda su área de click 12 px con un `::after`, y la celda de `ui/` le saca el padding derecho (`[&:has([role=checkbox])]:pr-0`). En la última columna salía 3 px por fuera. Se encontró **midiendo** qué elemento sobresalía, después de dos hipótesis equivocadas (el borde de la tabla, y un `pr-4` que esa variante pisaba). **La tabla de nudos de 2D termina igual en un checkbox, así que probablemente tenga lo mismo**: revisarla en el paso 3.
3. [x] **Matrices grandes** (2026-10-16), en componentes compartidos y **aplicadas también a `/armaduras-2d` y `/springs`**. Tests en `custom/large-matrices.test.tsx` y capturas en los dos temas, con un modelo de 22 grados de libertad cargado por `localStorage`:
   - **Vista ampliada**: `custom/chain-equation.tsx` (la cadena, con «Ver apilada»; es el prototipo de `/dev`, que se borró) y la prop `expand` de `MatrixEquation`, que agrega «Pantalla completa» en fila. Llevan el botón la cadena de cada barra en 2D, `F = K·U` y las dos ecuaciones de la partición. En 3D la cadena y la ecuación global entran con la narrativa del paso 4.
   - **D13**: `MatrixTable` con `heatmap` (celdas coloreadas por signo y magnitud, sin números, con las filas del mismo alto que las de números para que `F`, `K` y `U` sigan alineadas). En `F = K·U` es un interruptor «K como mapa» que **arranca encendido pasados 19 grados de libertad** (`HEATMAP_ABOVE_DOFS`, lo que entra en pantalla completa a 1920 px). El número se lee en una línea fija encima de la ecuación, que también va a la pantalla completa (prop `header`), y la celda simétrica se enmarca en vez de rellenarse. La lectura iba al principio en un renglón que envolvía: **la ecuación saltaba al mover el mouse**, porque la leyenda cambiaba de renglón según el largo del valor. Ahora son dos renglones fijos.
   - **D14**: `custom/assembly-steps.tsx`, uno solo para los tres sistemas. Pasados 12 grados de libertad (`COLLAPSE_ABOVE_DOFS`) los pasos van cerrados en un acordeón que abre de a uno. **Las tres copias ya se habían separado**: la de `/springs` y la de 3D no tenían contenedor de scroll, así que una matriz ancha se recortaba contra el `overflow-hidden` del acordeón, y tampoco tenían selector de decimales por paso. El selector ahora va pegado al texto del paso y no al borde (en 3D quedaba a 500 px de su etiqueta).
   - **El desborde del checkbox no está en 2D ni en `/springs`**: medido, ninguna tabla scrollea. Ahí la última columna de checkbox va centrada en una columna ancha, y el `::after` no llega al borde.
   - Queda como está: en `F = K·U` los renglones de `K` van ~12 px corridos respecto de `F` y `U`, porque `K` tiene encabezado de columnas y los vectores no (`items-center`). Venía así de antes.
4. [x] **Narrativa en KaTeX y modo práctica** (2026-10-16). Tests en `armaduras-3d/components/results-panel.test.tsx` (los botones, y los dos ejercicios resueltos de punta a punta) y en el motor; capturas en los dos temas.
   - **Motor**: `TrussElement3D.breakdown()`, como en 2D, y `stiffness()` sale de ahí. Un test fija la forma que enseña la página: los cuatro bloques de 3×3 son el mismo con el signo cambiado, y cada celda vale `EA/L·Cᵢ·Cⱼ`.
   - **Matrices locales**: las fórmulas una vez arriba (`k`, la `A` de 6×2, `K = A·k·Aᵀ`, y la forma en bloques con `K_aa`), y por barra la cadena con «Ver apilada». Antes recalculaban los cosenos con las coordenadas; ahora todo sale del elemento del motor. Lo mismo en **fuerzas internas**, que además ganó la fórmula de `δ` y `N` en KaTeX.
   - **Ensamblaje**: `F = K·U` genérica, con su pantalla completa y el mapa. Va **sin N4**, que en 3D pide dibujar en la escena (v2).
   - **Partición**: la genérica de 2D y `/springs`. La de 3D mostraba los cuatro bloques sueltos y las incógnitas como tablas aisladas, sin la matriz reordenada, sin el control de pivotes y sin las ecuaciones.
   - **Modo práctica**: «¿dónde aporta?» con las 36 posiciones, y el bloque de 3×3 del nudo de origen, corregido contra la `K` del motor recortada.
   - La cadena de una barra no entra en la página a 1400 px (corta `Aᵀ`): es lo que se esperaba, y para eso está la vista apilada, que entra en ancho y scrollea en alto.
5. **Escena**: el hover tabla ↔ escena (N3), sin pelear con la rotación, y el **mecanismo dibujado**.
6. Persistencia (clave propia) y **cuatro ejemplos**, cada uno con su lección verificada en un test: el **tetraedro** (el actual, hiperestático de grado 1, con el apoyo que cede); el **trípode isostático** (los esfuerzos no dependen del material); el **tetraedro aplastado** (un nudo con todas sus barras en un plano no tiene rigidez fuera de él: el conteo da `g ≥ 0` y la matriz dice mecanismo, la lección que solo existe en 3D); y una **torre de libro de 8–10 nudos**, que ejercita la pantalla completa, el mapa y el ensamblaje cerrado.
7. **Excel sin imagen**, verificado con HyperFormula y por COM.

**v2**: N4 (matriz ↔ modelo), desplazamiento unitario, Excel con imagen, `K` por bloques de nudo (`K_ab` de 3×3), D16 (dibujar el asentamiento, que el ejemplo inicial de 3D ya tiene), y vistas predefinidas (planta/elevación). Además de temperatura, defectos y apoyos inclinados, que ya estaban anotados para la v2 en `/armaduras-2d`.

## Decisiones (2026-10-15)

1. **La cadena `A·k·Aᵀ` de 6×6: en fila por defecto, y apilada a pedido** (aprobado por el usuario el 2026-10-15). **El botón se muestra siempre** en las ecuaciones que son o pueden ser grandes, no solo cuando la ecuación no entra: en 3D lo son casi todas. Por defecto va en fila con scroll horizontal, como en 2D: a 1400 px eso ya corta `Aᵀ` a la mitad. Un botón «Ver apilada» abre la misma ecuación en un `Dialog`: la forma simbólica arriba y los operandos uno debajo del otro. Las dos vistas salen de la misma lista de operandos. El prototipo estuvo en la ruta de trabajo `/dev`; aprobado, pasó a `custom/chain-equation.tsx` y `/dev` se borró (paso 3). Mirarlo encontró lo que se esperaba al estrenar `ui/dialog.tsx`, que nadie usaba: el título en `uppercase` (pisado con `normal-case`) y un ancho de `sm:max-w-md` que no alcanza para `K` (pisado con `sm:max-w-3xl`, con scroll vertical adentro). Queda en inglés el «Close» del lector de pantalla, que vive en `ui/`. **Una vez aprobado, la vista pasa a `src/components/custom/` y se borra `src/app/dev/`.**
1b. **La ecuación global `F = K·U` grande: v1, con dos herramientas** (2026-10-15). Apilarla no sirve: el problema es un solo operando (`K`), y apilada pierde la alineación renglón a renglón de `F`, `K` y `U`, que es lo que enseña. Medido en `/dev`, cada columna ocupa ~76 px, así que la ecuación pide ~`76·DOF + 270` px contra ~1300 útiles: entra hasta ~13 grados de libertad. Entonces: **(a)** el mismo botón abre la ecuación **en pantalla completa y en fila**, que en 1920 px lleva el límite a ~19 grados de libertad (una armadura 3D de 6 nudos de libro); **(b)** **D13**, `K` como mapa de celdas coloreadas por signo y magnitud con el valor al pasar el mouse, para lo que ni así entra (torres y cúpulas de libro, 24–30 grados de libertad).
2. **Hover tabla ↔ escena (N3): v1.** Queda por resolver que el hover no dispare la rotación de `OrbitControls`, ni al revés.
3. **Mecanismo dibujado en la escena: v1**, además de explicado en texto.
4. **Excel: sin imagen** en la v1, y el libro lo dice.
5. **Las herramientas de matrices grandes van a los tres sistemas**, no solo a 3D.
6. **D14 (pasos de ensamblaje cerrados) entra en la v1.**
7. **Modo práctica: completar un bloque de 3×3**, no la 6×6 entera.
8. **Ejemplos: los cuatro**, torre de libro incluida.
