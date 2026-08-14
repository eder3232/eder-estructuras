# Patrón de estado y resultados (Tren A)

Este documento describe el patrón que estrenaron `/springs` y `/armaduras-2d` (Tren A) y que después replicaron `/frame2d` (Tren C) y `/armaduras-3d` (Tren D) sin necesidad de modificarlo. **Leelo antes de armar la página de un sistema nuevo** — el único que queda es `frame2d-seismic`.

Si estás retomando el trabajo después de un `/clear`, el punto de partida no es este archivo sino la sección ["Si estás retomando después de un `/clear`"](./refactor-roadmap.md#si-estás-retomando-después-de-un-clear) de [`docs/refactor-roadmap.md`](./refactor-roadmap.md), que dice qué está hecho y qué falta. Después volvé acá. La convención de carpetas de componentes está en [`docs/components.md`](./components.md).

**Implementación de referencia real**: todo lo que describe este documento ya existe y funciona en `src/app/springs/`, `src/app/armaduras-2d/`, `src/app/frame2d/` y `src/app/armaduras-3d/` — cuatro implementaciones del mismo patrón con 1, 2, 3 y 3 DOF por nudo (los dos últimos con la misma cantidad pero distinta naturaleza: rotación vs. tres traslaciones), útiles para comparar qué es genérico (ya extraído a `src/components/custom/`) y qué cambia por sistema. Ante la duda, leé el código ahí en vez de confiar solo en este resumen — este documento puede quedar desactualizado, el código no.

## Por qué existe este patrón

El proyecto anterior (`thesis-structures`) mezclaba las clases de dominio (`Spring`, `Armor2D`, etc.) directamente dentro de los átomos de Jotai, en `store/`. Acá el motor de cálculo (`src/lib/engine/`) es puro TypeScript sin ninguna dependencia de React — los átomos de Jotai solo guardan **datos planos** (arrays de objetos serializables) y un átomo derivado construye un `System` nuevo, agrega nodos/elementos, y llama `.solve()` cada vez que cambian los datos. Nunca se guarda una instancia de `System`/`Element` en un átomo.

## Estructura de carpetas por sistema

```
src/app/<sistema>/
  page.tsx                          # ruta, 'use client', compone todo lo demás
  store/
    nodes.ts                        # atom de datos planos + atoms de escritura (add/remove/update)
    elements.ts                     # idem para elementos/barras
    decimals.ts                     # atomDecimals — precisión global de resultados
    results.ts                      # atom derivado: construye System, captura errores, llama solve()
  components/
    node-table.tsx                  # tabla de entrada de nodos
    element-table.tsx               # tabla de entrada de elementos
    errors-panel.tsx                # muestra los errores que tira System, sin reimplementar códigos de error
    decimals-control.tsx            # selector de decimales (0-8)
    matrix-table.tsx                # tabla genérica para number[][], con soporte de labels y resaltado
    results-panel.tsx               # Accordion que orquesta las 5 secciones de abajo
    results/
      dof-order-table.tsx           # posición ↔ nudo ↔ incógnita a resolver
      local-stiffness-list.tsx      # rigidez local por elemento (fórmula general + valores)
      assembly-steps.tsx            # ensamblaje paso a paso con leyenda física + celdas resaltadas
      partition-and-solution.tsx    # Kff/Kfr/Krf/Krr + ecuación resuelta con sustitución numérica
      internal-forces-table.tsx     # fuerza interna por elemento con sustitución numérica
```

## El patrón de átomos (`store/nodes.ts`, `store/elements.ts`)

Cada colección tiene: un átomo base (`atomNodesBase`), un átomo de lectura (`atomNodes`), y átomos de escritura con `produce` de Immer (`atomAddNode`, `atomRemoveNode`, `atomUpdateNodeField`, `atomToggleNodeRestrained`). Los IDs son estables (`crypto.randomUUID()` — no se agregó la dependencia `uuid` que usaba el original, el runtime ya lo provee) y **nunca editables**; el campo `name` es la etiqueta editable que se muestra. Los elementos referencian nodos por `id`, nunca por `name` — evita que renombrar un nudo rompa una barra que lo referencia (un bug real posible en el patrón original).

`atomToggleNodeRestrained` resetea `force`/`displacement` a 0 al togglear, porque `System.addNode` (`src/lib/engine/system.ts`) rechaza fuerza aplicada en un DOF restringido y desplazamiento prescrito en uno libre.

## El átomo derivado de resultados (`store/results.ts`)

```ts
export const atomResults = atom<SpringsResults>((get) => {
  const system = new System(dofPerNode);
  const errors: DomainError[] = [];

  for (const node of nodes) {
    try { system.addNode({ id: node.id, restrained: [...], force: [...], displacement: [...] }); }
    catch (e) { errors.push({ source: "node", refId: node.id, message: e.message }); }
  }
  for (const element of elements) {
    try { system.addElement(new XxxElement(element.id, [...], ...)); }
    catch (e) { errors.push({ source: "element", refId: element.id, message: e.message }); }
  }

  if (errors.length > 0) return { status: "error", errors, nodesById };
  return { status: "ok", solved: system.solve(), nodesById };
});
```

Si hay errores de validación (capturados por fila, sin romper la página) no se llama `.solve()`. Si no hay errores, `solved` trae `displacements`, `reactions`, `internalForces` y — clave para la sección de resultados — `assembly` (`dofOrder`, `globalStiffness`, `steps`, `partition`), que `System.solve()` expone justamente para esto.

## El diseño pedagógico de resultados (las 6 secciones del acordeón)

Esto es una **mejora deliberada sobre el original**, no una réplica — ver la discusión completa en el historial de commits (`960a38e`, `932f9e2`) si hace falta el porqué completo. El estándar a mantener en todos los sistemas:

1. **DOF y matrices locales**: tabla explícita "posición ↔ nudo ↔ qué incógnita se resuelve ahí" **antes** de mostrar cualquier matriz — la posición numérica tiene que tener significado desde el principio. Después, la rigidez local de cada elemento: la fórmula general una sola vez arriba (es la misma para todos), y por elemento la **cadena completa** con sus operandos, no solo el resultado.
2. **Ensamblaje de la matriz global**: un paso por elemento, cada uno con una leyenda física ("Barra e1 (k=10) conecta v4↔v2 → aporta en las posiciones de v4 y v2") y las celdas que cambiaron resaltadas (diff entre el paso anterior y el actual — sin lógica de interacción, eso es Tren B). Cierra con la ecuación global `F = K·U`, **con las incógnitas resaltadas**: eso es lo que motiva la partición del paso siguiente.
3. **Partición y solución**: la matriz global **reordenada** (libres primero) con las cuatro zonas coloreadas y el corte dibujado —la partición se entiende viendo el corte, no cuatro tablas sueltas—, después cada bloque por separado, y las ecuaciones `Uf = Kff⁻¹·(Ff − Kfr·Ur)` y `Rr = Krf·Uf + Krr·Ur` con **todos los operandos a la vista** antes del resultado.
4. **Fuerzas internas**: sustitución numérica por elemento.
5. **Forma deformada**: el diagrama del Tren B (no aplica a `springs`, que no tiene geometría).
6. **Verificación de equilibrio** (N5, 2026-08-13): ΣF = 0 nudo por nudo y en toda la estructura. Cierra el recorrido: las cinco secciones anteriores muestran cómo se llega al resultado y ninguna muestra que el resultado **esté bien**. El cálculo es genérico (`engine/equilibrium.ts`, sale en `SolveResult.equilibrium` para los cuatro sistemas) y **el veredicto va en el título de la sección**, no adentro: la pregunta «¿puedo confiar en esto?» se tiene que poder contestar sin desplegar nada, y la cuenta —que es lo que enseña— queda adentro.

Acordeón `type="multiple"`, primera sección abierta por defecto. La precisión ya no es un único número global: es una cascada página → bloque → tabla, descrita más abajo en "La cascada de decimales".

> **Ojo: este estándar solo está cumplido en `/armaduras-2d`.** Los puntos 1, 2 y 3 se completaron ahí el 2026-08-12; `/springs`, `/frame2d` y `/armaduras-3d` siguen mostrando el álgebra en texto plano y sin esos pasos. Es la deuda **D11** del roadmap. El porqué de cada decisión está en [`docs/armaduras-2d-plan.md`](./armaduras-2d-plan.md) — leerlo antes de replicar.

### Las piezas para escribir álgebra

Tres componentes compartidos, todos usables por cualquier sistema:

- **`custom/math.tsx`** — `<Math>` (en línea) y `<MathBlock>` (en bloque), sobre KaTeX. `texText()` escapa un nombre editable por el usuario antes de interpolarlo en una fórmula. **No escribir símbolos en ASCII**: `Kff⁻¹` y `Tᵀ` a mano se ven peor que en el proyecto original, que sí usaba KaTeX.
- **`custom/matrix-equation.tsx`** — `<MatrixEquation>` con `<EquationTerm>` y `<MathOp>` adentro: operandos en fila con operadores en el medio. Nunca envuelve; si no entra, scrollea.
- **`cellClass` de `MatrixTable`** — clase por celda, para cuando el resaltado no es binario (las cuatro zonas de la partición). `highlight` sigue existiendo para el caso binario del ensamblaje.

## Persistencia del modelo (N1, 2026-08-13)

Hoy solo la tiene `/armaduras-2d`. Lo genérico está en `src/lib/persistence.ts` (el sobre: versión adentro del payload, descarte de lo que no se entiende, y nunca romper) y en `src/hooks/use-hydrated.ts`; lo de cada sistema son tres archivos chicos, que es lo que hay que replicar al propagar:

1. **`store/persisted-model.ts`** — la clave, la versión, la guarda de forma escrita a mano, y la lectura. **Se lee al evaluarse el módulo**, y de ahí salen los valores iniciales de los átomos: leerlo en un efecto obligaría a *setear* estado después del primer render, que es la regla `react-hooks/set-state-in-effect`.
2. **`store/persistence.ts`** — un átomo derivado con el modelo entero (lo que se guarda), más `atomResetModel` —que **devuelve lo que había**, y eso es lo que hace posible el "deshacer"— y `atomRestoreModel`. Se observa el derivado en vez de agregarle un `saveModel()` a cada acción del store: esa es una lista que alguien olvida de actualizar.
3. **`components/model-persistence.tsx`** — el efecto que escribe (escribir sí es sincronizar con un sistema externo, que es para lo que existen los efectos) y el botón de reset con su toast.

Y en la página, **el contenido que depende del modelo no se dibuja hasta hidratar**: `localStorage` no existe en el servidor, así que el HTML prerrenderizado solo podría traer el ejemplo inicial, y verlo aparecer y cambiar se lee como *se perdió mi trabajo*. Se reserva el espacio con alturas medidas.

**Qué entra y qué no**: el modelo y los flags de orden de grados de libertad (son del ejercicio, los puso el profesor). **No** los decimales, la notación compacta ni el modo práctica: son preferencias, valen para los cuatro sistemas a la vez y por lo tanto van en otra clave con su propio versionado.

**Los ejemplos precargados (N2) entran por el mismo camino**: `store/examples.ts` con modelos de la forma que se persiste, y `atomReplaceModel` —que devuelve lo anterior— más un aviso con «Deshacer» adentro. Reemplazar todo el modelo es una sola operación, escrita una vez, con dos disparadores: el reset y los ejemplos.

## Piezas genéricas vs. específicas de cada sistema

**Genéricas — ya extraídas a `src/components/custom/`, no duplicar por sistema:**
- `matrix-table.tsx` (ojo: soporta `labels` para matrices cuadradas simétricas, y `rowLabels`/`colLabels` por separado para bloques no cuadrados como `Kfr`/`Krf` — no colapsar ambos en una sola prop, ese fue un bug real que se corrigió antes de commitear).
- `decimals.ts` (el átomo) y `decimals-control.tsx`.
- `errors-panel.tsx` — el tipo `DomainError` y el render del panel. **El contrato completo de errores está en [`docs/errores.md`](./errores.md)**: qué se dice arriba (los datos mal cargados, que se atribuyen a una fila) y qué se dice adentro del panel de resultados (el diagnóstico de mecanismo, que es una salida del motor y no un dato mal cargado). Era byte-idéntico entre springs y armaduras 2D, y frame2d hubiera sido la tercera copia; se extrajo al llegar ese tercer caso. Lo que queda por sistema es un adaptador de ~8 líneas (`src/app/<sistema>/components/errors-panel.tsx`) que lee su propio `atomResults` y delega, porque el átomo sí es de cada sistema.
- `math.tsx` y `matrix-equation.tsx` — ver "Las piezas para escribir álgebra", más arriba.
- `dof-order-table.tsx` — solo necesita `AssemblyResult["dofOrder"]` y un mapa `id → { name }`; acepta un prop opcional `dofLabels?: string[]` (ej. `["x", "z"]`) para mostrar a qué eje corresponde cada DOF local en sistemas con más de 1 DOF/nudo. Springs no lo pasa, así que esa columna no aparece ahí — armaduras 2D sí.

**Específicas de cada sistema** — viven en `src/app/<sistema>/`, hay que adaptarlas (no solo copiarlas) para cada sistema nuevo:
- `node-table.tsx`/`element-table.tsx` — cambian los campos (springs: `k`; armaduras 2D: coordenadas `x`/`z`, `area`, `elasticity`, campos por eje como `forceX`/`forceZ`). Lo que **no** cambia es la forma de la tabla: dos columnas de acción al principio, `+` (insertar debajo de esta fila) y `−` (borrar esta fila), más un `+` en el encabezado que agrega al final. Viene del proyecto original y hay que portarlo — el orden de las filas es el orden de los DOF, así que meter un nudo intermedio sin rehacer la tabla es una operación real, no un lujo. Los átomos `atomAdd*` toman un `afterId` opcional y se apoyan en `insertIndex`/`nextRowName` de [`src/lib/row-names.ts`](../src/lib/row-names.ts); el nombre nuevo **no** se saca de `filas.length + 1`, que repite nombres apenas se borra una fila del medio.
- `local-stiffness-list.tsx` — la rigidez local de un resorte es literalmente `[[k,-k],[-k,k]]`, sin transformación geométrica; la de una barra de armadura sí la tiene.

  > **Esta regla cambió el 2026-08-12.** Antes decía que estaba bien duplicar las fórmulas escalares simples (`cos`, `sin`, `EA/L`) en la UI para la narrativa, y reusar del motor solo el álgebra lineal. **No funcionó**: terminaron existiendo tres copias de la misma fórmula —la del motor y una en cada uno de `local-stiffness-list.tsx` e `internal-forces-table.tsx`—, y nada garantizaba que la matriz dibujada fuera la aplicada.
  >
  > La regla nueva es más simple: **si la UI necesita un intermedio del cálculo, el elemento lo expone**. `TrussElement2D.breakdown()` devuelve geometría y matrices, y `stiffness()` lee de ahí. Al portar esto a otro sistema, agregarle al `Element` concreto el `breakdown()` que su narrativa necesite en vez de recalcular en la página.
- `internal-forces-table.tsx` — la sustitución numérica depende de qué es la "fuerza interna" de cada `Element` concreto.
- `assembly-steps.tsx`/`partition-and-solution.tsx` — con más de 1 DOF/nudo las etiquetas necesitan el eje además del nombre del nudo (`v1x`/`v1z`, no solo `v1`), y la fuerza/desplazamiento/reacción de cada entrada del DOF order hay que indexarla por `entry.localDof`, no asumir un único valor por nudo (ver cómo lo hace armaduras 2D).
- `store/*.ts` — los campos y el `Element` concreto que se instancia cambian.

## Decisiones técnicas a mantener

- IDs estables vía `crypto.randomUUID()`, no el paquete `uuid`.
- Referencias entre nodos y elementos por `id`, nunca por `name`.
- Selector de nudo (combobox "desde"/"hacia") → usar `ui/select.tsx` (Radix, API simple y ya conocida), **no** `ui/combobox.tsx` (primitiva de Base UI, más compleja de lo que este caso necesita).
- Alert de errores → `ui-custom/alert.tsx` (tiene la variante `destructive` igual que el original, más `warning`/`info` si hacen falta), según la convención de `docs/components.md`.
- Sin KaTeX/LaTeX — las fórmulas se muestran como texto plano formateado (`tabular-nums`), no se agregó esa dependencia. Si en algún momento se decide agregarla, es una decisión aparte a discutir, no algo a colar de paso.

## La cascada de decimales (página → bloque → tabla)

Los resultados no se leen todos con la misma precisión: en "Partición y solución" conviven `Kff` (~10⁶) y `Uf` (~10⁻³), y un único número de decimales deja a una ilegible por ruido o a la otra en puros ceros. Por eso la precisión es una **cascada de tres niveles**, en `src/components/custom/decimals-scope.tsx`:

```
página          atomDecimals                      ← <DecimalsControl />, arriba de "Resultados"
  └ bloque        <DecimalsScope id="partition">  ← una por AccordionItem
      └ tabla       <DecimalsScope id="kff">      ← override puntual
```

Cómo trabajarla:

- **`useDecimals()`** devuelve el valor del ámbito más cercano. Un componente que no esté dentro de ningún `DecimalsScope` cae en el valor de la página, así que **los sistemas todavía no migrados siguen funcionando sin tocarlos**.
- **`<ScopeDecimalsControl />` se monta *dentro* del scope que controla** — de ahí saca la ruta y el valor vigente. Fuera de un scope no renderiza nada.
- No hay lógica de resolución escrita: anidar providers *es* la resolución. Un nivel sin override no guarda el valor heredado, lo hereda de verdad — si después cambia el bloque, la tabla lo sigue.
- **Los overrides viven en `atomDecimalsByScope`, no en `useState`.** El acordeón es Radix sin `forceMount`: cerrar una sección desmonta sus tablas, y con estado local se perdería lo configurado.
- La clave del override es la **ruta completa** (`armaduras-2d/partition/kff`), que `DecimalsScope` arma sola concatenando los ids de los ancestros. Por eso la raíz lleva el nombre del sistema: sin eso, dos sistemas con los mismos ids de bloque —o dos barras con el mismo id semilla— se pisarían la configuración.

El punto de enganche es `matrix-table.tsx`: es el renderer compartido de casi todas las tablas, así que entra a la cascada con una sola línea. Lo que hay que tocar aparte es lo que formatea números por su cuenta (`internal-forces-table.tsx` de cada sistema y las etiquetas de los diagramas).

Sobre los controles: el bloque usa un desplegable con etiqueta y un `↺ Restablecer` que limpia la sección y sus tablas; cada tabla usa un stepper `− n +`. La palabra "heredar" se descartó a propósito — nombraba el mecanismo (el árbol de ámbitos) y no el efecto; el desplegable dice "Automático — igual que la página" y el stepper muestra el número **en gris mientras sigue a la sección** y **resaltado, con `↺` al lado, cuando tiene valor propio**, que es la única forma de ver de un vistazo cuáles se despegaron. En el desplegable, esa frase larga vive **solo en la lista abierta**: el trigger muestra `Auto (n)` / `Fijo (n)` vía children explícitos del `SelectValue`, porque sin eso rinde el texto completo del item y lo corta por la mitad (ver la trampa de `SelectValue` en [`docs/components.md`](./components.md)).

### Tres trampas al montar estos controles

Las tres ya costaron una sesión cada una; las dos primeras se ven mirando la app, no leyendo el markup.

1. **La etiqueta va en `<span>`, no en `<p>`.** `AccordionContent` le aplica `mb-4` a todo `<p>` que no sea `:last-child`, así que una etiqueta en `<p>` con el control al lado desalinea la fila entera. Ver [`docs/components.md`](./components.md).
2. **El stepper de tabla no se empuja al borde derecho con `justify-between`.** Va pegado a su etiqueta (`flex items-center gap-2`). Subir decimales ensancha la tabla, y casi todos estos bloques miden **lo que mide su tabla** (viven dentro de un `flex flex-wrap`), así que anclado al borde derecho el `+` se corre solo y hay que reapuntar el mouse en cada click — para subir tres decimales, tres clicks con tres reposicionamientos. Pegado al rótulo, su posición depende del ancho del rótulo, que no cambia. Queda un residual anotado como **D9** en el roadmap: el bloque todavía puede saltar de renglón si su propio ensanche rewrapea el `flex-wrap`.
3. **El orden interno del stepper es `− n +` y el `↺` va al final**, después del `+`, y el número tiene ancho fijo (`w-4`). Así ni el `−` ni el `+` se mueven al cambiar de valor ni al aparecer el `↺`. Si se reordena, vuelve el problema del punto 2 en chico.

En el original cada tabla tenía su propio selector con `useState` local y default 2, sin nada global ni por bloque; esto es un superconjunto de aquello.

## Notación compacta y etiquetas fijas (matrices que crecen)

Los decimales resuelven *cuántos dígitos*; esto resuelve el otro lado del mismo problema, que es **cuánto ancho ocupa una matriz que crece con el modelo**. La global es de `DOF × DOF`: en armaduras 2D son `2N`, en pórticos y 3D `3N`. Con 20 nudos son 40 columnas — a ~92 px cada una, unos 3700 px. Ningún layout muestra eso; lo único que se puede hacer es que scrollear sea barato y que haya menos que scrollear.

- **Notación compacta** (`number-scale.ts`, `atomCompactNumbers`, encendida por defecto): un factor común por matriz (`×10³`) en vez de repetir la magnitud en cada celda. La celda pasa de ~92 a ~58 px, que es **casi la mitad del ancho a cualquier tamaño**. El factor sale de la matriz entera y no de cada celda: si cada una eligiera el suyo, la columna dejaría de ser comparable de un vistazo, que es para lo que sirve una matriz. Solo se aplica fuera de la banda `[0.01, 1000)`, donde los números ya se leen de corrido, y es múltiplo de 3 para que caiga en una unidad que alguien nombra. **Se puede apagar** con `<CompactNumbersControl />`, al lado del de decimales, por un caso de uso concreto de esta app: cotejar contra un ejercicio resuelto a mano.
- **Etiquetas fijas** (`stickyLabels` de `MatrixTable`): la fila y la columna de etiquetas se quedan en su lugar al scrollear. Sin eso, scrollear una matriz de 40×40 es leer números sin saber de qué grado de libertad son. **Es opcional a propósito**: solo sirve cuando la matriz está sola en su contenedor de scroll (la global, un bloque de la partición). Los cuatro operandos de una ecuación comparten **un solo** contenedor, así que ahí cada columna de etiquetas se pegaría al mismo borde y se taparían entre sí.
- **Toda matriz que crece necesita su propio `overflow-x-auto`.** No es opcional ni cosmético: dentro de un `AccordionContent`, que lleva `overflow-hidden`, una tabla más ancha que su contenedor no se desborda — **se recorta**. Los pasos de ensamblaje y los bloques de la partición estaban así hasta el 2026-08-12, y con el modelo semilla de 4 nudos no se notaba.

Lo que **no** se hizo y queda anotado en el roadmap (deudas **D12**, **D13**, **D14**): el layout escalonado de la ecuación —fila cuando entra, simbólica arriba con operandos apilados cuando no—, la vista de mapa para matrices muy grandes, y el techo en la cantidad de pasos de ensamblaje que se rinden de una.

## Fuera de alcance de este patrón (a propósito)

- Resaltado interactivo de celdas (hover/click) — Tren B, junto a la visualización.
- Reordenamiento manual de DOF por el usuario (`areDofDefinedByUser`/`isRestrictedAbove` del original) — el motor ya define el orden por inserción; no hay necesidad pedagógica clara de que el usuario lo reordene. Se agrega después si hace falta.
- Diagramas físicos (nudos/barras dibujados) — Tren B.

## Lo que agregó frame2d (3 DOF/nudo, Tren C)

El tercer sistema no necesitó tocar el patrón, solo instanciarlo con una diferencia conceptual: **el tercer DOF de cada nudo no es una traslación**. Eso se nota en tres lugares y conviene tenerlo presente al portarlo a otro sistema con rotación:

- En el store, la "fuerza" del DOF rotacional es un **momento** (`momentR`) y su "desplazamiento" es un **giro** (`displacementR`) — misma posición en el vector, magnitud física distinta. Los toggles de restricción se resolvieron con mapas `axis → campo` en vez de un `if` por eje, que con 3 ejes ya no escalaba.
- `dofLabels = ["x", "z", "θ"]` se exporta desde `store/nodes.ts` y lo consumen `DofOrderTable`, `assembly-steps` y `partition-and-solution`, en vez de repetir el array `AXIS_LABEL` en cada archivo como en armaduras 2D.
- `internal-forces-table.tsx` es el que más se aleja del original: la fuerza interna ya no es un escalar sino axial + corte + momento **en cada extremo**, así que la tabla tiene dos filas por barra y muestra el paso intermedio `u_local = T·u_global` antes de `f_local = k_local·u_local`.

## Lo que agregó armaduras 3D (3 DOF/nudo otra vez, Tren D)

El cuarto sistema tampoco tocó el patrón, y es el que mejor muestra dónde está el límite entre "mismo número de DOF" y "mismo tipo de DOF". Frente a frame2d, que también tiene 3 DOF por nudo:

- **Los tres DOF son la misma magnitud física** (traslaciones), así que no aparece la distinción fuerza/momento ni desplazamiento/giro que frame2d necesitó. `dofLabels = ["x", "y", "z"]` y listo.
- **Los mapas eje → campo del store se exportan y los consume la UI**, no solo los toggles. Con tres ejes simétricos, `node-table.tsx` genera sus 14 columnas iterando `nodeAxes` en vez de escribirlas a mano, y `partition-and-solution.tsx` indexa el campo por `nodeAxes[entry.localDof]` en vez de un ternario. Es el mismo criterio que estrenó frame2d ("con 3 ejes un `if` por eje ya no escala"), llevado un paso más: si los ejes son simétricos, la UI también se puede generar.
- **`element-table.tsx` nació byte-idéntico al de armaduras 2D** — una barra espacial pide exactamente los mismos datos que una plana (extremos, área, E); toda la diferencia entre 2D y 3D vive en los nudos. Es la primera pareja idéntica del repo. Siguiendo el criterio con que se extrajo `errors-panel` (al llegar el tercer caso), **se dejó duplicada a propósito**: el próximo sistema que necesite esta misma tabla dispara la extracción a `src/components/custom/`. **Hoy ya no son idénticas**: el 2026-08-10 la de armaduras 2D recibió el botón de insertar por fila y la de 3D todavía no — ver la deuda **D2** del roadmap.
- **Hay tests del store**, no solo del motor (`src/app/armaduras-3d/store/results.test.ts`). Con tres ejes intercambiables, cruzar `y` con `z` en un solo mapa produce resultados plausibles que ninguna revisión visual detecta. Vale la pena replicarlo en cualquier sistema con ejes simétricos.

La visualización, que sí cambió de tecnología, está en [`docs/diagram-3d-pattern.md`](./diagram-3d-pattern.md).

## Checklist ejecutado para portar a armaduras 2D (referencia para el próximo sistema)

Esto es lo que se siguió para dejar `/armaduras-2d` completo — ya hecho. Sirvió tal cual para `/frame2d` (Tren C), ajustando 3 DOF/nudo y rigidez con flexión. Se deja como referencia concreta de pasos para el próximo sistema que necesite este patrón.

1. ✅ Extraído lo genérico a `src/components/custom/` (por convención de `docs/components.md`: "si se acumulan suficientes componentes relacionados, se organizan en subcarpetas"; con un segundo sistema usándolos, ya era el momento) — `matrix-table.tsx`, `decimals.ts`/`decimals-control.tsx`, y `dof-order-table.tsx` (se le agregó el prop opcional `dofLabels` para el caso de más de 1 DOF/nudo). Evita terminar con archivos byte-idénticos duplicados entre `springs/` y `armaduras-2d/`, que es exactamente el patrón que el diagnóstico del roadmap marcó como problema en el proyecto original.
2. ✅ Creado `src/app/armaduras-2d/` con la misma estructura de carpetas.
3. ✅ `store/nodes.ts`: además de `restrained`/`force`/`displacement`, cada nudo tiene **coordenadas** (`x`, `z`) — `TrussElement2D` (`src/lib/engine/trusses-2d/truss-element-2d.ts`, ya construido en el Tren 2) las pide en el constructor. Con `dofPerNode = 2` se usaron campos planos por eje (`forceX`/`forceZ`, `displacementX`/`displacementZ`, `restrainedX`/`restrainedZ`) en vez de objetos anidados — `store/results.ts` los convierte a los arrays de longitud 2 que pide `System.addNode`.
4. ✅ `store/elements.ts`: en vez de `k`, cada barra tiene `area` y `elasticity` (más `fromNodeId`/`toNodeId` como en springs).
5. ✅ `store/results.ts`: `new System(2)` en vez de `new System(1)`, instanciando `TrussElement2D` en vez de `SpringElement` (con manejo de error si una barra referencia un nudo inexistente — necesario porque `TrussElement2D` pide las coordenadas del nudo, no solo su id).
6. ✅ `local-stiffness-list.tsx` e `internal-forces-table.tsx` adaptados a la rigidez con transformación geométrica y a que la fuerza interna de una barra es axial vía proyección `cos`/`sin` (ver `TrussElement2D.internalForce`).
7. ✅ Verificado con `pnpm test` (la regresión de armaduras 2D en `src/lib/engine/trusses-2d/system.test.ts` se reusó como datos semilla de la página, para poder cotejar visualmente contra valores ya validados), `tsc`, `lint`, y sirviendo `/armaduras-2d` con `pnpm dev`.

## El modo práctica (`matrix-quiz.tsx`)

Convierte dos pasos del método en ejercicios corregidos, detrás de un interruptor que **arranca apagado**: la página es material de estudio, no un examen.

- **La corrección es pura y vive aparte** (`matrix-quiz-check.ts`), así que se testea sin DOM: comparación de conjuntos para las posiciones —separando faltantes de sobrantes, que son errores distintos— y comparación numérica con margen **relativo** para los valores.
- **Los ejercicios corrigen contra el motor**, nunca contra números escritos a mano en la UI: las posiciones salen del `dofOrder` real y los valores de `TrussElement2D.stiffness()`. Si cambia la fórmula, cambia el ejercicio.
- **La grilla es un componente aparte de `MatrixTable`**: esa renderiza texto y ya carga tres cosas (decimales, notación compacta, etiquetas fijas), y su resaltado por celda ya significa las zonas de la partición.
