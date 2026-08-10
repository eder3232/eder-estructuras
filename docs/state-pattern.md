# Patrón de estado y resultados (Tren A)

Este documento describe el patrón que dejó `/springs` funcionando de punta a punta, para replicarlo en armaduras 2D y en los sistemas que siguen. Si estás retomando el trabajo después de un `/clear`, este es el punto de partida — junto con [`docs/refactor-roadmap.md`](./refactor-roadmap.md) (por qué este orden de trabajo) y [`docs/components.md`](./components.md) (convención de carpetas de componentes).

**Implementación de referencia real**: todo lo que describe este documento ya existe y funciona en `src/app/springs/`. Ante la duda, leé el código ahí en vez de confiar solo en este resumen — este documento puede quedar desactualizado, el código no.

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
    results-panel.tsx               # Accordion que orquesta las 4 secciones de abajo
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

## El diseño pedagógico de resultados (las 4 secciones del acordeón)

Esto es una **mejora deliberada sobre el original**, no una réplica — ver la discusión completa en el historial de commits (`960a38e`, `932f9e2`) si hace falta el porqué completo. El estándar a mantener en todos los sistemas:

1. **DOF y matrices locales**: tabla explícita "posición ↔ nudo ↔ qué incógnita se resuelve ahí" **antes** de mostrar cualquier matriz — la posición numérica tiene que tener significado desde el principio. Después, la rigidez local de cada elemento (fórmula general + valores).
2. **Ensamblaje de la matriz global**: un paso por elemento, cada uno con una leyenda física ("Barra e1 (k=10) conecta v4↔v2 → aporta en las posiciones de v4 y v2") y las celdas que cambiaron resaltadas (diff entre el paso anterior y el actual — sin lógica de interacción, eso es Tren B).
3. **Partición y solución**: las 4 submatrices (`kff/kfr/krf/krr` — vocabulario libre/restringido, equivalente directo al `kuu/kur/kru/krr` del original) y la ecuación `Uf = Kff⁻¹·(Ff − Kfr·Ur)` con sustitución numérica.
4. **Fuerzas internas**: sustitución numérica por elemento.

Acordeón `type="multiple"`, primera sección abierta por defecto. Control de decimales **global** (`atomDecimals`), no por sección como tenía el original.

## Piezas ya genéricas vs. específicas de springs

**Genéricas — no dependen de `dofPerNode` ni de qué es un "elemento"**, se pueden reusar tal cual:
- `matrix-table.tsx` (ojo: soporta `labels` para matrices cuadradas simétricas, y `rowLabels`/`colLabels` por separado para bloques no cuadrados como `Kfr`/`Krf` — no colapsar ambos en una sola prop, ese fue un bug real que se corrigió antes de commitear).
- `decimals.ts` (el átomo) y `decimals-control.tsx`.
- `dof-order-table.tsx` — solo necesita `AssemblyResult["dofOrder"]` y un mapa `id → nombre`, ninguno de los dos es específico de springs.

**Específicas de springs** — hay que adaptarlas (no solo copiarlas) para cada sistema nuevo:
- `node-table.tsx`/`element-table.tsx` — cambian los campos (armaduras necesita coordenadas, área, elasticidad en vez de `k`).
- `local-stiffness-list.tsx` — la rigidez local de un resorte es literalmente `[[k,-k],[-k,k]]`, sin transformación geométrica; una barra de armadura sí la tiene.
- `internal-forces-table.tsx` — la sustitución numérica depende de qué es la "fuerza interna" de cada `Element` concreto.
- `store/*.ts` — los campos y el `Element` concreto que se instancia cambian.

## Decisiones técnicas a mantener

- IDs estables vía `crypto.randomUUID()`, no el paquete `uuid`.
- Referencias entre nodos y elementos por `id`, nunca por `name`.
- Selector de nudo (combobox "desde"/"hacia") → usar `ui/select.tsx` (Radix, API simple y ya conocida), **no** `ui/combobox.tsx` (primitiva de Base UI, más compleja de lo que este caso necesita).
- Alert de errores → `ui-custom/alert.tsx` (tiene la variante `destructive` igual que el original, más `warning`/`info` si hacen falta), según la convención de `docs/components.md`.
- Sin KaTeX/LaTeX — las fórmulas se muestran como texto plano formateado (`tabular-nums`), no se agregó esa dependencia. Si en algún momento se decide agregarla, es una decisión aparte a discutir, no algo a colar de paso.

## Fuera de alcance de este patrón (a propósito)

- Resaltado interactivo de celdas (hover/click) — Tren B, junto a la visualización.
- Reordenamiento manual de DOF por el usuario (`areDofDefinedByUser`/`isRestrictedAbove` del original) — el motor ya define el orden por inserción; no hay necesidad pedagógica clara de que el usuario lo reordene. Se agrega después si hace falta.
- Diagramas físicos (nudos/barras dibujados) — Tren B.

## Checklist para portar a armaduras 2D (próximo paso concreto)

1. **Primero, extraer lo genérico** a `src/components/custom/` (por convención de `docs/components.md`: "si se acumulan suficientes componentes relacionados, se organizan en subcarpetas"; con un segundo sistema usándolos, ya es el momento) — `matrix-table.tsx`, `decimals.ts`/`decimals-control.tsx`, y evaluar `dof-order-table.tsx`. Evita terminar con archivos byte-idénticos duplicados entre `springs/` y `armaduras-2d/`, que es exactamente el patrón que el diagnóstico del roadmap marcó como problema en el proyecto original.
2. Crear `src/app/armaduras-2d/` con la misma estructura de carpetas.
3. `store/nodes.ts` (o `vertices.ts`): además de `force`/`displacement`/`restrained`, cada nudo necesita **coordenadas** (`x`, `z`) — `TrussElement2D` (`src/lib/engine/trusses-2d/truss-element-2d.ts`, ya construido en el Tren 2) las pide en el constructor. Con `dofPerNode = 2`, `force`/`displacement`/`restrained` pasan a tener un valor por eje (decidir la forma exacta: campos `forceX`/`forceZ` separados, o `force: { x, z }` — cualquiera funciona, lo que importa es que `results.ts` los convierta a los arrays de longitud 2 que pide `System.addNode`).
4. `store/elements.ts`: en vez de `k`, cada barra necesita `area` y `elasticity` (más `fromNodeId`/`toNodeId` como en springs).
5. `store/results.ts`: `new System(2)` en vez de `new System(1)`, instanciar `TrussElement2D` en vez de `SpringElement`.
6. `local-stiffness-list.tsx` e `internal-forces-table.tsx`: adaptar a la rigidez con transformación geométrica y a que la fuerza interna de una barra es axial vía proyección `cos`/`sin` (ver `TrussElement2D.internalForce`).
7. Verificar con `pnpm test` (ya existe una regresión de armaduras 2D en `src/lib/engine/trusses-2d/system.test.ts` para contrastar valores), `tsc`, `lint`, y sirviendo `/armaduras-2d` con `pnpm dev`.
