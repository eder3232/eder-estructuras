"use client";

import { useAtomValue } from "jotai";

import { cn } from "@/lib/utils";
import { useDecimals } from "./decimals-scope";
import { atomCompactNumbers, formatScaled, scaleExponent, scaleLabel } from "./number-scale";

interface MatrixTableProps {
  matrix: number[][];
  /** Etiquetas compartidas de fila y columna, para matrices cuadradas simétricas (ej. Kff). */
  labels?: string[];
  /** Etiquetas de fila y columna independientes, para bloques no cuadrados (ej. Kfr: filas libres, columnas restringidas). */
  rowLabels?: string[];
  colLabels?: string[];
  /** Posiciones [fila, columna] a resaltar (ej. celdas que cambiaron en este paso). */
  highlight?: [number, number][];
  /**
   * Clase por celda, para cuando el resaltado no es binario sino que distingue
   * zonas — el caso de la partición, donde las cuatro zonas (Kff, Kfr, Krf, Krr)
   * conviven en una misma matriz y hay que poder decir cuál es cuál. `highlight`
   * no alcanza ahí porque solo tiene dos estados.
   */
  cellClass?: (row: number, col: number) => string | undefined;
  /**
   * Deja las etiquetas de fila y columna fijas mientras se scrollea.
   *
   * **Es opcional y por defecto no**, porque depende de con quién comparta el
   * contenedor de scroll. Una matriz sola en el suyo —la global, un bloque de la
   * partición— gana muchísimo: son las que crecen con la cantidad de nudos, y
   * scrollear una de 40×40 sin etiquetas es leer números sin saber de qué grado
   * de libertad son. En cambio, los cuatro operandos de una ecuación comparten
   * **un solo** contenedor, así que ahí cada columna de etiquetas se pegaría al
   * mismo borde izquierdo y se taparían entre sí.
   */
  stickyLabels?: boolean;
  className?: string;
}

export function MatrixTable({
  matrix,
  labels,
  rowLabels,
  colLabels,
  highlight,
  cellClass,
  stickyLabels,
  className,
}: MatrixTableProps) {
  const decimals = useDecimals();
  const compact = useAtomValue(atomCompactNumbers);
  const highlighted = new Set(highlight?.map(([r, c]) => `${r}-${c}`));
  const rows = rowLabels ?? labels;
  const cols = colLabels ?? labels;

  // El factor sale de la matriz entera y no de cada celda: si cada una eligiera
  // el suyo, la columna dejaría de ser comparable de un vistazo, que es para lo
  // que sirve una matriz.
  const exponent = compact ? scaleExponent(matrix.flat()) : 0;
  const factor = scaleLabel(exponent);

  // El fondo es obligatorio en una celda pegajosa: sin él se transparenta lo que
  // pasa por debajo al scrollear. La sombra de la columna es por lo mismo, pero
  // al revés: sin ella se ve el número de la celda que está pasando por debajo
  // con el signo menos cortado a la mitad, y parece un error de render en vez de
  // una columna fijada.
  const stickyRow = stickyLabels && "sticky left-0 z-10 bg-background shadow-[2px_0_3px_-1px_rgba(0,0,0,0.35)]";
  const stickyHead = stickyLabels && "sticky top-0 z-20 bg-background";

  return (
    <table className={cn("border-collapse text-sm", className)}>
      {factor && (
        // `caption-top` la deja arriba de la matriz, pegada a su nombre.
        <caption className="caption-top pb-0.5 text-right text-xs text-muted-foreground tabular-nums">
          {factor}
        </caption>
      )}
      {cols && (
        <thead>
          <tr>
            <th className={cn("w-8", stickyHead, stickyLabels && "left-0 z-30")} />
            {cols.map((label, i) => (
              <th
                key={i}
                className={cn(
                  "border px-2 py-1 text-center font-medium text-muted-foreground",
                  stickyHead,
                )}
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
      )}
      <tbody>
        {matrix.map((row, i) => (
          <tr key={i}>
            {rows && (
              <th
                className={cn(
                  "border px-2 py-1 text-center font-medium text-muted-foreground",
                  stickyRow,
                )}
              >
                {rows[i]}
              </th>
            )}
            {row.map((value, j) => (
              <td
                key={j}
                className={cn(
                  "border px-2 py-1 text-right tabular-nums",
                  highlighted.has(`${i}-${j}`) && "bg-primary/15 font-semibold",
                  cellClass?.(i, j),
                )}
              >
                {formatScaled(value, decimals, exponent)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
