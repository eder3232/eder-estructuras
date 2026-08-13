# Patrón de visualización 2D (Tren B)

Este documento describe el patrón que dejó `/armaduras-2d` con su capa de visualización SVG, ya replicado en `/frame2d` (Tren C) y aplicable a cualquier sistema **plano** que siga — el único que queda es `frame2d-seismic`. Para sistemas **espaciales** el módulo es otro: ver [`docs/diagram-3d-pattern.md`](./diagram-3d-pattern.md) (three.js). Complementa a [`docs/state-pattern.md`](./state-pattern.md) (patrón de estado/resultados) — léelo primero si no lo hiciste, este documento asume que ya existe un `store/results.ts` con un `SolveResult` resuelto.

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
  diagram-label.tsx                 # TODO texto del diagrama: halo del color del fondo
  axial-label.ts                    # dónde va el número de fuerza axial de una barra
  support-icon.tsx                  # empotramiento / articulado / rodillo, rotado según el eje restringido
  force-arrow.tsx                   # flecha recta + valor, para los DOF de traslación
  moment-arc.tsx                    # arco + valor, para el DOF rotacional (momento)
  force-glyph.tsx                   # único punto de decisión entre flecha y arco, según el eje
  schema-diagram.tsx                # vista no deformada: nudos, barras, apoyos, flechas de fuerza
  deformed-diagram.tsx              # forma desplazada (con slider de escala), barras coloreadas por tracción/compresión, reacciones

src/app/<sistema>/components/
  schema-diagram.tsx                # adaptador: lee atomNodes/atomElements, arma props del genérico
  results/deformed-shape.tsx        # adaptador: lee `solved` (SolveResult), arma props del genérico
