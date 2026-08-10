# Patrón de visualización 3D (Tren D)

Este documento describe la capa de visualización espacial que dejó `/armaduras-3d`, y por qué es un módulo **aparte** del de 2D en vez de una extensión suya. Complementa a [`docs/diagram-pattern.md`](./diagram-pattern.md) (visualización 2D en SVG) y a [`docs/state-pattern.md`](./state-pattern.md) (patrón de estado). Si vas a tocar visualización plana, el documento que buscás es el de 2D, no este.

**Implementación de referencia real**: `src/components/custom/diagram-3d/` (genérico) y `src/app/armaduras-3d/components/schema-diagram.tsx` + `.../components/results/deformed-shape.tsx` (adaptadores). Ante la duda, leé el código — este documento puede quedar desactualizado, el código no.

## Por qué three.js acá y SVG allá

Es el principio 4 del roadmap ("2D no es 3D") aplicado en las dos direcciones. El proyecto original usaba una escena three.js completa para dibujar pórticos planos — sobre-ingeniería que el Tren B reemplazó por SVG. Pero `armor3d` sí es un caso 3D real: hace falta que el usuario **rote la figura** para entender qué barra está adelante y cuál atrás, y eso no se resuelve con un `<svg>` sin escribir a mano una cámara, un z-ordering y un manejo de arrastre.

Por eso son **dos módulos hermanos, no uno con un flag**: `diagram-2d/` no importa nada de three.js y `diagram-3d/` no importa nada de `diagram-2d/`. Lo que comparten son las decisiones, no el código — mismas proporciones de nudo/flecha, mismo criterio de color, mismo reparto entre módulo genérico y adaptador por sistema.

Costo asumido: tres dependencias nuevas (`three`, `@react-three/fiber`, `@react-three/drei`) que ningún otro sistema del repo usa.

## Estructura

```
src/components/custom/diagram-3d/   # genérico, no sabe qué es un elemento estructural
  types.ts                          # Diagram3DNode/Element/Force/Support, Point3, AXIS_INDEX
  bounds.ts                          # computeBounds (centro, radio, extent) + computeUnitSize
  theme-colors.ts                   # lee los tokens de globals.css y los convierte de oklch a sRGB
  orientation.ts                    # rotación de cilindros/conos por eje y sentido
  scene-canvas.tsx                  # Canvas, cámara z-arriba, luces, piso, terna de ejes, OrbitControls
  force-arrow-3d.tsx                # flecha (vástago + punta) sobre un eje, con etiqueta de valor
  support-glyph-3d.tsx              # cono (3 DOF impedidos) o manguitos por eje (restricción parcial)
  schema-scene.tsx                  # vista no deformada
  deformed-scene.tsx                # forma desplazada con slider de escala

src/app/<sistema>/components/
  schema-diagram.tsx                # adaptador: lee atomNodes/atomElements
  results/deformed-shape.tsx        # adaptador: lee `solved` (SolveResult)
```

## Las coordenadas: no hay proyección

Esta es la diferencia conceptual más importante con el módulo 2D. Ahí todo pasa por `projectPoint({x, z}) -> {x, y: -z}` porque el eje y de SVG crece hacia abajo. Acá **no hay proyección de ningún tipo**: se le dice a la cámara que su "arriba" es +z (`camera.up = (0,0,1)`) y las coordenadas estructurales entran a three.js tal cual.

La alternativa habitual —remapear (x,y,z) estructural a (x,z,y) de three.js, porque el "arriba" por defecto de three es +y— se descartó a propósito: obliga a recordar el swap en cada componente, y un solo lugar donde se olvide produce una figura que se ve razonable pero está mal. Con `up = (0,0,1)` no hay nada que recordar; el precio es que `OrbitControls` orbita respecto de ese eje, que es justamente lo que se quiere en una vista de ingeniería.

## Los colores: los mismos tokens, por otro camino

`diagram-2d` usa clases de Tailwind (`fill-primary`, `stroke-destructive`) y se adapta al tema gratis. Un material de three.js no acepta una clase CSS: quiere un color concreto. Clavar hexadecimales en la escena sería repetir el error del original (`"purple"`, `"black"`, `"red"` que no se adaptaban).

La salida: `theme-colors.ts` lee los mismos tokens de `globals.css` desde el `:root` real (`getComputedStyle`) y los convierte a sRGB. Los tokens están en `oklch()`, que `THREE.Color.setStyle()` no parsea, así que la conversión OKLCH → OKLab → LMS → sRGB está escrita a mano (~30 líneas, con test en `theme-colors.test.ts`). Si un token falta o no parsea, cae a un valor de reserva en vez de romper la escena.

