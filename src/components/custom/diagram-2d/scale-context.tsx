"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useAtomValue } from "jotai";

import { atomCompactNumbers, formatScaled, scaleExponent, scaleLabel } from "@/components/custom/number-scale";

interface DiagramScale {
  /** Exponente común de todos los números del diagrama, o 0 si no hace falta. */
  exponent: number;
  /** `×10³`, o `null` cuando no hay factor. Va en la leyenda, una sola vez. */
  factor: string | null;
  format: (value: number, decimals: number) => string;
}

const NO_SCALE: DiagramScale = {
  exponent: 0,
  factor: null,
  format: (value, decimals) => value.toFixed(decimals),
};

const ScaleContext = createContext<DiagramScale>(NO_SCALE);

/**
 * Un factor común para **todos** los números de un diagrama, con el mismo
 * criterio que las matrices (`number-scale.ts`).
 *
 * Existe por un problema que se vio en captura: el explorador de columnas de
 * `K` afirma que las flechas *son* la columna de la matriz, y la matriz de al
 * lado mostraba `8.1067 ×10³` mientras la flecha decía `8106.6667`. Con dos
 * formatos distintos, la afirmación hay que creerla en vez de verla.
 *
 * El factor sale del diagrama entero y no de cada etiqueta, por la misma razón
 * que en una matriz: dos flechas del mismo dibujo tienen que ser comparables de
 * un vistazo. En un diagrama con números normales (una reacción de 12 kN) no se
 * aplica ninguno y todo queda como estaba.
 */
export function DiagramScaleProvider({ values, children }: { values: number[]; children: ReactNode }) {
  const compact = useAtomValue(atomCompactNumbers);
  const exponent = compact ? scaleExponent(values) : 0;

  const scale: DiagramScale =
    exponent === 0
      ? NO_SCALE
      : {
          exponent,
          factor: scaleLabel(exponent),
          format: (value, decimals) => formatScaled(value, decimals, exponent),
        };

  return <ScaleContext.Provider value={scale}>{children}</ScaleContext.Provider>;
}

/** Fuera de un provider devuelve el formato de siempre, así que nada se rompe. */
export function useDiagramScale(): DiagramScale {
  return useContext(ScaleContext);
}
