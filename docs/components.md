# Convención de componentes

Este documento define cómo se organizan los componentes en `src/components`, para siempre saber qué es shadcn sin tocar, qué es shadcn modificado, y qué es propio del proyecto.

## Motivación

En el proyecto anterior se modificaron componentes directamente dentro de la carpeta de shadcn cuando alguno daba errores o no renderizaba bien. Con el tiempo se perdió el registro de cuáles se habían tocado y cuáles seguían siendo los originales del CLI. Esta convención existe para que eso no vuelva a pasar.

## Las tres carpetas

```
src/components/
  ui/          # shadcn puro, tal cual lo genera el CLI
  ui-custom/   # forks de componentes de shadcn que hubo que modificar
  custom/      # componentes propios, no derivados de shadcn
```

### `ui/` — intocable

Todo lo que vive aquí viene directo de `shadcn add` (o de la instalación inicial) y **nunca se edita a mano**. Si en el futuro se corre `shadcn add` de nuevo o se hace `shadcn diff`, esta carpeta se puede sobrescribir sin miedo a perder cambios propios, porque no debería tener ninguno.

Si un componente de `ui/` da problemas (errores, mal renderizado, comportamiento raro), la solución **no es editarlo aquí** — es copiarlo a `ui-custom/` y modificar la copia.

### `ui-custom/` — forks de shadcn

Cuando un componente de `ui/` necesita una modificación real (no solo estilos vía `className` o props), se copia a `ui-custom/` con el **mismo nombre de archivo** que tiene en `ui/`. Por ejemplo:

```
ui/select.tsx        <- original de shadcn, sin tocar
ui-custom/select.tsx <- fork modificado, se usa en su lugar
```

El mismo nombre de archivo entre ambas carpetas deja el par obvio con solo mirar el árbol de archivos. Cada archivo en `ui-custom/` debe empezar con un comentario corto explicando **por qué** se forkeó (qué bug o problema resolvía), para que quede registro de si vale la pena resincronizar con la versión de shadcn más adelante.

**No hay re-exportación ni alias automático** entre `ui/` y `ui-custom/`. El import en cada archivo que consume el componente indica explícitamente cuál versión se está usando:

```tsx
import { Select } from "@/components/ui/select";        // versión original
import { Select } from "@/components/ui-custom/select"; // versión modificada
```

Esto es intencional: preferimos que sea visible en cada import, no oculto detrás de un alias.

### `custom/` — componentes propios

Todo componente que no es un fork de shadcn vive aquí, sin importar de qué tipo sea (inputs, cards, layouts, lo que se necesite). No se agrupa de antemano por categoría porque no sabemos qué va a hacer falta — si con el tiempo se acumulan suficientes componentes relacionados, se organizan en subcarpetas dentro de `custom/` en ese momento.

Ejemplo actual: `custom/number-input.tsx`, que envuelve el `number-field` de [Base UI](https://base-ui.com/) (`@base-ui/react`). Este proyecto tiene muchos inputs numéricos (parámetros de análisis estructural) y `<input type="number">` controlado con `useState` es conocido por dar problemas en React (cursor que salta, valores intermedios inválidos, etc.). El componente de Base UI resuelve esto, así que **siempre que se necesite un input numérico en el proyecto, se usa `custom/number-input.tsx` en vez de un `<input type="number">` nativo o el `input.tsx` de shadcn**.

> Antes de implementar `custom/number-input.tsx`, revisar la API actual de `node_modules/@base-ui/react/number-field` — esta es una librería que puede tener cambios entre versiones, no asumir la API de memoria.

## Resumen rápido

| Carpeta      | Origen                        | ¿Se edita a mano? | ¿Se puede sobrescribir con `shadcn add`? |
| ------------ | ------------------------------ | ------------------- | ------------------------------------------ |
| `ui/`        | CLI de shadcn                  | No                  | Sí                                         |
| `ui-custom/` | Fork de un componente de `ui/` | Sí                  | No (se perdería la modificación)          |
| `custom/`    | Propio del proyecto            | Sí                  | No aplica                                  |
