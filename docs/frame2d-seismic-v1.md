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
| 3 | **`/frame2d` reutilizable**: hoy sus átomos son globales de módulo y leen su clave de `localStorage` al importarse. Hay que elegir entre una fábrica de stores con la clave como parámetro o un `Provider` de Jotai por página con la persistencia inyectada; se decide leyendo `state-pattern.md` y probando el más chico. `/frame2d` no cambia de comportamiento: sus tests siguen pasando sin tocarlos | pendiente |
| 4 | **Store sísmico**: el caso en cada carga (`LoadRow.loadCase`) y en las fuerzas de nudo, los niveles derivados, los parámetros E.030, las combinaciones editables, una solución por caso, las combinaciones, la envolvente y las derivas. Tests del store | pendiente |
| 5 | **Página y tablas**: parámetros E.030 con el cálculo paso a paso en KaTeX (C, k, V, αᵢ, Fᵢ, y los dos V si el mínimo manda), tabla de niveles (hᵢ, Pᵢ, Fᵢ), tabla de combinaciones y el caso en las tablas de cargas | pendiente |
| 6 | **Resultados**: el procedimiento por caso (reusa el panel de `/frame2d`), la condensación paso a paso (K_aa, K_ab, K_bb, K_L), el control δ de `K_L` contra δ del análisis completo, la tabla de derivas con Δᵢ/hᵢ contra el límite, y la envolvente de N/V/M y de las reacciones dibujada (máximo y mínimo) | pendiente |
| 7 | **Ejemplos y persistencia**: tres ejemplos con lecciones **medidas antes de escribirlas** (por ejemplo, un pórtico de 2 pisos y 1 vano, uno de 3 pisos y 2 vanos, y uno donde manda C/R ≥ 0.11) | pendiente |
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
