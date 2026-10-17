# `frame2d-seismic` para la v1: revisión, normativa y alcance (2026-10-17)

> **Estado: en curso (2026-10-17).** La revisión del original y de la normativa están hechas, el alcance lo decidió el usuario (sección 4) y el plan es la sección 6. Lo que todavía no se verificó está marcado **sin verificar**.

**Para qué existe el módulo.** Análisis Estructural 2 empieza con el análisis matricial de pórticos (`/frame2d`) y en la tercera fase pasa al análisis sísmico de edificios con la E.030: el cortante basal `V = ZUCS/R · P`, su reparto en altura, el sismo en los dos sentidos, las combinaciones de la E.060 y la envolvente para diseñar, y el control de derivas. El puente entre las dos partes es la **rigidez lateral** del pórtico, que sale por condensación estática. Este módulo es ese puente. **No** elige Z, U, S, R ni clasifica el suelo: esos parámetros los escribe el alumno (sección 3).

Cómo se revisó: `thesis-structures/src/programs/frame2d-seismic/` entero (11 221 líneas) diffeado contra `frame2d`; los PDF oficiales de la **E.030 2026** y la **E.060 2009** (sección 3); y el motor de este repo (`src/lib/engine/system.ts`) para dimensionar el diafragma rígido.

## 1. Lo que hacía el original

En la práctica era `/frame2d` con dos categorías de carga (muerta y viva) y una fuerza horizontal por nudo escrita a mano, resuelto en tres casos: sin sismo, sismo hacia la izquierda y hacia la derecha. Estaba marcado `status: "alpha"` en `shared/config/programs.ts`. **No sirve de molde**: lo único que se rescata es la idea.

| # | Qué | Evidencia |
|---|---|---|
| S1 | **Los factores 1.4 y 1.7 no entran nunca al cálculo.** Se editan y se muestra la «carga amplificada», pero se resuelve con muerta + viva sin factorar | `store/results.tsx` (suma `v.forces[c]` crudo), `store/edges.tsx` (`total = dead + live`) |
| S2 | **No hay combinaciones de norma.** Los tres casos son CM+CV, CM+CV−S y CM+CV+S, sin factores. No están 1.25(CM+CV)±CS ni 0.9CM±CS | `store/results.tsx` |
| S3 | **El FEM del extremo j de la carga muerta suma los valores del extremo i** (`femJZ: a2.femIZ + c2.FEM.femIZ`): en una carga repartida simétrica el momento en j sale con el signo cambiado. La viva está bien | `store/edges.tsx`, el `reduce` de `dead` |
| S4 | Los diagramas de corte recorren solo `fem.dead` para las cargas puntuales e intermedias: la viva no aparece (es el V7 de [`frame2d-v1.md`](./frame2d-v1.md)) | `store/graphs/global/shear/computeShear.ts` |
| S5 | **La «envolvente» no es una envolvente**: compara cada punto contra **un solo valor fijo** (`seismicRight.diagrams[0].data[0].value`, el primer punto de la primera barra), se queda con «el más lejano de cero» en vez de máximo y mínimo, y muta el átomo de corte cacheado | `store/graphs/envelope/shear.tsx` |
| S6 | El componente de la envolvente se importa y **nunca se dibuja**; el diagrama de momento existe solo para el caso sin sismo | `components/results/results.tsx` |
| S7 | Las pestañas están cruzadas: `seismicLeft` dice «Sismo a la derecha» | ídem |
| S8 | Nada de E.030: ni ZUCS/R, ni reparto en altura, ni derivas. El único ejemplo tiene `seismicForce: 0` en todos los nudos | `data/exampleReact2V2.ts` |
| S9 | Copia letra por letra de `frame2d` (`logic/frame2D.ts` casi idéntico, componentes byte-idénticos): el bug de duplicación del roadmap | [`refactor-roadmap.md`](./refactor-roadmap.md) |

## 2. Qué se agrega sobre `/frame2d`

Todo lo de `/frame2d` sigue valiendo y **se reusa, no se copia** (FEM calculado, diagramas N/V/M, deformada, narrativa, práctica, persistencia, Excel). Lo nuevo:

1. **Casos de carga**: CM y CV (cargas en barras y en nudos, por caso) y CS (las fuerzas sísmicas por nivel, calculadas o escritas).
2. **Diafragma rígido**: los nudos de un mismo nivel comparten el desplazamiento horizontal (E.030, 30.3). Es lo que hace que cada piso tenga **una** traslación.
3. **Rigidez lateral por condensación estática**: `K_L = K_aa − K_ab·K_bb⁻¹·K_ba`, con `a` = la traslación de cada nivel y `b` = el resto de los grados de libertad libres.
4. **Generador sísmico estático E.030**: de Z, U, S, R, T y los pesos por nivel salen V, αᵢ y Fᵢ, paso a paso.
5. **Combinaciones E.060, editables**, el sismo en los dos sentidos y **la envolvente** (máximo y mínimo) de N, V, M y de las reacciones.
6. **Desplazamientos inelásticos y derivas**: Δᵢ con 0.75R o 0.85R, y Δᵢ/hᵢ contra el límite.

## 3. La normativa (leída en los PDF oficiales el 2026-10-17)

