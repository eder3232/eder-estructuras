"use client";

import { useState } from "react";
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
  /**
   * Al pasar el mouse por una celda, resalta también su simétrica.
   *
   * `k_ij = k_ji` es la propiedad que **siempre se enuncia y nunca se muestra**:
   * la fuerza que aparece en *i* cuando *j* se desplaza una unidad es la misma
   * que aparece en *j* cuando se desplaza *i*. Solo tiene sentido en las
   * matrices cuadradas y simétricas (la global, `Kff`, `Krr`); en `Kfr` o `Krf`
   * la celda espejada ni siquiera existe.
   *
   * El estado es local a propósito: dónde vive el resaltado transversal
   * (tabla ↔ diagrama, matriz ↔ modelo) es una decisión abierta, y esto no la
   * necesita ni la condiciona.
   */
  symmetricHighlight?: boolean;
  /**
   * Avisa qué celda tiene el mouse encima, o `null` al salir.
   *
   * Es el gancho de N4: quien lo use decide qué significa esa celda —qué barras
   * aportan ahí— y qué se resalta afuera. La tabla no lo sabe ni tiene por qué:
   * solo dice dónde está el mouse.
   */
  onCellHover?: (cell: [number, number] | null) => void;
  /**
   * Dibuja la matriz como **mapa de celdas** (D13): sin números, cada celda
   * coloreada por su signo y su magnitud. El número se lee al pasar el mouse,
   * con `onCellHover`.
   *
   * Es para la matriz que ya no entra ni en pantalla completa (desde ~19 grados
   * de libertad a 1920 px): ahí una tabla de números es un muro que nadie lee, y
   * lo que sí se puede leer es la **forma** — qué celdas no son cero (los pares
   * de nudos que una barra conecta), la banda alrededor de la diagonal, y que
   * la diagonal manda. Las filas conservan el alto de la tabla de números, para
   * que `F`, `K` y `U` sigan alineadas renglón a renglón.
   */
  heatmap?: boolean;
  className?: string;
}

/**
 * Los dos colores del mapa: azul el positivo, rojo el negativo. Divergentes y
 * no del verde de la marca, que en las tablas ya significa "resaltado".
 */
const HEAT_POSITIVE = "oklch(0.62 0.17 250)";
const HEAT_NEGATIVE = "oklch(0.63 0.21 30)";

/**
 * Color de una celda del mapa. El piso de 15% es para que el valor más chico
 * que no sea cero **se distinga del cero**: la diferencia entre "poco" y "nada"
 * es la que enseña el mapa (un cero es un par de nudos sin barra).
 */
export function heatColor(value: number, maxAbs: number): string | undefined {
  if (maxAbs === 0 || globalThis.Math.abs(value) <= maxAbs * 1e-9) return undefined;
  const share = 15 + 85 * (globalThis.Math.abs(value) / maxAbs);
  return `color-mix(in oklch, ${value > 0 ? HEAT_POSITIVE : HEAT_NEGATIVE} ${share.toFixed(1)}%, transparent)`;
}

export function MatrixTable({
  matrix,
  labels,
  rowLabels,
  colLabels,
  highlight,
  cellClass,
  stickyLabels,
  symmetricHighlight,
  onCellHover,
  heatmap,
  className,
}: MatrixTableProps) {
  const decimals = useDecimals();
  const [hovered, setHovered] = useState<[number, number] | null>(null);
  const compact = useAtomValue(atomCompactNumbers);
  const highlighted = new Set(highlight?.map(([r, c]) => `${r}-${c}`));
  const rows = rowLabels ?? labels;
  const cols = colLabels ?? labels;

  // El factor sale de la matriz entera y no de cada celda: si cada una eligiera
  // el suyo, la columna dejaría de ser comparable de un vistazo, que es para lo
  // que sirve una matriz.
  const exponent = compact && !heatmap ? scaleExponent(matrix.flat()) : 0;
  const maxAbs = heatmap ? globalThis.Math.max(0, ...matrix.flat().map((v) => globalThis.Math.abs(v))) : 0;
  const factor = scaleLabel(exponent);

  const isReciprocal = (row: number, col: number) =>
    hovered !== null && ((row === hovered[0] && col === hovered[1]) || (row === hovered[1] && col === hovered[0]));

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
                  heatmap && "px-1 text-xs",
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
                onMouseEnter={
                  symmetricHighlight || onCellHover
                    ? () => {
                        if (symmetricHighlight) setHovered([i, j]);
                        onCellHover?.([i, j]);
                      }
                    : undefined
                }
                onMouseLeave={
                  symmetricHighlight || onCellHover
                    ? () => {
                        if (symmetricHighlight) setHovered(null);
                        onCellHover?.(null);
                      }
                    : undefined
                }
                className={cn(
                  "border px-2 py-1 text-right tabular-nums",
                  highlighted.has(`${i}-${j}`) && "bg-primary/15 font-semibold",
                  cellClass?.(i, j),
                  // Relleno **sólido**, no una transparencia. Va después de
                  // `cellClass` para ganarle al color de zona de la partición,
                  // pero con alpha no alcanzaba: medido sobre una captura, un
                  // `bg-primary/40` encima de la zona esmeralda quedaba a 8/255
                  // de la zona sin resaltar. A simple vista eran el mismo verde.
                  isReciprocal(i, j) && !heatmap && "bg-primary font-semibold text-primary-foreground",
                  // En el mapa el relleno es el dato, así que el resaltado no
                  // lo tapa: lo enmarca.
                  heatmap && "min-w-7 px-0",
                  heatmap && isReciprocal(i, j) && "outline-2 -outline-offset-2 outline-foreground",
                )}
                style={heatmap ? { backgroundColor: heatColor(value, maxAbs) } : undefined}
              >
                {heatmap ? (
                  // Invisible pero presente: le da a la fila el mismo alto que
                  // la de una tabla de números.
                  <span className="invisible">0</span>
                ) : (
                  formatScaled(value, decimals, exponent)
                )}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
