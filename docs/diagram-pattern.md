# Patrón de visualización 2D (Tren B)

Este documento describe el patrón que dejó `/armaduras-2d` con su capa de visualización SVG, para replicarlo en frame2d/frame2d-seismic (Tren C) y en cualquier sistema plano que siga. Complementa a [`docs/state-pattern.md`](./state-pattern.md) (patrón de estado/resultados) — léelo primero si no lo hiciste, este documento asume que ya existe un `store/results.ts` con un `SolveResult` resuelto.

**Implementación de referencia real**: todo lo que describe este documento ya existe y funciona en `src/components/custom/diagram-2d/` (genérico) y `src/app/armaduras-2d/components/schema-diagram.tsx` + `.../components/results/deformed-shape.tsx` (específico de armaduras 2D). Ante la duda, leé el código ahí — este documento puede quedar desactualizado, el código no.

## Por qué existe este patrón

El proyecto anterior (`thesis-structures`) dibujaba los sistemas 2D (armor2d, frame2d, frame2d-seismic) con una escena three.js completa (`OrthographicCamera`, `Text3D`, `Sphere`, `Line`) — sobre-ingeniería para gráficos inherentemente 2D, con `arrow.tsx`/`articulatedSuport.tsx`/`rollerSuport.tsx` duplicados byte-idénticos entre programas. Acá la visualización es SVG puro (sin three.js, sin librería de gráficos) y vive en `src/components/custom/diagram-2d/`, separada del motor a propósito: nada ahí sabe qué es un `TrussElement2D` ni cómo se calculó un desplazamiento, solo recibe datos planos ya armados por un adaptador específico del sistema.

## Estructura

```
src/components/custom/diagram-2d/   # genérico, no depende de qué es un "elemento"
  types.ts                          # DiagramNode, DiagramElement, DiagramForce, DiagramSupport
  viewbox.ts                        # projectPoint (flip z→-y), computeViewBox, viewBoxAttr
  unit-scale.ts                     # computeUnitSize — longitud de referencia para íconos/fuente
  svg-canvas.tsx                    # contenedor <svg> responsive con el viewBox calculado
  support-icon.tsx                  # apoyo fijo (2 ejes restringidos) o rodillo (1 eje), rotado según el eje
  force-arrow.tsx                   # flecha + valor, reusada para fuerza aplicada ("force") y reacción ("reaction")
  schema-diagram.tsx                # vista no deformada: nudos, barras, apoyos, flechas de fuerza
  deformed-diagram.tsx              # forma desplazada (con slider de escala), barras coloreadas por tracción/compresión, reacciones

src/app/<sistema>/components/
  schema-diagram.tsx                # adaptador: lee atomNodes/atomElements, arma props del genérico
  results/deformed-shape.tsx        # adaptador: lee `solved` (SolveResult), arma props del genérico
```

## El mapeo de coordenadas

El eje estructural `z` crece hacia arriba; el eje `y` de SVG crece hacia abajo. Todo el módulo genérico opera en coordenadas ya proyectadas vía `projectPoint({x, z}) -> {x, y: -z}` — nunca se usa `z` crudo para dibujar. `computeViewBox` arma el bounding box (con padding del 15%) a partir de puntos ya proyectados, y `computeUnitSize` deriva una longitud de referencia (`max(width, height) / 40`) para el radio de los nudos, el tamaño de flechas/íconos y la fuente — evita hardcodear tamaños en píxeles que se ven mal a distinta escala de figura. Las líneas usan `vector-effect="non-scaling-stroke"` para que el grosor de trazo no dependa del zoom del viewBox.

## Las dos vistas

1. **`SchemaDiagram`** (`nodes`, `elements`, `supports`, `forces`): la vista no deformada. Es un preview en vivo — en `/armaduras-2d` el adaptador lee `atomNodes`/`atomElements` directamente (no `atomResults`), así que se actualiza mientras el usuario edita, incluso con datos inválidos a medio completar (los elementos con `fromNodeId`/`toNodeId` que todavía no resuelven a un nudo existente simplemente no se dibujan, sin romper el resto).
2. **`DeformedDiagram`** (`nodes`, `elements`, `displacements`, `reactions`, `elementForceValue`): solo tiene sentido con un `SolveResult` ya resuelto, va dentro del acordeón de resultados (5ª sección en armaduras-2d). Dibuja la forma original tenue punteada + la desplazada sólida (nudo + `displacement × scaleFactor`), coloreada por signo de `elementForceValue.get(element.id)` (verde=tracción, rojo=compresión vía el token `--destructive`, gris=cero con umbral `1e-6`), más flechas de reacción. El factor de escala es estado local (`useState` dentro de `DeformedDiagram`), no un átomo global — a diferencia de `atomDecimals`, que consumen varios componentes independientes, el factor de escala solo lo usa este componente.

`ForceArrow` se reusa para ambas cosas (fuerza aplicada y reacción) vía el prop `variant`: `"force"` es azul, `"reaction"` usa el token de tema `--warning` — distingue visualmente el dato que el usuario ingresó del que el motor resolvió (el original no distinguía, es una mejora barata). Una flecha con `value === 0` no se dibuja (evita ruido visual en reacciones que dan exactamente cero, como el DOF z de un apoyo con solo componente x).

## Piezas específicas de cada sistema

El adaptador (`src/app/<sistema>/components/schema-diagram.tsx` y `.../results/deformed-shape.tsx`) es lo único que cambia por sistema:

- **`DiagramSupport[]`**: en armaduras 2D sale de `node.restrainedX`/`restrainedZ`. Un sistema con más ejes (frame2d con rotación, armor3d con 3 ejes) va a necesitar decidir cómo se representa un apoyo con un DOF rotacional restringido — no está resuelto por este patrón todavía, es lo primero a diseñar antes de portarlo a frame2d.
- **`elementForceValue: Map<string, number>`**: en armaduras 2D es directo (`TrussInternalForce.axialForce`, un solo número con signo). Un elemento de pórtico tiene fuerza axial + corte + momento — hay que decidir qué "un solo número con signo" representa para el color antes de reusar `DeformedDiagram` tal cual, o extender el criterio de coloreado.
- **`reactions: DiagramForce[]`**: se arma recorriendo cada nudo y cada eje restringido, sin filtrar por magnitud (el filtro de "no dibujar si es cero" ya lo hace `ForceArrow`).

## Decisiones técnicas a mantener

- SVG puro, sin three.js ni librería de gráficos — consistente con el principio 4 del roadmap ("2D no es 3D").
- Colores por clase de Tailwind sobre tokens de tema (`fill-primary`, `stroke-destructive`, `stroke-warning`, `fill-muted-foreground`) para que la visualización se adapte a dark mode automáticamente — el original tenía colores hardcodeados (`"purple"`, `"black"`, `"red"`) que no se adaptaban.
- `vector-effect="non-scaling-stroke"` en todo trazo, para que el grosor de línea no dependa de la escala del `viewBox`.
- El estado de UI que solo usa un componente (factor de escala) es `useState` local, no un átomo global — reservar Jotai para lo que de verdad comparten varios componentes (como `atomDecimals`).

## Fuera de alcance de este patrón (a propósito)

- Interactividad (hover/click sobre un nudo o barra para resaltarlo en las tablas) — no se pidió, se agrega después si hace falta.
- Apoyos/elementos con DOF rotacional (frame2d) — el diseño de `SupportIcon`/`elementForceValue` para ese caso queda pendiente hasta portar el Tren C.
- Exportar el SVG como imagen — no se pidió.
