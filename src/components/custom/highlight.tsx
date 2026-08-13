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
