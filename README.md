# Eder Estructuras (thesis-refactor-2026)

Refactor de **thesis-structures** ([`eder3232/thesis-structures`](https://github.com/eder3232/thesis-structures), en https://thesis-structures.vercel.app), una aplicación web sobre el **método matricial de rigideces** (análisis estructural) desarrollada originalmente para una tesis. Este repo reconstruye ese proyecto desde cero con mejores prácticas —arquitectura, convenciones, tests y flujo de trabajo— y conserva y mejora su funcionalidad: módulos interactivos de análisis (resortes, armaduras 2D/3D, pórticos 2D y pórticos con análisis sísmico según la norma peruana E.030) que muestran el método paso a paso, con contenido educativo.

## Empezá acá

| Si querés… | Leé |
|---|---|
| **retomar el trabajo en frío** (qué está hecho, qué falta, qué no está verificado) | [`docs/estado-actual.md`](./docs/estado-actual.md) |
| entender por qué el refactor tiene este orden y qué estaba mal en el original | [`docs/refactor-roadmap.md`](./docs/refactor-roadmap.md) |
| ver qué se hizo y cuándo | [`docs/historial.md`](./docs/historial.md) |
| tocar algo concreto | la tabla [«Qué leer antes de tocar cada cosa»](./docs/estado-actual.md#7-qué-leer-antes-de-tocar-cada-cosa) |

### Estado y próximo paso

> **Al 2026-10-17, los cinco sistemas están cerrados para la v1**: `/springs`, `/armaduras-2d`, `/armaduras-3d`, `/frame2d` y `/frame2d-seismic` (este último, como extensión de `/frame2d` y no como copia: casos de carga, el cortante basal E.030, el diafragma rígido, la rigidez lateral por condensación, las derivas, las combinaciones E.060 y la envolvente).
>
> **En producción en https://tesis.eder3232.com**: el repo es [`eder3232/eder-estructuras`](https://github.com/eder3232/eder-estructuras) y lo que entra a `main` despliega en el proyecto de Vercel `eder-estructuras`. **`main` está protegida: todo cambio va en una rama con PR** ([`docs/git-workflow.md`](./docs/git-workflow.md)). El original sigue en https://thesis-structures.vercel.app. Detalle en la sección 1 de [`docs/estado-actual.md`](./docs/estado-actual.md); la home se rehízo el 2026-10-17.
>
> **No hay tarea anotada: lo siguiente es preguntarle al usuario qué sigue.**
>
> Al cierre todo pasa: 608 tests, `tsc` limpio, `pnpm build` limpio y `pnpm lint` con solo los 2 errores preexistentes (ver abajo).

### Pendientes

La lista completa, ordenada y con el detalle de cada cosa, está en la **sección 3 de [`docs/estado-actual.md`](./docs/estado-actual.md#3-pendientes-por-hacer)**. En corto:

- **Elegir la próxima fase** (no hay nada empezado): la **Fase 6** —temperatura, defectos de fabricación y apoyos inclinados— o la **Fase 8** —contenido educativo—, que antes pide decidir **S2** (la navegación definitiva) y **N6** (la teoría enlazada desde los sistemas), planteadas en [`docs/pendientes-comparacion.md`](./docs/pendientes-comparacion.md).
- **M2**: validar nombres repetidos de nudos y barras en los cinco sistemas (chico; hoy pasan sin aviso).
- **La v2 de cada sistema**, decidida en cada cierre (por ejemplo, en `/frame2d-seismic`: sismo vertical, alternancia de la carga viva, análisis modal espectral).
- **Deudas abiertas** D9, D12, D15, D16 y D17, y lo que no se pudo verificar (entre otras cosas, que la E.060 2009 no tenga modificaciones posteriores).

## Las páginas

| Ruta | Qué es | Grados de libertad por nudo | Cierre de la v1 |
|---|---|---|---|
| [`/springs`](./src/app/springs) | Resortes en serie/paralelo | 1 | [`docs/springs-v1.md`](./docs/springs-v1.md) |
| [`/armaduras-2d`](./src/app/armaduras-2d) | Armaduras planas (el sistema de referencia: todo se probó acá primero) | 2 | [`docs/armaduras-2d-cierre.md`](./docs/armaduras-2d-cierre.md) |
| [`/armaduras-3d`](./src/app/armaduras-3d) | Armaduras espaciales, escena en three.js | 3 (traslaciones) | [`docs/armaduras-3d-v1.md`](./docs/armaduras-3d-v1.md) |
| [`/frame2d`](./src/app/frame2d) | Pórticos planos con cargas en barras, FEM calculado y diagramas N/V/M | 3 (con giro) | [`docs/frame2d-v1.md`](./docs/frame2d-v1.md) |
| [`/frame2d-seismic`](./src/app/frame2d-seismic) | Pórticos con análisis sísmico: casos de carga, E.030, diafragma rígido, rigidez lateral, derivas, combinaciones E.060 y envolvente | 3, con un desplazamiento lateral por piso | [`docs/frame2d-seismic-v1.md`](./docs/frame2d-seismic-v1.md) |
| [`/estabilidad`](./src/app/estabilidad) | Teoría: por qué `K` es singular sin apoyos, y qué hace un programa de verdad | — | — |

Cada sistema tiene: tablas de datos con fórmulas, clasificación de la estructura, esquema, resultados pedagógicos por acordeón (ensamblaje paso a paso, partición, solución, fuerzas internas, equilibrio), modo práctica, ejemplos precargados, persistencia en el navegador y exportación a Excel con el método vivo. La tabla completa de qué tiene cada uno está en la sección 2 de [`docs/estado-actual.md`](./docs/estado-actual.md).

## Stack

- **[Next.js 16](https://nextjs.org/)** (App Router). **Esta versión tiene cambios** respecto de lo conocido: ver `AGENTS.md` y `node_modules/next/dist/docs/` antes de tocar APIs de Next.
- **React 19**, **TypeScript**, **Tailwind CSS v4**
- **[shadcn/ui](https://ui.shadcn.com/)** (estilo `radix-sera`, base color `neutral`), en `src/components/ui`
- **Jotai** para el estado, **mathjs** para las fórmulas de las celdas, **KaTeX** para el álgebra
- **SVG puro** para los sistemas planos ([`docs/diagram-pattern.md`](./docs/diagram-pattern.md)) y **three.js** (`@react-three/fiber`, `drei`) **solo** para la escena 3D ([`docs/diagram-3d-pattern.md`](./docs/diagram-3d-pattern.md))
- **exceljs** para la exportación; **Vitest** (con `happy-dom` y testing-library para componentes) y **HyperFormula** para recalcular los libros en los tests
- **pnpm** (`pnpm@10.15.1`)

## Primeros pasos

Requiere Node.js y pnpm.

```bash
pnpm install
pnpm dev        # http://localhost:3000
```

| Comando            | Descripción                                    |
| ------------------ | ---------------------------------------------- |
| `pnpm dev`         | Servidor de desarrollo                         |
| `pnpm build`       | Compila para producción (con el servidor de desarrollo **apagado**) |
| `pnpm start`       | Sirve la build de producción                   |
| `pnpm test`        | Tests de motor, stores y componentes (Vitest)  |
| `pnpm lint`        | ESLint                                         |
| `npx tsc --noEmit` | Chequea tipos                                  |

> **Ojo con `pnpm lint`**: reporta **2 errores preexistentes** en archivos de shadcn/ui (`src/components/ui/carousel.tsx` y `src/hooks/use-mobile.ts`, ambos `react-hooks/set-state-in-effect`). No son regresiones y no se corrigen: `ui/` es intocable por convención ([`docs/components.md`](./docs/components.md)). Si aparece un tercero, ese sí es nuevo.

Cómo verificar más allá de los tests (mirar la app con el MCP `chrome-devtools`, abrir el Excel de verdad por COM): sección 6 de [`docs/estado-actual.md`](./docs/estado-actual.md).

## Estructura del proyecto

```
src/
  app/
    <sistema>/            # springs, armaduras-2d, armaduras-3d, frame2d, frame2d-seismic
      page.tsx
      store/              # átomos de Jotai (datos planos), resultados derivados, ejemplos, persistencia
      components/         # tablas, esquema y panel de resultados del sistema
    estabilidad/          # página de teoría
  components/
    ui/                   # shadcn/ui puro, sin modificar
    ui-custom/            # forks de shadcn/ui modificados
    custom/               # componentes propios compartidos (matrices, ecuaciones, decimales, quiz…)
      diagram-2d/         # esquema, deformada y diagramas N/V/M en SVG
      diagram-3d/         # escena three.js
  lib/
    engine/               # motor puro: Node/Element/System, un elemento por sistema
                          # (springs, trusses-2d, trusses-3d, frame2d con cargas en barras),
                          # equilibrio, clasificación, mecanismos, factorización;
                          # seismic/: E.030, condensación, derivas, combinaciones
    excel/                # armado de los libros .xlsx con fórmulas vivas
  hooks/
docs/                     # ver abajo
```

La regla que sostiene todo: **el motor es puro y es la única fuente de verdad**; los stores guardan datos planos (nunca instancias del motor) y derivan los resultados. Está en [`docs/state-pattern.md`](./docs/state-pattern.md).

## Documentación

**Estado e historia**
- [`docs/estado-actual.md`](./docs/estado-actual.md) — **el estado accionable**: qué tiene cada sistema, qué falta para la v1, qué quedó para la v2, deudas abiertas, cómo verificar, qué leer antes de tocar cada cosa y los últimos commits.
- [`docs/historial.md`](./docs/historial.md) — los avances en orden, desde el Tren 0 hasta el cierre de `/frame2d`.
- [`docs/refactor-roadmap.md`](./docs/refactor-roadmap.md) — diagnóstico del proyecto original, las fases y trenes del refactor, la tabla de deudas numeradas y la historia de decisiones hasta el 2026-08-14.
- [`docs/pendientes-comparacion.md`](./docs/pendientes-comparacion.md) — lo que la comparación con el original dejó abierto (navegación definitiva —S2—, contenido teórico enlazado —N6—, unidades…) con su decisión pendiente, y los **falsos rescates**: lo que v1 aparentaba tener y no calculaba. S2 y N6 conviene decidirlos antes de la Fase 8.

**Cierre de cada sistema** (la revisión, las decisiones del usuario y el avance paso por paso, con lo que encontró mirar la app)
- [`docs/armaduras-2d-cierre.md`](./docs/armaduras-2d-cierre.md) — los 22 puntos que cerraron `/armaduras-2d`: **el porqué de cada función** que después se propagó a los otros sistemas. Su antecedente es [`docs/armaduras-2d-plan.md`](./docs/armaduras-2d-plan.md) (recuperar la narrativa pedagógica que el port había perdido).
- [`docs/springs-v1.md`](./docs/springs-v1.md) — `/springs`.
- [`docs/armaduras-3d-v1.md`](./docs/armaduras-3d-v1.md) — `/armaduras-3d`, con las recetas para capturar WebGL en headless y verificar el Excel por COM.
- [`docs/frame2d-v1.md`](./docs/frame2d-v1.md) — `/frame2d`: las trece fallas del original en cargas y diagramas, **la convención de signos** (Hibbeler/Beer, sección 4), las cargas en barras con su FEM, los diagramas N/V/M y la deformada exactos.
- [`docs/frame2d-seismic-v1.md`](./docs/frame2d-seismic-v1.md) — `/frame2d-seismic`: los bugs del original, **la E.030 2026 y la E.060 leídas en los PDF oficiales** (artículo por artículo, con lo que el pórtico plano no puede representar), el alcance y el plan.

**Patrones y convenciones** (leer antes de tocar esa parte)
- [`docs/state-pattern.md`](./docs/state-pattern.md) — el patrón de estado (Jotai + motor puro) y de resultados pedagógicos; **antes de construir o cerrar un sistema**.
- [`docs/diagram-pattern.md`](./docs/diagram-pattern.md) — esquema y deformada en SVG para sistemas planos, y cómo se dibuja el giro.
- [`docs/diagram-3d-pattern.md`](./docs/diagram-3d-pattern.md) — la escena 3D: por qué es un módulo aparte, la cámara con z hacia arriba, los colores del tema en materiales.
- [`docs/errores.md`](./docs/errores.md) — el contrato de errores y advertencias; **antes de tocar cualquier cosa que produzca o muestre un error**.
- [`docs/excel-export.md`](./docs/excel-export.md) — la exportación a Excel: qué queda editable, cómo se arma desde el ensamblaje del motor, cómo se verifica y las trampas de `exceljs`.
- [`docs/components.md`](./docs/components.md) — `ui/` intocable, forks en `ui-custom/`, propios en `custom/`.
- [`docs/git-workflow.md`](./docs/git-workflow.md) — ramas y PR a `main` (protegida) con preview de Vercel, merge por rebase, Conventional Commits, SemVer.

> **Módulos del motor sin doc propio** (puros y comentados en el archivo): `src/lib/engine/mechanism.ts` (mecanismos, núcleo de la matriz, alternativa de Fredholm), `factorization.ts` (`LDLᵀ`) y `unit-displacement.ts`. Su porqué está en la página [`/estabilidad`](./src/app/estabilidad) y en las entradas del 2026-08-13 de [`docs/armaduras-2d-cierre.md`](./docs/armaduras-2d-cierre.md).

## Flujo de trabajo

En producción desde el 2026-10-17: cada cambio va en una rama (`feat/`, `fix/`, `docs/`…) con un PR a `main`, se mira en el preview de Vercel y entra por rebase; Conventional Commits en español ([`docs/git-workflow.md`](./docs/git-workflow.md)). Hasta esa fecha se commiteó directo a `main`. Cada sistema se cerró con el mismo método: revisar el original y el módulo actual, que el usuario decida el alcance, y avanzar por pasos con un commit por paso, verificando cada uno con tests **y mirando la app**. Al terminar una sesión, el README y [`docs/estado-actual.md`](./docs/estado-actual.md) quedan listos para retomar en frío.