| Norma | Fuente | Nota |
|---|---|---|
| **E.030 Diseño Sismorresistente, 2026** | [RM 183-2026-VIVIENDA](https://cdn.www.gob.pe/uploads/document/file/9902956/8081915-rm-183-2026-vivienda-modifica-norma-tecnica-e-030.pdf) (28-04-2026) y [su texto](https://cdn.www.gob.pe/uploads/document/file/9902957/8081915-nt-e-030-diseno-sismorresistente-2026.pdf) | El PDF tiene restricciones: `WebFetch` da 403 y la herramienta `Read` lo rechaza. Se baja con `curl` y un `User-Agent` de navegador y se lee con `pdftotext` o, para las fórmulas (vienen en una fuente de símbolos que no se extrae), con `pdftoppm` a PNG |
| **E.060 Concreto Armado, 2009** (DS 010-2009-VIVIENDA) | [copia en gob.pe](https://cdn.www.gob.pe/uploads/document/file/2686419/E.060%20Concreto%20Armado%20DS%20N%C2%B0%20010-2009.pdf), publicada por una municipalidad | **Sin verificar que siga sin modificaciones**: no se encontró ninguna, pero la búsqueda no fue concluyente. Por eso las combinaciones son editables |

### E.030 2026: lo que usa el módulo

| Art. | Qué dice | Cómo entra |
|---|---|---|
| 11, Tabla 1 | Z = 0.45 / 0.35 / 0.25 / 0.10 (zonas 4 a 1) | El alumno escribe Z. Se puede ofrecer la tabla como ayuda |
| 17, Tablas 4 y 5 | S, T_P y T_L por zona y suelo. **Cambió en 2026**: S₂ y S₃ son intervalos que se interpolan con Vs30 (sin Vs30: el mayor S, y T_P = 0.6, T_L = 2.0 para S₂; T_P = 0.9, T_L = 1.6 para S₃) | **Los escribe el alumno**: la clasificación del suelo está fuera del alcance |
| 18, Tabla 6 | C = 1 + 7.5·T/T_P si T < 0.2T_P; 2.5 hasta T_P; 2.5·T_P/T hasta T_L; 2.5·T_P·T_L/T² después. **El tramo 1 + 7.5·T/T_P es nuevo** | Se calcula, paso a paso |
| 18.3 y 34.1 | **Para el cortante del análisis estático, C = 2.5 en todo 0 ≤ T ≤ T_P**: el tramo nuevo no aplica al estático | El generador lo respeta y lo dice |
| 26 | R = R₀·Iₐ·Iₚ | El alumno escribe R₀, Iₐ, Iₚ (o R directo) |
| 31 | P = carga permanente + 50% de la viva (categorías A y B), 25% (C), 25% en azoteas | El alumno escribe Pᵢ por nivel; ver la sección 4 |
| 33.2 | El estático vale para estructuras regulares de hasta 30 m (o cualquiera en zona 1) | Se avisa si la altura pasa de 30 m |
| 34.1 | V = ZUCS/R · P | Se calcula |
| 34.2 | **C/R ≥ 0.11** | Se aplica al cortante de diseño |
| 35 | Fᵢ = αᵢ·V, αᵢ = Pᵢ·hᵢᵏ / Σ Pⱼ·hⱼᵏ; k = 1 si T ≤ 0.5 s, si no k = 0.75 + 0.5T ≤ 2 | Se calcula |
| 36.1 | T = h_n / C_T, con C_T = 35 (pórticos de concreto sin muros, pórticos de acero dúctiles), 45, 60 | Por defecto |
| 36.2 | T = 2π·√(Σ Pᵢdᵢ² / (g·Σ fᵢdᵢ)) | Se muestra como control, con la rigidez lateral (sección 4) |
| 50.1 / 50.2 | Desplazamientos laterales = los elásticos × **0.75R** (regular) o **0.85R** (irregular) | El alumno elige regular o irregular |
| **50.3** | **Para los desplazamientos no se aplica el mínimo de C/R** | El generador calcula **dos** cortantes cuando el mínimo manda: uno para diseño y otro para derivas. Es fácil de pasar por alto |
| 51, Tabla 14 | Δᵢ/hᵢ ≤ 0.007 concreto, 0.010 acero, 0.005 albañilería, 0.010 madera, 0.004 muros de ductilidad limitada | Por defecto 0.007, editable |

**Lo que la E.030 pide y un pórtico plano no puede representar**, que se dice en la página y no se modela:

- **28.1 y 33.3 (cambio de 2026, punto c de la RM)**: 100% del sismo en una dirección **más 30% en la perpendicular**, sumando valores absolutos. En un pórtico plano no hay dirección perpendicular.
- **37 y 45**: la excentricidad accidental (0.05 de la dimensión en planta) y su momento torsor. Es en planta, o sea 3D.
- **28.4 y 38**: el sismo vertical (2/3·ZUS del peso) en elementos verticales, de gran luz, pretensados y volados. Queda para la v2 como un caso de carga más (ver la sección 4).
- **44**: el cortante mínimo, que es del análisis dinámico.

**Una inconsistencia del texto oficial**, para no perder tiempo con ella: el Anexo I (pasos 13A y 13B) cita artículos que no corresponden. Dice «distribución en altura (artículo 38)», «momento torsor accidental (artículo 41)» y «fuerzas sísmicas verticales (artículo 42)», cuando son el 35, el 37 y el 38. El cuerpo de la norma es el que vale.

### E.060 2009: las combinaciones (9.2)

| Ec. | Combinación |
|---|---|
| 9-1 | U = 1.4 CM + 1.7 CV |
| 9-4 | U = 1.25 (CM + CV) ± CS |
| 9-5 | U = 0.9 CM ± CS |

Son **cinco** combinaciones con el ± expandido. 9.2.4: viento y sismo no se combinan simultáneamente (el viento no entra en la v1). CS entra con factor 1: las fuerzas de la E.030 ya están reducidas por R. **8.9, alternancia de la carga viva** (viva en tramos alternados o en dos tramos adyacentes): queda para la v2 (sección 4).

## 4. Alcance de la v1 (decidido por el usuario el 2026-10-17)

**Entran los tres niveles que se propusieron**:

- **A**: casos CM, CV y CS, combinaciones y envolvente.
- **B**: el generador sísmico estático E.030.
- **C**: el diafragma rígido, la rigidez lateral por condensación y las derivas.

**Las combinaciones vienen por defecto de la E.060 y son editables** (agregar, quitar y cambiar factores).

Decisiones de diseño tomadas para el plan; se pueden revisar si al construir aparece algo:

1. **El diafragma rígido es siempre parte del modelo sísmico** (E.030, 30.3), no una opción. Sin él un piso no tiene *una* traslación y la condensación y la deriva pierden sentido. Los niveles salen solos: nudos con la misma `z` y con el desplazamiento horizontal libre. **Consecuencia que hay que decir en la página**: con el diafragma, **la fuerza axial de las vigas del nivel no sale del análisis**. Sus extremos se mueven igual en x, así que la viga no se acorta, y el motor da N = 0 donde en realidad hay una fuerza que reparte el sismo. Es la limitación conocida del modelo de los libros.
2. **Pᵢ (el peso de cada nivel) lo escribe el alumno**: es el peso del edificio que le toca al pórtico, no el de sus cargas dibujadas, y calcularlo pide áreas tributarias que la app no tiene. Al lado se muestra la regla del artículo 31 como recordatorio.
3. **CS puede calcularse (E.030) o escribirse** (las Fᵢ que da el profesor). Las dos llegan al mismo caso.
4. **T**: por defecto h_n/C_T. Se puede escribir otro valor. El de Rayleigh (36.2) se calcula con la rigidez lateral y se **muestra** como control, sin entrar en el cálculo: usarlo arrastraría una iteración (T → C, k → Fᵢ → dᵢ → T).
5. **Superposición**: se resuelve **una vez por caso** (CM, CV, CS) y las combinaciones son combinaciones lineales de los resultados, porque `K` es la misma en todos. Es más barato que resolver cada combinación y además enseña algo: que el análisis es lineal. El sentido opuesto del sismo es el mismo caso con signo cambiado.
6. **La envolvente se arma sobre estaciones comunes**: el diagrama de una combinación es la combinación de los diagramas de los casos en los mismos x, más los puntos singulares de todos los casos. Se dibuja el máximo y el mínimo, no «el más lejano de cero».
7. **Ruta**: `/frame2d-seismic`, con su propia clave de persistencia (`eder-estructuras:frame2d-seismic`).

**Queda para la v2**: el sismo vertical (artículo 38) como un cuarto caso; la alternancia de la carga viva (E.060 8.9); el análisis modal espectral (artículos 39 a 42, el paso natural siguiente a la rigidez lateral); la separación entre edificios (artículo 52); y las tablas de Z, U, S y R₀ como selectores.

## 5. Lo que toca el motor

**El diafragma no se puede armar con lo que hay.** `System.buildDOFOrder` da un índice global distinto a cada grado de libertad de cada nudo. `dofNumbers` solo ordena: dos nudos no pueden compartir una fila. La forma limpia es que **varios nudos apunten al mismo índice global**: el ensamblaje (`k[map[i]][map[j]] +=`) queda igual y suma solo. Lo que sí cambia:

- `t` pasa a ser la cantidad de índices distintos, no `nudos × 3`.
- Las fuerzas aplicadas a un índice compartido se **suman** (hoy se asignan).
- **Validación**: un nudo con x restringida no puede estar en un diafragma. Los niveles se arman solo con nudos de x libre, así que eso no debería pasar, pero el motor lo rechaza igual.
- El **control de equilibrio** por nudo no cierra en x para los nudos del diafragma, porque falta la fuerza interna del diafragma. Se controla **por nivel** (la suma del nivel).
- `dofOrder`, las etiquetas de las matrices, el diagnóstico de mecanismo y el Excel tienen que nombrar el índice compartido («nivel 2, x»), no un nudo.

La condensación, el generador E.030, las combinaciones y las derivas son funciones puras nuevas, en `src/lib/engine/seismic/`, sin tocar `System`.

## 6. Plan

Un commit por paso, verificando cada uno con tests **y mirando la app**, como en los otros sistemas.

| Paso | Qué | Estado |
|---|---|---|
| 0 | Revisión del original, normativa en PDF oficiales, alcance y plan (este documento) | hecho |
| 1 | **Motor: diafragma rígido** en `System` (índices compartidos, fuerzas sumadas, validación, equilibrio por nivel). Tests: un pórtico de un vano con dos nudos acoplados tiene los dos con el mismo `u_x`, el resultado coincide con el de vigas de área muy grande, y los cuatro sistemas sin diafragma no cambian (los 518 tests) | **hecho** (ver abajo) |
| 2 | **Motor: `seismic/`**: `condense()` y la rigidez lateral; `e030.ts` (C(T) con la regla 18.3, k, αᵢ, V con C/R ≥ 0.11, el V para derivas sin el mínimo, T por C_T y por Rayleigh); `combinations.ts` (combinación lineal de resultados y envolvente sobre estaciones comunes); derivas. Tests contra valores conocidos: portal biempotrado con viga rígida, `K_L = 24EI/h³`; edificio de corte de 2 y 3 pisos; un ejemplo de la E.030 hecho a mano | **hecho** (ver abajo) |
| 3 | **`/frame2d` reutilizable**: hoy sus átomos son globales de módulo y leen su clave de `localStorage` al importarse. Hay que elegir entre una fábrica de stores con la clave como parámetro o un `Provider` de Jotai por página con la persistencia inyectada; se decide leyendo `state-pattern.md` y probando el más chico. `/frame2d` no cambia de comportamiento: sus tests siguen pasando sin tocarlos | **hecho** (ver abajo) |
| 4 | **Store sísmico**: el caso en cada carga (`LoadRow.loadCase`) y en las fuerzas de nudo, los niveles derivados, los parámetros E.030, las combinaciones editables, una solución por caso, las combinaciones, la envolvente y las derivas. Tests del store | **hecho** (ver abajo) |
| 5 | **Página y tablas**: parámetros E.030 con el cálculo paso a paso en KaTeX (C, k, V, αᵢ, Fᵢ, y los dos V si el mínimo manda), tabla de niveles (hᵢ, Pᵢ, Fᵢ), tabla de combinaciones y el caso en las tablas de cargas | **hecho** (ver abajo) |
| 6 | **Resultados**: el procedimiento por caso (reusa el panel de `/frame2d`), la condensación paso a paso (K_aa, K_ab, K_bb, K_L), el control δ de `K_L` contra δ del análisis completo, la tabla de derivas con Δᵢ/hᵢ contra el límite, y la envolvente de N/V/M y de las reacciones dibujada (máximo y mínimo) | **hecho** (ver abajo) |
| 7 | **Ejemplos y persistencia**: tres ejemplos con lecciones **medidas antes de escribirlas** (por ejemplo, un pórtico de 2 pisos y 1 vano, uno de 3 pisos y 2 vanos, y uno donde manda C/R ≥ 0.11) | **hecho** (ver abajo) |
| 8 | **Excel**, alcance tentativo, a confirmar al llegar: una hoja del sismo (V, αᵢ, Fᵢ como fórmulas vivas), una de la rigidez lateral (K_L con `MMULT`/`MINVERSE` desde K) y una de combinaciones (fuerzas de extremo por caso × factores) | pendiente |
| 9 | Mirar la app de punta a punta, `pnpm build` y el cierre | pendiente |

**Sin verificar todavía**: que la E.060 2009 no tenga modificaciones posteriores, y cuál de las dos formas del paso 3 es la más chica.

### Paso 1: el diafragma rígido en el motor (2026-10-17) — hecho

- **`System.addDiaphragm({ id, nodeIds, localDof })`**. En `buildDOFOrder`, el grado compartido entra una sola vez, con el **primer nudo del grupo en el orden de la tabla**, y los demás nudos repiten su índice en `byNode`. El ensamblaje no cambió ni una línea: cada barra suma en el índice de sus nudos. `K` tiene `dofIndex.size` filas (nudos × 3 − lo que se comparte). Las fuerzas de los nudos del grupo se **suman** en el índice compartido. `dofOrder` lista el índice una vez, con `diaphragmId`.
- Rechaza un diafragma de un solo nudo, con nudos repetidos o inexistentes, con un nudo restringido en ese grado, con un nudo que ya está en otro diafragma del mismo grado, y un id repetido.
- **Equilibrio**: un nudo del diafragma no cierra solo en x, porque le falta la fuerza que le hace el piso. `NodeEquilibrium.diaphragm` es esa fuerza, deducida como lo que le falta al nudo, y la comprobación real es **que sumen cero en el grupo** (`EquilibriumCheck.diaphragms`, que entra en `maxResidual`). Sin diafragmas, `diaphragms` es `[]` y los nudos no traen el campo: los otros cuatro sistemas no cambian.
- Tests (`frame2d/diaphragm.test.ts`, 9): los dos nudos del piso tienen el mismo `u_x` y `K` pasa de 12 a 11; coincide con una viga de área ×10⁶ sin diafragma; una fuerza en el piso da lo mismo aplicada en un nudo que repartida; la viga del diafragma da N = 0; el equilibrio cierra y las fuerzas del diafragma suman cero; los dos criterios de orden; las validaciones. **Los 518 tests anteriores pasan sin tocarlos.**
- **Lo que encontró**: la rigidez lateral del portal con viga rígida **no** da 24EI/h³ con las columnas reales, sino un 0,36 % menos. No es un error: la fórmula supone columnas que no se acortan, y estas se acortan. El test le da columnas axialmente rígidas y lo explica. Para la condensación del paso 2 importa: `K_L` incluye la deformación axial de las columnas, **más exacta que la fórmula del libro**, y hay que decirlo en la página para que el alumno no crea que la app se equivoca. Tampoco se puede usar una viga «infinitamente» rígida (I = 10⁶): las filas de las columnas quedan en el ruido y el motor lo lee como mecanismo.

### Paso 2: el motor sísmico (2026-10-17) — hecho

Cuatro módulos puros en `src/lib/engine/seismic/`, exportados desde `@/lib/engine`. Ninguno toca `System`.

- **`e030.ts`**: `amplificationFactor` (la Tabla N° 6 completa, con el renglón nuevo de 2026) y `staticAmplificationFactor` (la regla 18.3: C = 2.5 en todo 0 ≤ T ≤ T_P); `heightExponent` (k); `periodFromHeight` (h_n/C_T); `staticSeismicForces` (V con C/R ≥ 0.11, **y aparte el V para derivas sin el mínimo**, con αᵢ y Fᵢ de los dos); `rayleighPeriod` (36.2); `inelasticFactor` (0.75R / 0.85R). Cada función devuelve lo que hace falta para mostrar el paso, por ejemplo el renglón de la tabla que se usó o si el mínimo de C/R mandó.
- **`condensation.ts`**: `condense(K, keep)` devuelve K_aa, K_ab, K_ba, K_bb, K_bb⁻¹, la corrección y K_c, para mostrar la condensación entera. `lateralStiffness(assembly, diaphragmIds)` condensa `K_ff` dejando la traslación de cada diafragma, en el orden pedido.
- **`drift.ts`**: `storyDrifts` (Δᵢ = factor·(δᵢ − δᵢ₋₁), Δᵢ/hₑᵢ contra el límite) y `DRIFT_LIMITS` (la Tabla N° 14).
- **`combinations.ts`**: `E060_COMBINATIONS` (las cinco; CS positivo es el sismo hacia +x), `combineVectors`, `combineEndForces`, `scaleMemberLoad`, `combinedMemberDiagram` y `diagramEnvelope`. **El diagrama de una combinación no se interpola**: por linealidad, es `memberDiagram` con las fuerzas de extremo combinadas y las cargas escaladas, así que tiene sus propios máximos de M exactos. La envolvente toma como estaciones todas las de todas las combinaciones, y pone dos puntos donde alguna salta. Para eso `MemberDiagram.at(x, side)` aceptó el lado: el cursor de `/frame2d` sigue igual, porque el lado por defecto es la derecha.
- Tests (34, en 4 archivos):
  - E.030 a mano: tres pisos, V = 112.5, α = 0.2/0.4/0.4; el caso en que el mínimo de C/R manda y las derivas no lo usan; Rayleigh con un nivel = 2π√(m/k).
  - Condensación: **K_L⁻¹·F da exactamente los desplazamientos laterales del análisis completo** en un pórtico de dos pisos; K_L es simétrica y no depende de las cargas; con vigas rígidas y columnas axialmente rígidas tiende al edificio de corte k·[[2, −1], [−1, 1]].
  - Superposición: en las cinco combinaciones, **combinar los casos da lo mismo que resolver con las cargas combinadas** (reacciones, fuerzas de extremo y el diagrama de la viga en todo x, de los dos lados).
  - La envolvente es el máximo y el mínimo en cada estación y dice qué combinación los da.
  - 561 tests en total, `tsc` limpio.

### Paso 3: `/frame2d` reutilizable (2026-10-17) — hecho

**Ni fábrica ni copia: dos piezas que ya existían, una para cada mitad.**

- **El modelo (lo que se edita) se aísla con un `Provider` de Jotai.** Los átomos de Jotai son claves y los valores viven en el store, así que la página sísmica envuelve todo en su propio `Provider` y reusa **tal cual** los átomos de nudos, barras y cargas, sus acciones (agregar, borrar, editar) y las tablas. Un test fija que dos stores no se pisan. **Cuidado**: los valores iniciales de esos átomos salen de `storedModel` de `/frame2d`, que se lee al importar el módulo. La página sísmica tiene que **restaurar su propio modelo** (`atomRestoreModel`) en su store antes de dibujar, y guardar con su clave: `ModelPersistence` de `/frame2d` guarda con la de `/frame2d` y **no se puede montar** en la página sísmica.
- **Los resultados (lo que se muestra) pasan por un contexto: `frame2d-view.tsx`.** `Frame2DView` es el conjunto de átomos de lectura (nudos, barras, cargas, resultados, FEM, diagramas, deformada, clasificación). El valor por defecto son los átomos de `/frame2d`, así que `/frame2d` no monta ningún proveedor y no cambió. Los 10 componentes del lado de resultados lo leen con `useFrame2DView()`: clasificación, errores, tabla FEM, panel de resultados, esquema, deformada, fuerzas internas, rigideces locales, mecanismo y diagramas. Las tablas de entrada no, porque editan el modelo. La página sísmica va a envolver la vista de cada caso en un `Frame2DViewProvider` con los átomos de ese caso.
- **El cálculo salió de los átomos** (`store/results.ts`): `frame2DMemberLoads`, `solveFrame2D`, `frame2DMemberDiagrams` y `frame2DMemberShapes` son funciones puras. La clasificación es `frame2DClassification`. Los átomos de `/frame2d` son ahora una línea cada uno. **`solveFrame2D` recibe `diaphragms`**: un diafragma inválido es un error de nudo, como los demás.
- Tests: 4 nuevos (`frame2d-view.test.tsx`: stores aislados; el esquema sin proveedor y con uno que le cambia las barras; y el panel de errores mostrando el error del caso y no el del modelo). **Los 561 anteriores pasan sin tocarlos.** Se miró `/frame2d` con todas las secciones abiertas: las tres barras, 133 fórmulas sin `.katex-error`, el equilibrio cierra y la consola está limpia.
- **Para el paso 4**: con diafragmas, la clasificación `g = 3b + r − 3n` no cuenta lo que fija el diafragma (cada nudo extra del grupo es una ecuación de restricción). Hay que decidir si se ajusta la cuenta o si se dice en la página.

### Paso 4: el store sísmico (2026-10-17) — hecho

En `src/app/frame2d-seismic/store/`:

- **`model.ts`**: lo que `/frame2d` no tiene.
  - Las **cargas en nudos por caso** (`NodalLoadRow`). Las fuerzas y los desplazamientos de `NodeRow` no se usan en este módulo.
  - Los **parámetros E.030** (`SeismicParams`: Z, U, S, T_P, T_L, R₀, Iₐ, Iₚ, T por C_T o escrito, Fᵢ calculadas o escritas, regular o no, el límite de deriva y g).
  - Los **pesos y fuerzas por nivel**, de abajo hacia arriba.
  - Las **combinaciones editables**, que arrancan en las cinco de la E.060.
  - El ejemplo inicial: dos pisos (3.5 y 3 m) y un vano de 6 m, en t y m.
  - **Las cargas en barras son las de `/frame2d` con `LoadRow.loadCase`** («CM» | «CV», opcional, sin valor es muerta). `/frame2d` no lo mira; al agregar una fila se copia de la de arriba.
- **`seismic.ts`**:
  - `deriveLevels`: los niveles salen de las cotas, y son los nudos con la x libre por encima de la base (la cota más baja).
  - `atomDiaphragms`: un diafragma por nivel de dos o más nudos.
  - `seismicForces`: T, el C de la tabla y el del estático, V, Fᵢ y `driftScale` = V_derivas/V.
- **`cases.ts`**: **una `Frame2DView` por caso** (`caseViews.CM/CV/CS`), con los nudos cargados con lo de ese caso, las cargas en barras de ese caso, el FEM a mano apagado y los diafragmas. En CS, cada Fᵢ va al primer nudo de su nivel. Errores propios del caso: una carga en un nudo que no existe, o las fuerzas sísmicas inválidas (eso es error de CS solamente, y CM y CV siguen).
- **`analysis.ts`**:
  - `atomLateralAnalysis`: la condensación de `K_ff` del caso CS, el control `K_L⁻¹·F` contra el análisis completo, Rayleigh y las derivas con `driftScale`.
  - `atomCombinationResults`: desplazamientos, reacciones, fuerzas de extremo y diagramas por combinación, más la envolvente por barra y la de las reacciones por apoyo.
  - Las dos piden los tres casos resueltos.
- **`persistence.ts`**: la clave `eder-estructuras:frame2d-seismic`. La validación **reusa la de `/frame2d`** para el pórtico y agrega el caso de cada carga y lo propio del sismo. **`createSeismicStore()`** crea el store de Jotai de la página y le restaura lo guardado o el ejemplo, cosa obligatoria porque los átomos del pórtico traen el modelo de `/frame2d`.
- Tests (17, `store.test.ts`):
  - El aislamiento entre stores.
  - Los niveles.
  - El ejemplo hecho a mano: V = 0.45·2.5·1.1/8·50 = 7.734 t, F = 3.456 y 4.279 t.
  - El mínimo de C/R y las derivas.
  - Las Fᵢ a mano.
  - El error de CS que no tumba CM y CV.
  - Las reacciones verticales de cada caso igualan su carga.
  - En CS, el corte basal es −V y los nudos del piso se mueven juntos.
  - Cambiar el caso de una carga, y las cargas en nudos por caso.
  - `K_L⁻¹·F` contra el análisis completo.
  - Las derivas con 0.75R.
  - Las combinaciones como suma de los casos.
  - La envolvente.
  - La persistencia.
- **Lo que dice el ejemplo** (medido, para usarlo en la página y en el paso 7):
  - **El primer entrepiso no pasa la deriva**: Δ/h = 0.0073 > 0.007. El segundo da 0.0053.
  - **Rayleigh da T = 0.369 s, el doble que h_n/C_T = 0.186 s** (el pórtico desnudo es más flexible que el edificio que supone la fórmula empírica). Con T_P = 0.6, C queda en 2.5 igual.
  - La envolvente de M en las columnas es antisimétrica entre e1 y e2, como corresponde a un pórtico simétrico con sismo en los dos sentidos.
  - K_L = [[5626, −2969], [−2969, 2451]] t/m.
- **Pendiente para el paso 6**: la clasificación por caso usa `3b + r − 3n` sin contar el diafragma. Se dice en la página.

### Paso 5: la página y las tablas (2026-10-17) — hecho

- **`/frame2d-seismic`** (`page.tsx`): monta el `Provider` de Jotai con `createSeismicStore()` (en un `useState`, así que en el cliente arranca con lo guardado). Las tablas se reservan hasta hidratar, como en `/frame2d`. Ya está en la barra de navegación («Pórticos con sismo», `lib/site-config.ts`).
- **Se reusan tal cual** las tablas de nudos, barras y cargas de `/frame2d`, con dos props nuevas y opcionales, así que `/frame2d` no cambia:
  - `NodeTable withLoads={false}`: solo geometría y apoyos.
  - `LoadTable cases`: agrega la columna «Caso» y cambia una frase de la introducción.
- **Componentes propios** (`components/`):
  - `NodalLoadTable`: las cargas en nudos por caso.
  - `SeismicParamsForm`: los datos de la E.030. En modo «escritas por nivel» quedan solo R₀, Iₐ, Iₚ, que hacen falta para las derivas.
  - `LevelsTable`: niveles, nudos, hᵢ, Pᵢ, Pᵢhᵢᵏ, αᵢ, Fᵢ y las sumas.
  - `SeismicSteps`: el cortante paso a paso, con los artículos y los números del modelo. Dice cuándo la Tabla N° 6 daría el tramo nuevo y no se usa, y cuándo manda el mínimo de C/R junto con el V para derivas.
  - `CombinationsTable`: editable, con «Volver a las de la E.060».
  - `ModelPersistence`/`ResetModelButton` con la clave sísmica.
  - `CaseSelector`: botones con `aria-pressed`. No usa `ui/tabs`, que nadie estrenó.
  - `CaseSchema`.
- **Lo que encontró mirar la app:**
  - **El esquema con todas las cargas dibujaba la muerta y la viva de una viga una encima de la otra**: de la viga e5 se leía −1.2 (CV) y no −3 (CM). Ahora **el esquema es de un caso** (`CaseSchema`, con la `Frame2DView` de ese caso). En CS se ven las Fᵢ de cada nivel aplicadas en el primer nudo.
  - Los selectores cortaban el texto («análisis es…») y uno mostraba «C_T» con el guion bajo literal: textos más cortos y más anchos.
  - El casillero de «regular» estaba mezclado con los campos.
- **Verificado en el navegador:**
  - Las Fᵢ (3.4558 y 4.2786) y V = 7.7344 coinciden con los tests.
  - Cambiar Z a 0.35 da V = 6.0156 (= 0.35·2.5·1.1/8·50) y se guarda.
  - El modo a mano pone campos para Fᵢ.
  - Agregar una carga en nudo la guarda.
  - **`/frame2d` sigue con sus 4 nudos, con «Fuerza» y sin «Caso»**, y cada página guarda con su clave.
  - Cero `.katex-error` y la consola limpia.
- **Receta para la próxima**: `fill` del MCP **no** sirve con `FormulaInput`, porque el borrador vive en el estado del componente y el valor vuelve. Hay que hacer click, `Control+A`, `type_text` con `submitKey: "Enter"`.
- Tests (3, `components/page-pieces.test.tsx`): el esquema por caso con sus números; las tablas sin fuerzas y con la columna del caso; los niveles y el cortante sin `.katex-error`. 585 en total.
- **Detalles abiertos:**
  - Los campos de la E.030 no tienen nombre accesible: el `Label` lleva KaTeX y `FormulaInput` no acepta `aria-label`.
  - La fila de un nivel enciende solo su primer nudo: `useHighlightRows` con `kind: "node"` no recibe varios.
  - La tabla de cargas con la columna «Caso» pide scroll horizontal a 1080 px.

### Paso 6: los resultados (2026-10-17) — hecho

Cuatro secciones en la página, en el orden del curso:

1. **Cada caso, por el método matricial** (`CaseProcedure`): `CaseSelector` y el `ErrorsPanel` y el `ResultsPanel` de `/frame2d` dentro de un `Frame2DViewProvider` con la vista del caso. Es el procedimiento entero, sin copiar nada. `ResultsPanel` aceptó un `title` opcional.
2. **Rigidez lateral** (`LateralStiffness`): la deducción en TeX, K_aa, K_ab, K_bb, la corrección y K_L como matrices rotuladas (los grados de un piso, «N1 x»), y el control `K_L⁻¹·F` contra el análisis completo de CS. Explica por qué no da 12EI/h³ por columna.
3. **Derivas** (`Drifts`): la tabla de la E.030 (hₑᵢ, δ elástico, × 0.75R, Δ, Δ/h, si cumple), qué entrepiso falla y qué pide la norma, y el período de Rayleigh contra h_n/C_T con lo que eso significa para C.
4. **Envolvente** (`Envelope`): el dibujo de la envolvente (o de una combinación sola) en N, V o M sobre el pórtico, con `InternalForceDiagram` y **dos curvas por barra** (máximo y mínimo; donde tienen el mismo signo se ve la banda); la tabla del máximo y el mínimo de cada barra, con dónde y con qué combinación; y la envolvente de las reacciones, con la combinación de cada valor. `curveOf` y `QUANTITY` de `/frame2d` se exportaron para dibujar una combinación sola.

Para que el procedimiento de `/frame2d` diga la verdad con el diafragma:

- **Los ids de los diafragmas son el nombre del nivel** («Nivel 1»). La tabla de grados de libertad (genérica) agrega «— todo el nivel 1» al grado compartido.
- **Una fuerza horizontal en un nudo del piso se escribe en el primero** (`caseNodes`): el motor las suma en el índice compartido, y la ecuación global rotulaba con el dueño una fuerza que no era solo suya.
- **La sección de equilibrio genérica suma la columna «Diafragma»** cuando la hay, y un párrafo con el control de cada piso (Nivel 1 ≈ 0, Nivel 2 ≈ 0). Sin ella, la fila de un nudo del piso no se podía rehacer con los números de la pantalla. Los otros sistemas no la ven.

**Lo que encontró mirar la app:**

- Las matrices de 2×2 se estiraban a todo el ancho: ahora llevan `w-fit`.
- «N1 x» se partía en dos renglones: ahora va con espacio duro.
- **En la envolvente, los números se pisaban en todas las esquinas** (dos curvas por barra son el doble de números). Ahora cada curva rotula solo los puntos que llegan a la mitad de su máximo y del lado que le corresponde, M escribe una vez el valor repetido en un nudo, y un esfuerzo constante (N de una columna) va una vez a mitad de la barra: el −32.28 de una columna caía sobre el −13.56 de la de arriba. **Medido**: 0 superposiciones de texto en N, V, M de la envolvente y en M de una combinación.

**Verificado a mano con los números de la pantalla:**

- Equilibrio del caso CS: en v3, −1.7279 (columnas) + 3.4558 (carga) − 1.7279 (diafragma) = 0. Cada columna toma la mitad del corte: 3.8672 = 7.7344/2.
- K_L₁₁ = K_aa₁₁ − corrección = 6.7178 − 1.0916 = 5.6262.
- Reacciones: Rz máx = 1.4·16.5 + 1.7·5.4 = 32.28; Rz mín = 0.9·16.5 − 4.0727 = 10.7773 (con la reacción de CS).
- Las derivas y Rayleigh, los del paso 4.
- Cero `.katex-error` y la consola limpia.

Tests: 2 más en `page-pieces.test.tsx` (el procedimiento con la vista del caso y los grados del piso rotulados; los números de la rigidez lateral, las derivas y la envolvente). 587 en total.

**Sin hacer y anotado**:

- La clasificación `3b + r − 3n` no se muestra en este módulo: con el diafragma la cuenta tendría que sumar las restricciones del piso, y la de `/frame2d` diría otra cosa.
- El esquema del procedimiento de cada caso no dibuja el diafragma.
- (La deformada de CS **sí** se miró: el pórtico se desplaza a la derecha, cada piso en bloque por el diafragma, y las reacciones dibujadas son las de la tabla de equilibrio.)

### Paso 7: los ejemplos (2026-10-17) — hecho

Tres ejemplos en el menú (`store/examples.ts`), cada uno para algo que los otros no muestran, **con la lección medida antes de escribirla** y afirmada en `store/examples.test.ts`:

| Ejemplo | Lo que muestra (medido) |
|---|---|
| **Tres pisos y dos vanos** (vanos de 6 m, pisos de 3.5 m, P = 45/45/30 t) | Diafragmas de tres nudos. **La columna del medio, frenada por dos vigas, toma 7.28 t de corte contra 5.64 de las de borde** (un 29% más). **El entrepiso que más deriva es el segundo** (0.0130), no el primero (0.0119); ninguno pasa el 0.007, el de arriba por poco (0.00715) |
| **Mandó el mínimo de C/R** (columnas de 25×25, P = 60/40 t, suelo S₁) | **T = 1.24 s escrito, que es el de Rayleigh del propio pórtico (la página da 1.242)**: un dato coherente, no inventado. C = 0.806, C/R = 0.1008 < 0.11: V = 4.95 t para diseño y 4.54 t para derivas (× 0.916). Aun así no pasa ninguna deriva: un pórtico así de flexible no sirve |
| **Fuerzas dadas y bases articuladas** (Fᵢ = 3.5 y 4.3 t escritas, una carga en nudo de CV) | Sin momento en la base, **el primer piso deriva 0.0286: unas cuatro veces lo del mismo pórtico empotrado** (0.0073, el ejemplo inicial, con fuerzas casi iguales) |

**Una lección supuesta resultó falsa, otra vez**: la primera versión del ejemplo del mínimo de C/R escribía T = 1.5 s para el mismo pórtico del ejemplo inicial, cuyo Rayleigh es 0.37 s. La página lo habría mostrado, contradiciéndose. Se rehízo con un pórtico de verdad flexible y su propio período.

**Lo que encontró mirar la app** (los cuatro modelos, el esquema en los tres casos y la envolvente en N, V, M, **midiendo las cajas de texto**):

- **La página entera tenía scroll horizontal**: K_bb del ejemplo de tres pisos es de 18×18 y no tenía contenedor con scroll. Ahora cada matriz de la condensación tiene el suyo (`Matrix` en `lateral-stiffness.tsx`), con mapa de calor pasados 19 grados (D13).
- **En la envolvente de un pórtico de dos vanos los números se pisaban en los nudos interiores** (7 pares): cuatro barras con dos curvas cada una. Ahora **en cada extremo de barra se rotula solo el valor que manda** (el de mayor módulo entre máximo y mínimo), más el máximo interior de cada curva. `InternalForceDiagram` aceptó `skipCrowdedLabels`, que la envolvente usa: un número que después de alejarse sigue chocando no se escribe, porque está en la tabla. `/frame2d` no lo usa.
- **En el esquema, los nombres de las columnas interiores caían sobre los de sus nudos**, y el de una viga sobre el número de una fuerza (D17). Ahora el esquema genérico pone el nombre de una barra al 25% salvo que ahí choque con el nombre de un nudo o con el número de una fuerza, y entonces lo prueba al 50% y al 75% (`axialLabelPoint` aceptó `at`). **Donde no había choque no cambia nada**: se midió en `/frame2d` (el inicial y sus tres ejemplos) y en `/armaduras-2d` (el inicial y sus tres). El único choque que queda en `/frame2d` es el de antes: el nudo «c» del pórtico a dos aguas con el rótulo de su carga.
- **Dos textos decían algo falso con el período escrito**. Cuando manda el mínimo, V ponía 0.88 en el lugar de C (es 0.11·R): ahora es `V = Z·U·S·(C/R)ₘᵢₙ·P`. Y Rayleigh comparaba contra «T = h_n/C_T» cuando el T era escrito: ahora dice `T_escrito` y si coincide con el de Rayleigh (2%).
- **Medido al final**: 0 superposiciones en el esquema (CM, CV, CS) y en la envolvente (N, V, M) de los cuatro modelos, 0 `.katex-error`, sin scroll horizontal y la consola limpia.

**Receta para la próxima**: el menú «Ejemplos» (Base UI) no se abre con `.click()` desde un script; sí despachando `pointerdown`, `mousedown`, `pointerup`, `mouseup` y `click` sobre el botón y después sobre el `[role="menuitem"]`.

Tests: 5 en `store/examples.test.ts`. 592 en total.

