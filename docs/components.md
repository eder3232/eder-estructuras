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

Este proyecto tiene muchos inputs numéricos (parámetros de análisis estructural) y `<input type="number">` controlado con `useState` es conocido por dar problemas en React (cursor que salta, valores intermedios inválidos, etc.). Investigando el proyecto anterior (`thesis-structures`) se identificaron dos necesidades distintas, no una sola, así que hay dos componentes:

#### `custom/number-input.tsx` — input numérico simple

Envuelve el `number-field` de [Base UI](https://base-ui.com/) (`@base-ui/react`). Da stepper (botones +/-), flechas de teclado, scrub con el mouse y accesibilidad correcta. **No evalúa expresiones matemáticas** — solo acepta números.

Usar aquí cuando el campo es un valor numérico simple (ej. un parámetro de configuración, un conteo) sin necesidad de que el usuario escriba una fórmula.

#### `custom/formula-input.tsx` — input tipo Excel (valor o fórmula)

En el proyecto anterior, casi todos los campos numéricos del dominio (coordenadas, cargas, momentos, condiciones especiales — más de 100 usos) usaban un componente casero (`EderInput`) que permitía escribir un valor **o una expresión matemática** (ej. `3.5*2`), evaluada con [mathjs](https://mathjs.org/) al confirmar — como una celda de Excel, donde puedes escribir `5` o `3.5*2` en el mismo campo (sin `=` ni referencias a otras celdas, solo expresiones aritméticas). Ese componente sí se usaba masivamente y la funcionalidad es real, así que se reconstruyó como `custom/formula-input.tsx`, corrigiendo los problemas del original:

- Un solo elemento `<input>` que cambia de representación al enfocar/desenfocar (valor formateado cuando no se edita, texto crudo editable cuando sí), en vez de intercambiar un `<div>` y un `<input>` con un hack de refoco — patrón estándar para "barras de fórmula" (Excel, Google Sheets, editores de celda de librerías de tablas como TanStack Table/AG Grid).
- Enter y blur confirman por el mismo camino (antes divergían entre versiones del componente viejo).
- Escape cancela la edición sin perder el valor anterior.
- Si la expresión no evalúa a un número válido, se muestra un toast de error (`sonner`, ya montado en `layout.tsx`) y se conserva el valor anterior — antes fallaba en silencio (`onChange(NaN)`), que es probablemente el "no se mostraba bien" que se recordaba de memoria.

Usar este componente para cualquier campo numérico del dominio de la app (parámetros de análisis estructural) donde tenga sentido que el usuario pueda escribir una operación en vez de precalcularla.

> Base UI y mathjs pueden cambiar de API entre versiones — revisar `node_modules/@base-ui/react/number-field` y la documentación de mathjs antes de extender estos componentes, no asumir la API de memoria.

## Trampa conocida: `<p>` dentro de `AccordionContent` (y de `Alert`)

Los dos traen esta clase del estilo `radix-sera`:

```
[&_p:not(:last-child)]:mb-4
```

O sea: **todo `<p>` que no sea el último hijo de su contenedor se lleva 16 px de margen inferior**, aunque el `<p>` esté dentro de una fila flex. Eso infla la fila y clava el texto arriba, y el control que vaya al lado queda visualmente colgado hacia abajo. Cuesta de diagnosticar porque el margen no se ve: lo que se ve es un control desalineado, y el `items-center` de la fila parece no funcionar.

Pasó de verdad al agregar el selector de decimales al lado de cada título de tabla: el `<p>` dejó de ser `:last-child` y todas las filas pasaron de 20 a 36 px.

Regla práctica: **si vas a poner un control al lado de una etiqueta, la etiqueta va en `<span>`, no en `<p>`** — es una etiqueta, no un párrafo. Si de verdad es un párrafo y necesita un hermano al lado, ponele `mb-0` explícito y dejá un comentario diciendo por qué.

## Resumen rápido

| Carpeta      | Origen                        | ¿Se edita a mano? | ¿Se puede sobrescribir con `shadcn add`? |
| ------------ | ------------------------------ | ------------------- | ------------------------------------------ |
| `ui/`        | CLI de shadcn                  | No                  | Sí                                         |
| `ui-custom/` | Fork de un componente de `ui/` | Sí                  | No (se perdería la modificación)          |
| `custom/`    | Propio del proyecto            | Sí                  | No aplica                                  |
