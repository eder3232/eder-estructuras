"use client";

import { useAtom } from "jotai";

import { cn } from "@/lib/utils";
import { atomDecimals } from "./decimals";

interface MatrixTableProps {
  matrix: number[][];
  /** Etiquetas compartidas de fila y columna, para matrices cuadradas simétricas (ej. Kff). */
  labels?: string[];
  /** Etiquetas de fila y columna independientes, para bloques no cuadrados (ej. Kfr: filas libres, columnas restringidas). */
  rowLabels?: string[];
  colLabels?: string[];
  /** Posiciones [fila, columna] a resaltar (ej. celdas que cambiaron en este paso). */
  highlight?: [number, number][];
  className?: string;
}

export function MatrixTable({ matrix, labels, rowLabels, colLabels, highlight, className }: MatrixTableProps) {
  const [decimals] = useAtom(atomDecimals);
  const highlighted = new Set(highlight?.map(([r, c]) => `${r}-${c}`));
  const rows = rowLabels ?? labels;
  const cols = colLabels ?? labels;

  return (
    <table className={cn("border-collapse text-sm", className)}>
      {cols && (
        <thead>
          <tr>
            <th className="w-8" />
            {cols.map((label, i) => (
              <th key={i} className="border px-2 py-1 text-center font-medium text-muted-foreground">
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
              <th className="border px-2 py-1 text-center font-medium text-muted-foreground">{rows[i]}</th>
            )}
            {row.map((value, j) => (
              <td
                key={j}
                className={cn(
                  "border px-2 py-1 text-right tabular-nums",
                  highlighted.has(`${i}-${j}`) && "bg-primary/15 font-semibold",
                )}
              >
                {value.toFixed(decimals)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