```

## El mapeo de coordenadas

El eje estructural `z` crece hacia arriba; el eje `y` de SVG crece hacia abajo. Todo el módulo genérico opera en coordenadas ya proyectadas vía `projectPoint({x, z}) -> {x, y: -z}` — nunca se usa `z` crudo para dibujar. `computeViewBox` arma el bounding box (con padding del 28%, ver "Dónde van los números") a partir de puntos ya proyectados, y `computeUnitSize` deriva una longitud de referencia (`max(width, height) / 40`) para el radio de los nudos, el tamaño de flechas/íconos y la fuente — evita hardcodear tamaños en píxeles que se ven mal a distinta escala de figura. Las líneas usan `vector-effect="non-scaling-stroke"` para que el grosor de trazo no dependa del zoom del viewBox.

## Las dos vistas

1. **`SchemaDiagram`** (`nodes`, `elements`, `supports`, `forces`): la vista no deformada. Es un preview en vivo — en `/armaduras-2d` el adaptador lee `atomNodes`/`atomElements` directamente (no `atomResults`), así que se actualiza mientras el usuario edita, incluso con datos inválidos a medio completar (los elementos con `fromNodeId`/`toNodeId` que todavía no resuelven a un nudo existente simplemente no se dibujan, sin romper el resto).
2. **`DeformedDiagram`** (`nodes`, `elements`, `displacements`, `reactions`, `elementForceValue`): solo tiene sentido con un `SolveResult` ya resuelto, va dentro del acordeón de resultados (5ª sección en armaduras-2d). Dibuja la forma original tenue punteada + la desplazada sólida (nudo + `displacement × scaleFactor`), coloreada por signo de `elementForceValue.get(element.id)` (verde=tracción, rojo=compresión vía el token `--destructive`, gris=cero con umbral `1e-6`), más flechas de reacción. El factor de escala es estado local (`useState` dentro de `DeformedDiagram`), no un átomo global — a diferencia de `atomDecimals`, que consumen varios componentes independientes, el factor de escala solo lo usa este componente.

`ForceArrow` se reusa para ambas cosas (fuerza aplicada y reacción) vía el prop `variant`: `"force"` es azul, `"reaction"` usa el token de tema `--warning` — distingue visualmente el dato que el usuario ingresó del que el motor resolvió (el original no distinguía, es una mejora barata). Una flecha con `value === 0` no se dibuja (evita ruido visual en reacciones que dan exactamente cero, como el DOF z de un apoyo con solo componente x).

## Dónde van los números (deuda D6, resuelta el 2026-08-12)

Un diagrama estructural **no tiene lugar libre garantizado**: la etiqueta de una fuerza cae donde la lleve su flecha, y ahí puede haber una barra, otra etiqueta o el borde del lienzo. Se resolvió en tres capas, y hacen falta las tres — cada una cubre lo que la anterior no puede.

1. **Ninguna etiqueta se apoya sobre el eje de lo que rotula.** Era el bug de fondo de D6: el número iba *centrado* un poco más allá de la punta de la flecha, así que media etiqueta volvía sobre la cabeza — con la punta clavada entre dos dígitos— y, en las flechas verticales, sobre la barra que sale del nudo. Ahora arranca en la punta y **crece hacia afuera** (`textAnchor` `start`/`end` según la dirección); las horizontales además bajan medio renglón, porque los nombres de barra viven *arriba* de su barra. El arco de momento va arriba a la izquierda del nudo, que es el único cuadrante que no usan las flechas rectas — un empotramiento tiene las tres reacciones en el mismo nudo.
2. **Todo texto lleva halo del color del fondo** (`DiagramLabel`, con `paint-order: stroke`). Correr las etiquetas resuelve los choques *previsibles*; el halo cubre los que dependen de la geometría que cargue el usuario. Es `paint-order` y no un rectángulo de fondo porque sigue la forma de las letras: un rectángulo taparía la barra de atrás en un bloque y se vería como un parche. El halo usa `background` (el fondo de la página) y no el del lienzo, que es `bg-muted/20` y no tiene token propio: medido sobre capturas, la diferencia entre los dos es de 6/255 por canal en oscuro y 2/255 en claro.
3. **El margen del `viewBox` reserva lugar para la etiqueta más larga.** Un texto cortado por el borde es tan ilegible como uno superpuesto. El peor caso es una reacción horizontal en el nudo del borde: flecha (2.2 unidades) + separación (0.55) + siete caracteres monoespaciados (4.2) ≈ 7 unidades. **La cuenta se muerde la cola** —la unidad se deriva del `viewBox` ya padeado, así que agrandar el margen agranda el texto que hay que meter adentro—, y resolver la desigualdad da `paddingRatio ≥ 0.266`. Está en `0.28`, y `viewbox.test.ts` fija el invariante para que nadie lo baje "para que la figura se vea más grande".

El **valor de la fuerza axial sobre cada barra** (U4) sigue las mismas reglas, en `axial-label.ts`: al **25% del recorrido y no en el medio**, porque las dos diagonales de una armadura se cruzan justo en su punto medio y dos números centrados quedarían uno sobre el otro (es también la posición que usaba el original), y corrido perpendicular **hacia afuera de la figura**, medido contra el centro del diagrama. Ese "hacia afuera" no fue la primera regla que se probó: la anterior corría la etiqueta siempre hacia arriba en pantalla, que en una barra casi vertical no quiere decir nada —ahí la componente vertical de la perpendicular es ~0 y su signo lo decide el ruido—, y un desplazamiento de milésimas alcanzó para dar vuelta el lado y apilar dos números. Lo encontró una captura, y hoy lo fija `axial-label.test.ts`.

## Piezas específicas de cada sistema

El adaptador (`src/app/<sistema>/components/schema-diagram.tsx` y `.../results/deformed-shape.tsx`) es lo único que cambia por sistema:

- **`DiagramSupport[]`**: en armaduras 2D sale de `node.restrainedX`/`restrainedZ`. Los sistemas con DOF rotacional pasan además `restrainedRotation` (opcional, ver abajo).
- **`elementForceValue: Map<string, number>`**: en armaduras 2D es directo (`TrussInternalForce.axialForce`, un solo número con signo). En frame2d se usa `internalForce.to.axial` — ver abajo el porqué.
- **`reactions: DiagramForce[]`**: se arma recorriendo cada nudo y cada eje restringido, sin filtrar por magnitud (el filtro de "no dibujar si es cero" ya lo hace `ForceArrow`).

## El DOF rotacional (resuelto en el Tren C)

Portar el patrón a frame2d obligaba a decidir tres cosas que armaduras 2D no tenía. Las tres se resolvieron extendiendo el módulo genérico de forma **compatible hacia atrás** — `restrainedRotation` es opcional y el eje `"r"` simplemente nunca aparece en los sistemas sin rotación, así que `/armaduras-2d` no cambió:

1. **Apoyo con giro restringido** (`support-icon.tsx`). Ahora hay tres notaciones en vez de dos: empotramiento (ambas traslaciones **y** el giro) se dibuja como muro achurado pegado al nudo, **sin** triángulo — el triángulo queda reservado para los apoyos que sí dejan girar (articulado, con achurado; rodillo, con círculos). Un giro impedido sin ambas traslaciones (apoyo guiado, poco común) se marca con un cuadrado sobre el nudo, para no dibujar un empotramiento que no es. El achurado de suelo se extrajo al subcomponente `Ground` porque ahora lo usan dos glifos distintos.
2. **Momento aplicado o de reacción** (`moment-arc.tsx`, `force-glyph.tsx`). Un momento no es un vector en el plano: dibujarlo como flecha recta lo confundiría con una fuerza. Se dibuja como arco de 270° alrededor del nudo, antihorario si el valor es positivo — mismo criterio de signo que el DOF rotacional del motor (giro de +x hacia +z). `DiagramForce.axis` acepta ahora `"r"`, y **`ForceGlyph` es el único punto donde se decide** flecha vs. arco, para que `SchemaDiagram` y `DeformedDiagram` no repitan ese `if`. `ForceArrow` quedó intacto y sigue siendo solo la flecha recta.
3. **Color de la barra deformada**. Se mantiene la **fuerza axial** (`internalForce.to.axial`, positivo = tracción), igual que en armaduras 2D, no el momento: de los tres esfuerzos es el único que es un número con signo constante a lo largo de la barra. El momento varía punto a punto, así que un solo color por barra daría una lectura falsa — el detalle de corte y momento vive en la tabla de fuerzas internas, no en el color. Efecto lateral: la leyenda "verde = tracción / rojo = compresión" significa lo mismo en todos los sistemas.

Lo que **no** se resolvió acá, a propósito: la forma deformada sigue siendo una recta entre nudos desplazados. Con flexión, el tramo entre nudos es en realidad una cúbica de Hermite gobernada por los giros de sus extremos, y el giro de un nudo hoy no se ve en el dibujo (solo en el momento de las barras que concurren). Dibujar esa curva es una mejora pedagógica clara, pero es trabajo aparte: hay que muestrear la deformada con las funciones de forma del elemento, no solo mover los extremos.

## Decisiones técnicas a mantener

- SVG puro, sin three.js ni librería de gráficos — consistente con el principio 4 del roadmap ("2D no es 3D").
- Colores por clase de Tailwind sobre tokens de tema (`fill-primary`, `stroke-destructive`, `stroke-warning`, `fill-muted-foreground`) para que la visualización se adapte a dark mode automáticamente — el original tenía colores hardcodeados (`"purple"`, `"black"`, `"red"`) que no se adaptaban.
- `vector-effect="non-scaling-stroke"` **en cada forma que se traza, nunca en el `<g>` que la contiene**: `vector-effect` no es una propiedad heredable, así que ponerlo en el grupo no hace nada por los hijos. `stroke-width` **sí** hereda, y ahí está la trampa — un `<g strokeWidth={1.5} vectorEffect="…">` con hijos que no repiten el `vectorEffect` deja el trazo en **unidades del modelo**. A la escala típica de estos diagramas (un `viewBox` de ~5 unidades en un lienzo de 500 px ⇒ ~96 px por unidad) eso son ~144 px de grosor, y el glifo desaparece bajo su propio borde. Fue exactamente el bug de los apoyos de `/armaduras-2d` y de los empotramientos de `/frame2d`.
- Corolario del punto anterior: **toda forma maciza lleva `stroke-none` explícito**. Las puntas de flecha viven dentro de un grupo que fija el color con `stroke-blue-500`/`stroke-warning`; sin `stroke-none` heredan ese color con el `stroke-width` inicial (`1`, otra vez en unidades del modelo, no en píxeles). El texto es la excepción y por eso pasa todo por `DiagramLabel`: ahí el `stroke` no se anula, se **reemplaza** por el halo del color del fondo, con un ancho propio y a propósito sin `vector-effect` (tiene que escalar con la fuente).
- El estado de UI que solo usa un componente (factor de escala) es `useState` local, no un átomo global — reservar Jotai para lo que de verdad comparten varios componentes (como `atomDecimals`).

## Fuera de alcance de este patrón (a propósito)

- Interactividad (hover/click sobre un nudo o barra para resaltarlo en las tablas) — no se pidió, se agrega después si hace falta.
- Deformada curva entre nudos (cúbica de Hermite con los giros de los extremos) — ver la sección del DOF rotacional. Anotada como deuda **D3** en el roadmap.
- Diagramas de corte y momento a lo largo de la barra — el original los tenía (`graphShear`, `graphMoment`) y son contenido pedagógico valioso, pero son otra vista, no una variante de la deformada. Anotada como deuda **D4** en el roadmap.
- Exportar el SVG como imagen — no se pidió.
