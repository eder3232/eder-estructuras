# Thesis Refactor 2026

Refactor de **thesis-structures**, una aplicación web sobre el **método matricial de rigideces** (análisis estructural) desarrollada originalmente para una tesis. Este repo reconstruye ese proyecto desde cero aplicando mejores prácticas de desarrollo — arquitectura, convenciones y flujo de trabajo — que no existían (o el autor no conocía) en la versión original.

La app original incluye módulos interactivos de análisis estructural (armaduras 2D/3D, pórticos 2D, pórticos 2D con análisis sísmico, resortes) junto con contenido educativo que explica la teoría detrás del método. El objetivo de este refactor es conservar y mejorar esa funcionalidad sobre una base técnica más sólida.

## Stack

- **[Next.js 16](https://nextjs.org/)** (App Router) — nota: esta versión de Next.js puede tener cambios respecto a lo que conoces; ver `AGENTS.md` antes de tocar APIs de Next.
- **React 19**
- **TypeScript**
- **Tailwind CSS v4**
- **[shadcn/ui](https://ui.shadcn.com/)** (estilo `radix-sera`, base color `neutral`) — componentes en `src/components/ui`
- **pnpm** como package manager (`pnpm@10.15.1`)

## Primeros pasos

Requiere Node.js y pnpm instalados.

```bash
pnpm install
pnpm dev
```

Abre [http://localhost:3000](http://localhost:3000) para ver el resultado. La app se recarga automáticamente al editar archivos dentro de `src/app`.

### Scripts disponibles

| Comando       | Descripción                          |
| ------------- | ------------------------------------- |
| `pnpm dev`    | Levanta el servidor de desarrollo     |
| `pnpm build`  | Compila la app para producción        |
| `pnpm start`  | Sirve la build de producción          |
| `pnpm lint`   | Corre ESLint sobre el proyecto        |

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

Más guías (arquitectura, convenciones de código, etc.) se irán agregando en `docs/` a medida que el proyecto lo requiera.

## Estado del proyecto

En desarrollo activo, fase pre-`v1.0.0`. Ver [`docs/git-workflow.md`](./docs/git-workflow.md) para las reglas de contribución vigentes en esta fase.