Los colores se leen **una vez por escena** (`useMemo` en `schema-scene`/`deformed-scene`) y se pasan hacia abajo como props — no cada glifo llamando a `getComputedStyle` por su cuenta.

Dos colores quedan fuera de los tokens a propósito, igual que en 2D: el azul de carga aplicada y el verde de tracción, que no tienen token propio en el tema.

## La cámara se encuadra una sola vez

`SceneCanvas` calcula el encuadre inicial al montar y **no lo recalcula** cuando cambian los datos: reencuadrar en cada tecla movería la vista mientras el usuario edita una tabla de nudos. El botón "Recentrar" recupera el encuadre contra los datos actuales cuando hace falta.

Detalle de implementación que vale recordar porque el lint lo pesca: el encuadre congelado es **estado inicial perezoso** (`useState(() => ...)`), no un `useRef` leído en render — `react-hooks/refs` marca esto último como error, y con razón.

## La orientación tiene que ser explícita

En 2D alcanza con dibujar a escala: se sabe dónde está el arriba. En 3D, después de dos arrastres, no. Por eso la escena dibuja siempre una **terna de ejes etiquetada** (x rojo, y verde, z azul, con etiqueta DOM) y un **piso** en el plano xy a la altura del nudo más bajo. Sin esas dos referencias la figura rotada es ambigua.

Los ejes usan color fijo (la convención universal RGB↔XYZ), no tokens de tema: acá el color *es* la información.

## Los glifos

- **Nudos**: esferas de radio `unitSize·0.45`, con el nombre como etiqueta DOM (`<Html>` de drei) en vez de texto 3D. Es texto real del navegador: hereda la tipografía y los tokens del resto de la app, y evita cargar una fuente para three.js (lo que hacía el original con `Text3D` y una fuente `.json`).
- **Barras**: `<Line>` de drei (no `<line>` nativo, cuyo grosor no es confiable entre plataformas). En la deformada, la forma original va punteada y tenue, y la desplazada sólida y coloreada.
- **Apoyos** (`support-glyph-3d.tsx`): dos notaciones, por la misma razón que en 2D hay tres — el dibujo tiene que decir **qué** está impedido. Los 3 DOF restringidos se dibujan como cono con el vértice en el nudo (la articulación espacial completa); una restricción parcial, como un manguito corto sobre cada eje impedido. Dibujar el cono en un nudo que solo tiene z impedido diría que los tres desplazamientos están tomados, que es falso — y en armaduras espaciales el apoyo parcial es común, no una rareza.
- **Fuerzas** (`force-arrow-3d.tsx`): vástago cilíndrico + punta cónica sobre el eje, sentido según el signo, con el valor como etiqueta DOM. Como en 2D, `value === 0` no se dibuja, y el color distingue carga aplicada (azul) de reacción (token `--warning`).

Todos los glifos van sobre un eje coordenado, así que `orientation.ts` resuelve la rotación con una tabla fija por eje y sentido en vez de armar un quaternion cada vez (las geometrías de cilindro y cono de three.js nacen apuntando a +y local).

## El montaje: la escena no se renderiza en el servidor

Los adaptadores cargan la escena con `next/dynamic` y `ssr: false` — permitido porque el adaptador ya es un Client Component (ver `node_modules/next/dist/docs/01-app/02-guides/lazy-loading.md`). La escena arranca WebGL al montarse y no tiene nada que hacer en el render del servidor; mientras carga se muestra un placeholder del mismo alto, para que la página no salte.

## Fuera de alcance de este patrón (a propósito)

- **Modo oscuro visto de verdad**: los colores se leen de los tokens, así que debería seguir al tema, pero el repo todavía no monta un switch de tema, así que no se pudo comprobar.
- **Verificación visual**: la escena **no se miró nunca en un navegador** — la extensión de Chrome no estaba conectada. Qué sí se comprobó y qué no está detallado en ["Estado de verificación"](./refactor-roadmap.md#5-estado-de-verificación-lo-que-está-probado-y-lo-que-no) del roadmap. Es lo primero a revisar en la próxima sesión que tenga navegador.
- Interactividad (click sobre una barra para resaltarla en las tablas), exportar la vista como imagen, y vistas ortográficas predefinidas (planta/elevación) — no se pidieron.
