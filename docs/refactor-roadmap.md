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

**Por qué este orden**: la tentación es migrar programa por programa (terminar armor2d, luego armor3d, etc.), pero eso repetiría el error original — cada programa reconstruiría su propia versión del motor antes de que exista una versión compartida probada. En vez de eso, el orden va de abajo hacia arriba: motor genérico primero, validado contra el caso más simple, luego un segundo caso para confirmar que la abstracción generaliza, y recién ahí se despliega al resto.

| Fase | Qué | Por qué en este orden |
|---|---|---|
| 0 | ✅ Hecho: setup de shadcn, convenciones de git/componentes, `NumberInput`/`FormulaInput` | Base para todo lo demás |
| 1 | Motor de cálculo genérico (`Node`, `Element` con matriz de rigidez local enchufable, `System` con ensamblaje/partición/solución) + vocabulario unificado. Validar de inmediato portando **springs** (el caso más simple: 1 DOF/nodo, sin necesidad de visualización) | Springs es el caso trivial — si el diseño del motor no sirve ni para el caso más simple, mejor descubrirlo aquí y no después de comprometerse con 5 programas |
| 2 | Portar **armaduras 2D** (armor2d) al motor: 2 DOF/nodo, rigidez axial con transformación por ángulo | Segundo caso, con más complejidad real (rotación, más DOF). Si el motor generaliza de springs a esto, es señal fuerte de que el diseño es correcto |
| 3 | Estandarizar el patrón dominio↔estado (Jotai) y el patrón de tablas de entrada (usando `FormulaInput`/`NumberInput` ya construidos) como plantilla única | Con 2 sistemas migrados ya se ve el patrón real de uso, no uno hipotético |
| 4 | Capa de visualización 2D compartida (SVG/Canvas2D), reemplazando three.js en los casos 2D. Conectarla primero a armor2d (ya migrado en Fase 2) | Separada del motor a propósito — el motor no debería saber cómo se dibuja nada |
| 5 | Portar **frame2d** (3 DOF/nodo, rigidez con flexión — la fórmula de elemento más compleja), luego **frame2d-seismic** como extensión real sobre frame2d (no como fork copiado), luego **armor3d** (3 DOF/nodo, mantiene three.js) | Frame2d-seismic explícitamente no debe repetir el bug de duplicación encontrado en el diagnóstico |
| 6 | Feature nueva: exportación a Excel con fórmulas vivas (ver sección dedicada abajo) | Depende de que el motor tenga una estructura de ensamblaje estable y única — generar el exportador contra 5 clases inconsistentes hubiera significado escribirlo 5 veces |
| 7 | Migración de contenido educativo (`src/content`, sección `learn`/`thesis`) | Bajo riesgo, sin dependencias técnicas fuertes, se hace cuando convenga sin bloquear nada |

## La exportación a Excel con fórmulas vivas

El requisito real: el usuario cambia fuerza, área o módulo de elasticidad en el Excel exportado, y el archivo **recalcula solo**, sin volver a generarlo desde la app. Eso solo es posible si las celdas contienen fórmulas de Excel de verdad, no valores calculados en JS y pegados como texto.

**La parte fácil**: el álgebra lineal en sí. Excel moderno tiene `MINVERSE()` y `MMULT()` como fórmulas de array dinámico que operan sobre rangos NxN completos — no hace falta escribir eliminación gaussiana celda por celda. Un rango con `=MINVERSE(Kuu)` y otro con `=MMULT(inversa, F)` resuelven el sistema `Ku=F` igual que lo hace `mathjs` en la app, pero como fórmula.

**La parte difícil, y es justo la que mencionas**: qué celda del Excel corresponde a qué grado de libertad, y qué términos de la matriz de rigidez de cada elemento caen en qué celda de la matriz global — eso sí depende 100% de la topología (cuántos nodos, cuántos elementos, cómo están conectados, cuáles DOF están restringidos). Pero esa es exactamente la información que el motor de la Fase 1 ya calcula para hacer el ensamblaje en JS. La idea es: **reusar el mismo recorrido de ensamblaje del motor, pero en vez de sumar números, emitir una fórmula de Excel (`=SUMA(referencias de celda)`) por cada celda de la matriz global**. Así el generador de Excel no es un sistema aparte por topología — es el mismo motor, con un "modo de salida" distinto.

Riesgos técnicos a resolver antes de comprometerse con esto como feature:

- **Librería para escribir fórmulas en `.xlsx`** (no solo valores): `exceljs` soporta escribir fórmulas y su resultado precalculado (`cell.value = { formula, result }`), a diferencia de `xlsx`/SheetJS en su edición gratuita, más limitada para esto. Hay que confirmar contra la documentación actual de `exceljs`, no asumir de memoria (la misma regla que ya aplicamos con Base UI y mathjs).
- **Fórmulas de array/dinámicas en `.xlsx` generado programáticamente**: `MINVERSE`/`MMULT` como fórmulas de array necesitan definirse correctamente en el rango de salida para que Excel las reconozca al abrir el archivo (comportamiento distinto entre Excel 365 con spilling dinámico y versiones más viejas con fórmulas CSE clásicas). Esto no se sabe si funciona bien hasta probarlo.
- **`result` precalculado obligatorio**: si no se guarda un valor de resultado junto a la fórmula, algunos visores de Excel no recalculan automáticamente al abrir y el archivo se ve vacío o en error hasta forzar un recálculo manual.

**Recomendación concreta**: antes de escribir el generador, hacer un spike manual — construir a mano un Excel con fórmulas vivas para el caso más simple posible (un resorte de 2 nodos, o una armadura de 3 barras) y confirmar que `MINVERSE`/`MMULT` recalculan correctamente al cambiar fuerza/área/E. Recién con eso validado se automatiza contra el motor de la Fase 1-2. Construir el generador antes de validar el mecanismo de Excel sería apostar el diseño completo a una suposición no probada.

## Fuera de alcance por ahora

- `src/db` (usuarios, suscripciones, pagos): no se migra sin una decisión de producto explícita.
- Contenido educativo (`src/content`): se migra en la Fase 7, no bloquea nada antes.

## Próximo paso inmediato

Diseñar la Fase 1: la forma concreta de `Node`, `Element` y `System` genéricos (incluyendo cómo representar un número variable de DOF por nodo entre 1 y 3), y portar `springs` como primera prueba real del diseño.
