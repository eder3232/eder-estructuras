"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

/**
 * Qué partes del modelo están señaladas ahora mismo.
 *
 * Es lo que comparten dos features que preguntan lo mismo desde lados
 * distintos: **N4** (pasar el mouse por una celda de `K` y ver qué barras
 * aportan ahí) y **N3** (pasar el mouse por una fila y ver el nudo o la barra
 * en el dibujo).
 */
export interface ModelHighlight {
  nodeIds: string[];
  elementIds: string[];
}

/**
 * **Por qué un contexto y no un átomo**, que era la decisión abierta de N4.
 *
 * El resaltado es **estado efímero de vista**, no del modelo: nace y muere con
 * el mouse. La regla del repo es que los átomos guardan datos planos del
 * modelo —es lo que hace que N1 pueda serializarlos sin inventar nada— y meter
 * ahí algo que cambia sesenta veces por segundo la ensucia justo antes de que
 * N1 la necesite intacta.
 *
 * Además ya hay precedente para las dos formas y no se contradicen: la cascada
 * de decimales vive en un átomo **porque el usuario la configura y espera que
 * dure** (y el acordeón desmonta las tablas al cerrarse), mientras que la
 * escala de los diagramas y el resaltado de la celda simétrica son contextos y
 * estado local, porque son de presentación.
 *
 * El valor por defecto es inerte, así que un componente que lo lea sin
 * proveedor —los otros tres sistemas, o un test— funciona igual sin resaltar
 * nada.
 */
const HighlightContext = createContext<{
  highlight: ModelHighlight | null;
  setHighlight: (highlight: ModelHighlight | null) => void;
}>({ highlight: null, setHighlight: () => {} });

export function HighlightProvider({ children }: { children: ReactNode }) {
  const [highlight, setHighlight] = useState<ModelHighlight | null>(null);
  const value = useMemo(() => ({ highlight, setHighlight }), [highlight]);

  return <HighlightContext.Provider value={value}>{children}</HighlightContext.Provider>;
}

/** Lo señalado ahora, o `null` si no hay nada. */
export function useHighlight(): ModelHighlight | null {
  return useContext(HighlightContext).highlight;
}

/** Para señalar desde donde se pasa el mouse. */
export function useSetHighlight(): (highlight: ModelHighlight | null) => void {
  return useContext(HighlightContext).setHighlight;
}

/** Lo que una fila de tabla *es*, para poder encenderla y encenderse. */
export interface HighlightTarget {
  kind: "node" | "element";
  id: string;
  /** Solo las barras: los dos nudos que toca, que se encienden con ella. */
  nodeIds?: string[];
}

/**
 * El tinte de una fila señalada.
 *
 * **Repite el `hover:`** para ganarle al de `TableRow`, que en la hoja de
 * estilos va después por ser una variante: sin eso, la fila que tiene el mouse
 * encima se vería distinta de la que se enciende desde el dibujo, y son el
 * mismo estado.
 *
 * **Y lleva dos opacidades, una por tema, porque la misma no vale para los
 * dos** — medido, no estimado. En claro el primario es un verde saturado lejos
 * del blanco y en oscuro es un verde apagado a un paso del fondo, así que la
 * misma mezcla da 105 de distancia RGB de un lado y 29 del otro. Con `/20` y
 * `/50` quedan 70 y 46: los dos del orden de los colores de zona de la
 * partición, que andan entre 61 y 90.
 */
const HIGHLIGHTED_ROW = "bg-primary/20 hover:bg-primary/20 dark:bg-primary/50 dark:hover:bg-primary/50";

/**
 * Las dos mitades de **N3** para las filas de una tabla: encender lo suyo al
 * pasar el mouse, y encenderse cuando lo señala otro —el dibujo, o una celda de
 * `K`—.
 *
 * **Devuelve una fábrica y no los props directamente** porque las filas salen
 * de un `.map()`: un hook por fila sería un hook dentro de un bucle. Así el
 * contexto se lee una vez por tabla.
 *
 * **La invariante que lo hace legible**: una fila se enciende *exactamente*
 * cuando se enciende su dibujo. Por eso la pertenencia se mira contra la
 * identidad propia de la fila —su id, en la lista de su especie— y no contra
 * todo lo que la fila enciende: una barra prende sus dos nudos en las dos
 * partes, y un nudo no prende ninguna barra en ninguna.
 */
export function useHighlightRows(): (target: HighlightTarget) => {
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  className?: string;
  "data-highlighted"?: "";
} {
  const { highlight, setHighlight } = useContext(HighlightContext);

  return (target: HighlightTarget) => {
    const ids = highlight?.[target.kind === "node" ? "nodeIds" : "elementIds"] ?? [];
    const on = ids.includes(target.id);

    return {
      onMouseEnter: () =>
        setHighlight(
          target.kind === "node"
            ? { nodeIds: [target.id], elementIds: [] }
            : { nodeIds: target.nodeIds ?? [], elementIds: [target.id] },
        ),
      onMouseLeave: () => setHighlight(null),
      className: on ? HIGHLIGHTED_ROW : undefined,
      // Asidero de los tests: afirmar sobre el estado y no sobre las clases,
      // que son decisión de estilo y van a cambiar.
      "data-highlighted": on ? ("" as const) : undefined,
    };
  };
}
