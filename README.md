# Eder Estructuras (thesis-refactor-2026)

Refactor de **thesis-structures** (`D:\programming\repos_clonados\thesis-structures`), una aplicación web sobre el **método matricial de rigideces** (análisis estructural) desarrollada originalmente para una tesis. Este repo reconstruye ese proyecto desde cero aplicando mejores prácticas de desarrollo — arquitectura, convenciones y flujo de trabajo — que no existían (o el autor no conocía) en la versión original.

El diagnóstico completo del proyecto anterior y el plan de fases del refactor están en [`docs/refactor-roadmap.md`](./docs/refactor-roadmap.md) — **léelo antes de escribir código de dominio o de visualización**, ahí está el porqué del orden de trabajo.

La app original incluye módulos interactivos de análisis estructural (armaduras 2D/3D, pórticos 2D, pórticos 2D con análisis sísmico, resortes) junto con contenido educativo que explica la teoría detrás del método. El objetivo de este refactor es conservar y mejorar esa funcionalidad sobre una base técnica más sólida.

## Stack

- **[Next.js 16](https://nextjs.org/)** (App Router) — nota: esta versión de Next.js puede tener cambios respecto a lo que conoces; ver `AGENTS.md` antes de tocar APIs de Next.
- **React 19**
- **TypeScript**
- **Tailwind CSS v4**
- **[shadcn/ui](https://ui.shadcn.com/)** (estilo `radix-sera`, base color `neutral`) — componentes en `src/components/ui`
- **[three.js](https://threejs.org/)** vía `@react-three/fiber` y `@react-three/drei` — **solo** para la escena 3D de armaduras espaciales; los sistemas planos se dibujan con SVG puro (ver [`docs/diagram-pattern.md`](./docs/diagram-pattern.md))
- **pnpm** como package manager (`pnpm@10.15.1`)

## Primeros pasos

Requiere Node.js y pnpm instalados.

```bash
pnpm install
pnpm dev
```

Abre [http://localhost:3000](http://localhost:3000) para ver el resultado. La app se recarga automáticamente al editar archivos dentro de `src/app`.

### Scripts disponibles

| Comando            | Descripción                                    |
| ------------------ | ---------------------------------------------- |
| `pnpm dev`         | Levanta el servidor de desarrollo              |
| `pnpm build`       | Compila la app para producción                 |
| `pnpm start`       | Sirve la build de producción                   |
| `pnpm test`        | Corre los tests de motor, stores y componentes (Vitest) |
| `pnpm lint`        | Corre ESLint sobre el proyecto                 |
| `npx tsc --noEmit` | Chequea tipos sin compilar                     |

> **Ojo con `pnpm lint`**: hoy reporta **2 errores preexistentes** en archivos de shadcn/ui (`src/components/ui/carousel.tsx` y `src/hooks/use-mobile.ts`, ambos `react-hooks/set-state-in-effect`). No son regresiones y no se corrigen: `ui/` es intocable por convención (ver [`docs/components.md`](./docs/components.md)). Si aparece un tercer error, ese sí es nuevo.

## Estructura del proyecto

```
src/
  app/          # Rutas (App Router)
  components/
    ui/         # shadcn/ui puro, sin modificar
    ui-custom/  # Forks de componentes de shadcn/ui modificados
    custom/     # Componentes propios, no derivados de shadcn
  hooks/
  lib/
```

## Documentación

- [`docs/git-workflow.md`](./docs/git-workflow.md) — directriz de control de versiones: fase actual de commits directos a `main`, Conventional Commits, versionado con SemVer y el cambio de flujo a ramas + PR una vez taggeada `v1.0.0`.
- [`docs/components.md`](./docs/components.md) — convención de organización de componentes: qué queda intocable en `ui/`, cómo forkear a `ui-custom/`, y qué va en `custom/`.
- [`docs/refactor-roadmap.md`](./docs/refactor-roadmap.md) — diagnóstico del proyecto anterior (`thesis-structures`) y el orden de fases/trenes propuesto para el refactor: motor de cálculo unificado, patrón de estado, visualización, y la exportación a Excel con fórmulas vivas.
- [`docs/state-pattern.md`](./docs/state-pattern.md) — **léelo antes de construir la página de un nuevo sistema estructural**: el patrón de estado (Jotai + motor puro) y de resultados pedagógicos que dejaron `/springs`, `/armaduras-2d` y `/frame2d` (1, 2 y 3 DOF por nudo).
- [`docs/diagram-pattern.md`](./docs/diagram-pattern.md) — **léelo antes de tocar visualización de un sistema plano**: el patrón de esquema/forma deformada en SVG puro (sin three.js), con qué es genérico (`src/components/custom/diagram-2d/`) y cómo se resolvió el DOF rotacional (empotramiento, arco de momento, criterio de color) al portarlo a `/frame2d`.
- [`docs/armaduras-2d-plan.md`](./docs/armaduras-2d-plan.md) — plan de una actualización puntual sobre `/armaduras-2d`: recuperar la narrativa pedagógica que el port perdió respecto del original (transformación `A`/`Aᵀ`, ecuación global, la partición mostrada como partición, sustituciones numéricas, KaTeX). Sale de comparar las dos versiones archivo por archivo.
- [`docs/armaduras-2d-cierre.md`](./docs/armaduras-2d-cierre.md) — **la lista de trabajo activa**: cerrar `/armaduras-2d` por completo antes de propagar nada a los otros sistemas. Junta y ordena lo que estaba repartido entre las deudas del roadmap y los grupos U y N de la comparación, con lo que queda explícitamente afuera y cómo verificar cada cosa.
- [`docs/pendientes-comparacion.md`](./docs/pendientes-comparacion.md) — el resto de lo que encontró esa misma comparación y **no** se va a hacer ahora: shell de la app, numeración de DOF por el usuario, unidades, persistencia, vinculación matriz ↔ modelo. Cada punto con su decisión abierta, para que la discusión arranque de donde quedó.
- [`docs/diagram-3d-pattern.md`](./docs/diagram-3d-pattern.md) — el módulo hermano para sistemas espaciales (`src/components/custom/diagram-3d/`, con three.js): por qué es un módulo aparte y no una extensión del de 2D, la cámara con z hacia arriba sin remapear ejes, y cómo se leen los tokens de tema `oklch` para materiales que no aceptan clases de CSS.

Más guías (arquitectura, convenciones de código, etc.) se irán agregando en `docs/` a medida que el proyecto lo requiera.

## Estado del proyecto

En desarrollo activo, fase pre-`v1.0.0` (commits directos a `main`, ver [`docs/git-workflow.md`](./docs/git-workflow.md)).

Progreso respecto a las fases de [`docs/refactor-roadmap.md`](./docs/refactor-roadmap.md):

- [x] **Tren 0** — shadcn/ui instalado con la paleta de este repo, convenciones de git y de componentes documentadas (`docs/git-workflow.md`, `docs/components.md`), `NumberInput` (Base UI) y `FormulaInput` (input estilo Excel con `mathjs`) implementados en `src/components/custom/`.
- [x] **Tren 1** — motor de cálculo genérico (`Node`/`Element`/`System`) en `src/lib/engine/`, validado portando `springs` con tests de Vitest.
- [x] **Tren 2** — armaduras 2D (`TrussElement2D`) portadas al motor sin tocar `System`/`Element`, confirmando que la abstracción generaliza de 1 a 2 DOF/nodo.
- [x] **Tren A (springs)** — patrón dominio↔estado con Jotai (átomos de datos planos, nunca instancias del motor) y página `/springs` de punta a punta: tablas de entrada, panel de errores y resultados pedagógicos por acordeón (DOF↔nudo, ensamblaje paso a paso con leyendas físicas, partición y solución, fuerzas internas).
- [x] **Tren A (armaduras 2D)** — mismo patrón replicado en `/armaduras-2d` (2 DOF/nudo, rigidez axial con transformación geométrica vía `TrussElement2D`). Lo genérico entre ambos sistemas (`matrix-table`, control de decimales, tabla de DOF) se extrajo a `src/components/custom/` para no duplicarlo.
- [x] **Tren B** — capa de visualización 2D en SVG puro (`src/components/custom/diagram-2d/`, sin three.js): esquema no deformado, forma deformada con slider de escala, barras coloreadas por tracción/compresión y reacciones, conectada a `/armaduras-2d`.
- [x] **Tren C (frame2d)** — pórticos planos completos de punta a punta: `FrameElement2D` (rigidez 6×6 axial+flexión, fuerzas internas axial/corte/momento) con regresión portada del ejemplo del proyecto original, página `/frame2d` con el patrón de estado, y visualización con el DOF rotacional resuelto (empotramiento, arco de momento, color por fuerza axial). Incluye momentos de empotramiento perfecto por barra, corrigiendo el bug de transformación del original (ver `docs/refactor-roadmap.md`); falta todavía la UI de tablas de carga que los calcule sola.
- [x] **Tren D (armaduras 3D)** — armaduras espaciales completas de punta a punta: `TrussElement3D` (la misma barra axial del caso plano con un tercer coseno director), página `/armaduras-3d` con el patrón de estado, y visualización real en three.js (rotar con el mouse, apoyos espaciales, forma deformada). Agrega dos cosas que el original no tenía: **fuerzas internas** (que `armor3d` declaraba pero nunca calculaba) y tests del store. Se adelantó a `frame2d-seismic` porque los dos hilos eran independientes.
- [x] **UI de `/armaduras-2d`** (2026-08-10, fuera de los trenes) — arreglo del render de los apoyos en los diagramas 2D (afecta también a `/frame2d`), restauración del botón de insertar una fila en el medio que el port había perdido, y precisión configurable en cascada (página → bloque → tabla) en vez de un único selector global. Pendiente de propagar a los otros tres sistemas.
- [x] **UX de los controles de decimales** (2026-08-12, fuera de los trenes) — los dos problemas que el usuario encontró al mirar la cascada de decimales, ambos arreglados: el desplegable de sección mostraba la frase larga del item (`Automático — igual que la página (4)`) cortada por la mitad dentro de un trigger angosto, y el stepper `− n +` de cada tabla estaba anclado al borde derecho de la tabla, así que subir un decimal la ensanchaba y corría el `+` de abajo del cursor. Las reglas para no reintroducirlos quedaron en [`docs/components.md`](./docs/components.md) y [`docs/state-pattern.md`](./docs/state-pattern.md), que es lo que se copia al propagar.
- [x] **Narrativa pedagógica de `/armaduras-2d`** (2026-08-12, fuera de los trenes) — la comparación con el `armor2d` original mostró que el rework ganó infraestructura y **perdió el andamiaje que explicaba el método**. Recuperado y mejorado: el paso de transformación completo (`K = A · k · Aᵀ` con los tres operandos, no solo el resultado), la ecuación global `F = K·U` **con las incógnitas marcadas**, la partición mostrada como lo que es —la misma matriz reordenada, con las cuatro zonas coloreadas y el corte dibujado, en vez de cuatro tablas sueltas—, las sustituciones numéricas de `Uf` y `Rr`, y KaTeX en todo el álgebra. El plan y lo que apareció al implementarlo están en [`docs/armaduras-2d-plan.md`](./docs/armaduras-2d-plan.md).
- [x] **Shell de la app** (2026-08-12, fuera de los trenes) — la app se llama **Eder Estructuras**, `lang="es"`, nombre y descripción centralizados en `src/lib/site-config.ts`, y **`next-themes` por fin montado**: estaba instalado desde el principio pero nunca se había montado, así que los tokens `.dark` eran código muerto y el modo oscuro no se podía activar en ningún sistema. Incluye una navbar **provisional** (el toggle tenía que vivir en algún lado) y la primera verificación en oscuro que se hizo nunca. Ver [`docs/armaduras-2d-cierre.md`](./docs/armaduras-2d-cierre.md).
- [ ] **Cerrar `/armaduras-2d`** ⬅️ **en curso**: quedan 12 puntos ordenados en [`docs/armaduras-2d-cierre.md`](./docs/armaduras-2d-cierre.md). El primero, el **entorno DOM para tests de componentes**, ya está hecho (2026-08-12): `happy-dom` + testing-library pedidos por archivo con el docblock `// @vitest-environment happy-dom`, sin `setupFiles` para no meter DOM en los tests de motor. Con eso **se ejercitaron los primeros clicks del repo** — el toggle de tema (que se había montado sin poder verificarlo), el stepper de decimales y las tres acciones de la tabla de barras.
- [ ] **Tren C (frame2d-seismic)**: extensión real sobre `frame2d`, no un fork copiado. Ver `docs/refactor-roadmap.md`.
- [ ] Fases 6 a 8 (armaduras plus/frame plus, exportación a Excel, contenido educativo): ver tabla completa en `docs/refactor-roadmap.md`.

Ya existen cuatro páginas funcionales: [`/springs`](./src/app/springs), [`/armaduras-2d`](./src/app/armaduras-2d), [`/frame2d`](./src/app/frame2d) y [`/armaduras-3d`](./src/app/armaduras-3d) — 1, 2, 3 y 3 grados de libertad por nudo (las dos últimas con la misma cantidad pero distinta naturaleza: una rotación vs. tres traslaciones). Juntas confirman el patrón (Jotai + motor puro + resultados pedagógicos por acordeón + visualización) que se replica para el resto de los sistemas.

### Próximo paso

> **Empezá acá si retomás en frío.** El trabajo activo está en **[`docs/armaduras-2d-cierre.md`](./docs/armaduras-2d-cierre.md)**, que es autosuficiente y ya está ordenado. Para el contexto general del proyecto, la sección **["Si estás retomando después de un `/clear`"](./docs/refactor-roadmap.md#si-estás-retomando-después-de-un-clear)** del roadmap. Lo de abajo es el resumen.

**La decisión de orden vigente, tomada el 2026-08-12**: se termina `/armaduras-2d` **por completo** y recién entonces se salta a los otros sistemas. Es la referencia de UI de los cuatro, así que conviene propagar una sola vez contra algo terminado. El costo aceptado a conciencia es que **cada cosa que se agrega ahí agranda el hilo C**.

El **entorno DOM para tests de componentes** —el habilitador, porque casi todo lo que sigue es interacción pura— ya está: hay 13 tests de componente y los primeros clicks del repo pasaron. Se retoma en **D6 + U4**, las etiquetas de las flechas y el valor de N sobre cada barra, que van juntas porque la segunda agrava el problema de la primera.

**Los otros hilos**, que quedan en pausa hasta que esa lista termine:

- **A — `frame2d-seismic`** (cierra el Tren C y deja los 5 sistemas base completos). Va como extensión real sobre `frame2d`, **no un fork copiado** — ese fue el bug diagnosticado en el original.
- **B — tablas de carga que calculen los momentos de empotramiento perfecto**. El mecanismo ya funciona, pero hoy los 6 valores de FEM se cargan a mano por barra; falta la UI que los calcule a partir de la carga (distribuida, puntual, momento, distribuida intermedia).
- **C — propagar a los otros tres sistemas la UI que hoy solo tiene `/armaduras-2d`**: insertar una fila en el medio, la cascada de decimales, y también **la narrativa pedagógica** (D7 + D8 + D11). Era el hilo más corto y **ya no lo es**: la superficie creció de dos funciones a cinco, y va a crecer más al cerrar `/armaduras-2d`. Las dos primeras son cableado casi idéntico; el álgebra no se copia y pega, porque `springs` no tiene transformación y la `A` de `frame2d` es de 6×6. Y **sigue pendiente de que el usuario valide esa UX antes de replicarla**: aprobó los arreglos puntuales que fue encontrando, nunca el conjunto, así que **preguntá antes de propagar**.
- **D — narrativa pedagógica de `/armaduras-2d`**: ✅ hecho el 2026-08-12, ver [`docs/armaduras-2d-plan.md`](./docs/armaduras-2d-plan.md). Se hizo antes que C a propósito, para propagar una sola vez.

> **`/armaduras-2d` ya no es igual a los otros tres.** Su UI va adelante a propósito (se hizo ahí primero para poder mirarla antes de replicarla), y la distancia creció: además de insertar filas y los decimales, ahora tiene todo el álgebra en KaTeX con cuatro pasos que los demás no muestran. Los otros no están rotos, solo les falta la función. Si vas a tocar la UI de un sistema, la referencia es `/armaduras-2d`.

**Deudas chicas** (ninguna bloquea nada, la tabla completa y numerada está en el roadmap): los `element-table.tsx` de las dos armaduras, que eran byte-idénticos y divergieron (D2); la deformada de `frame2d` como recta en vez de cúbica de Hermite (D3); los diagramas de corte y momento sin portar (D4); y el stepper de decimales que todavía puede saltar de renglón si su propio ensanche rewrapea la fila de matrices (D9), que **quedó explícitamente afuera** del cierre de `/armaduras-2d` porque cualquiera de sus dos salidas cambia el layout de todo el panel de resultados.

Tres deudas dejaron de estar en esta lista porque **entraron en la lista activa**: el mensaje de mathjs en inglés cuando `Kff` es singular (D1), las etiquetas de las flechas que se superponen (D6) y la cadena `K = A·k·Aᵀ` que no entra en pantalla (D10).

**Sobre verificación visual**: la extensión de Chrome nunca conectó, pero se encontró cómo mirar la app igual — **Chrome headless por línea de comandos**, con la receta exacta en "Estado de verificación" del roadmap. Con eso ya se revisaron `/armaduras-2d` entera (en los dos temas) y el esquema de `/frame2d`, y aparecieron **seis problemas en tres sesiones** que ninguna verificación numérica hubiera encontrado: tres bugs de render por propiedades de CSS que el markup no deja ver (`vector-effect`, el `mb-4` de `AccordionContent`, el `uppercase` que reescribía los símbolos de KaTeX), dos de UX en los controles de decimales, y un signo doble heredado del proyecto original que nadie había visto nunca. La lección se repitió cada vez, así que conviene tomarla como regla: **mirar la app encuentra cosas que los tests no**. Y una segunda regla que salió del modo oscuro: **sobre una captura hay que medir, no mirar** — a ojo parecía que el bloque `Kff` se perdía contra el fondo, y medir los píxeles lo desmintió. Siguen sin mirarse la deformada de `/frame2d` y la escena 3D de `/armaduras-3d`. Los clicks, en cambio, **ya no son un agujero**: desde el 2026-08-12 el repo tiene entorno DOM (`happy-dom` + testing-library, pedido por archivo con un docblock) y 13 tests de componente que ejercitan el toggle de tema, el stepper de decimales y las acciones de la tabla de barras. Las dos verificaciones son complementarias y ninguna reemplaza a la otra: headless muestra lo que el markup no deja ver, los tests muestran lo que la captura no puede tocar.

### Lo que la comparación dejó pendiente

La comparación del 2026-08-12 entre `/armaduras-2d` y el `armor2d` original encontró más de lo que entró en [`docs/armaduras-2d-plan.md`](./docs/armaduras-2d-plan.md), que se acotó a propósito a un solo sistema y a lo pedagógico. **Todo lo demás está documentado en [`docs/pendientes-comparacion.md`](./docs/pendientes-comparacion.md)**, con la decisión abierta de cada punto — que es lo que no se puede reconstruir mirando el código. Nada de eso está en curso.

Son cuatro grupos, ordenados por a quién alcanzan:

- **S — el shell** (los 4 sistemas): ✅ **hecho el 2026-08-12** en su mayor parte — nombre, idioma y metadata (S1) y `next-themes` montado con el modo oscuro ya verificado (S3). Queda **S2**, la navegación definitiva: hoy hay una navbar provisional, y la decisión de fondo —si los sistemas y el contenido educativo comparten layout— se toma antes de la Fase 8.
- **M — el motor** (los 4 sistemas): que el alumno pueda numerar los grados de libertad a mano —el caso de uso académico de cotejar contra el ejercicio resuelto en papel—, y la validación de nombres duplicados que el original tenía y acá falta.
- **U — usabilidad de `/armaduras-2d`** y **N — lo que ninguna versión tuvo nunca**: los dos grupos **entraron completos en la lista activa** de [`docs/armaduras-2d-cierre.md`](./docs/armaduras-2d-cierre.md), así que ahí está el orden y las decisiones. Van encabezados agrupados, combobox buscable, estado vacío, el valor de N sobre cada barra y unidades; más persistencia, ejemplos precargados, vincular tabla ↔ diagrama y **matriz ↔ modelo**, y verificación de equilibrio.

> **N4 es el de mejor retorno y ya está a un paso**: resaltar en el modelo qué aporta a cada celda de `K` tiene todo lo que necesitaba —las etiquetas nudo+eje, el `cellClass` de `MatrixTable` que agregó el P0, y `assembly.steps`, que ya sabe qué barra tocó qué celdas—, así que es sobre todo cablear un `onMouseEnter`. **S2/N6** (navegación definitiva y contenido teórico enlazado) se condicionan mutuamente: conviene decidirlos antes de arrancar la Fase 8.
