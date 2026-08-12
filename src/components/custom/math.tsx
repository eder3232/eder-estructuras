import katex from "katex";

import { cn } from "@/lib/utils";

/**
 * Fórmulas en KaTeX. Wrapper propio y no `react-katex`: ese paquete está sin
 * mantener y arrastra peer deps de React 18, y todo lo que agrega sobre
 * `renderToString` son estas veinte líneas.
 *
 * El CSS (`katex/dist/katex.min.css`) se importa una sola vez en
 * `src/app/layout.tsx`. Si falta, esto **no falla**: el HTML sale correcto y en
 * pantalla se ve tipografía del sistema con los símbolos apilados mal. O sea que
 * es un bug que solo se detecta mirando la página, nunca leyendo el DOM.
 */

/**
 * `renderToString` es determinista y no toca el DOM, así que el resultado se
 * puede cachear entre renders. Importa más de lo que parece: la misma fórmula
 * simbólica se repite por barra y por paso de ensamblaje, y en una armadura de
 * 6 barras eso ya son decenas de llamadas idénticas por render.
 */
const cache = new Map<string, string>();

function render(tex: string, displayMode: boolean): string {
  const key = `${displayMode ? "d" : "i"}:${tex}`;
  const cached = cache.get(key);
  if (cached !== undefined) return cached;

  // `throwOnError: false` es obligatorio acá: una `ParseError` tirada durante el
  // render dejaría en blanco todo el panel de resultados por un símbolo mal
  // escrito. Así, la fórmula que falla se muestra en rojo y el resto sigue.
  //
  // `trust` queda en su default (`false`), que deshabilita `\href` y `\htmlData`
  // — los únicos comandos con los que un nombre de barra escrito por el usuario
  // podría inyectar HTML. Ver `texText` abajo.
  const html = katex.renderToString(tex, { displayMode, throwOnError: false });
  cache.set(key, html);
  return html;
}

/**
 * `normal-case` no es decorativo: KaTeX emite los símbolos como texto, así que
 * cualquier `text-transform` heredado los reescribe. Pasó de verdad — los
 * `TableHead` del tema van en `uppercase`, y una fórmula con `\delta` adentro de
 * un encabezado se veía **Δ** mientras la fórmula de arriba decía **δ**: dos
 * símbolos distintos para la misma cantidad, que es justo lo que no puede pasar
 * en una app que explica un método.
 */
const IMMUNE = "normal-case";

/** Fórmula en línea, dentro de un párrafo o al lado de una etiqueta. */
export function Math({ tex, className }: { tex: string; className?: string }) {
  return (
    <span className={cn(IMMUNE, className)} dangerouslySetInnerHTML={{ __html: render(tex, false) }} />
  );
}

/**
 * Fórmula en bloque, centrada y en su propio renglón. Scrollea sola: una
 * ecuación matricial larga no debe ensanchar la página.
 */
export function MathBlock({ tex, className }: { tex: string; className?: string }) {
  return (
    <div
      className={cn(IMMUNE, "max-w-full overflow-x-auto py-1", className)}
      dangerouslySetInnerHTML={{ __html: render(tex, true) }}
    />
  );
}

const TEX_SPECIAL = /[\\{}$&#^_%~]/g;

/**
 * Escapa un texto del usuario para interpolarlo en una fórmula. Los nombres de
 * nudo y de barra son editables, así que un `_` o una `{` sueltos romperían el
 * parseo de la fórmula entera (se vería en rojo, no explotaría — ver `render`).
 *
 * Devuelve el texto ya envuelto en `\text{}`, que además lo saca de la cursiva
 * matemática: `\text{e1}` se lee como un nombre, `e1` como una variable por otra.
 */
export function texText(value: string): string {
  return `\\text{${value.replace(TEX_SPECIAL, (char) => `\\${char}`)}}`;
}
