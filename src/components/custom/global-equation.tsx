"use client";

import { useState, type ReactNode } from "react";

import type { AssemblyResult, DofOrderEntry, SolveResult } from "@/lib/engine";
import { DecimalsScope, ScopeDecimalsStepper, useDecimals } from "@/components/custom/decimals-scope";
import { Math, MathBlock } from "@/components/custom/math";
import { EquationTerm, MathOp, MatrixEquation } from "@/components/custom/matrix-equation";
import { heatColor, MatrixTable } from "@/components/custom/matrix-table";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

/**
 * Desde cuántos grados de libertad `K` arranca como mapa. Medido en `/dev`:
 * cada columna de números ocupa ~76 px, así que la ecuación entera pide
 * ~`76·DOF + 270` px, y en pantalla completa a 1920 px entra hasta ~19. Pasado
 * eso ni la pantalla completa la muestra entera, y el mapa sí.
 */
export const HEATMAP_ABOVE_DOFS = 19;

/** Clase de una celda incógnita. Se resuelve en el paso siguiente, no se conoce todavía. */
const UNKNOWN = "bg-primary/15 font-semibold";

/**
 * El cierre del ensamblaje: la ecuación de rigidez del sistema completo, con la
 * matriz recién armada entre los vectores de fuerza y desplazamiento.
 *
 * Lo que agrega sobre el original —que mostraba las tres matrices y ya— es
 * **marcar cuáles de esos números son incógnitas**. Es la pregunta que se
 * responde al particionar, y sin señalarla la ecuación parece ya resuelta. Se
 * ve de un vistazo **por qué hay que partir la matriz**: los conocidos y los
 * incógnitos están intercalados.
 *
 * Genérica desde 2026-10-14 (nació en `/armaduras-2d`). Lo propio de cada
 * sistema entra por props: cómo se rotula un grado de libertad, su carga, y
 * —opcional— qué pasa al poner el mouse sobre `K` y qué va debajo. En
 * armaduras eso es el vínculo matriz ↔ modelo (N4), que necesita un dibujo.
 */
export function GlobalEquation({
  assembly,
  solved,
  labelOf,
  forceOf,
  onCellHover,
  children,
}: {
  assembly: AssemblyResult;
  solved: SolveResult;
  labelOf: (entry: DofOrderEntry) => string;
  /** La carga aplicada en un grado libre. */
  forceOf: (entry: DofOrderEntry) => number;
  onCellHover?: (cell: [number, number] | null) => void;
  /** Lo que va entre la ecuación y las notas, si el sistema tiene algo que agregar. */
  children?: ReactNode;
}) {
  const { dofOrder, globalStiffness } = assembly;
  const labels = dofOrder.map(labelOf);

  // `null` es "lo que convenga al tamaño": el alumno puede elegir, pero si no
  // lo hizo, una armadura que crece hasta no entrar pasa sola al mapa.
  const [chosenHeatmap, setChosenHeatmap] = useState<boolean | null>(null);
  const heatmap = chosenHeatmap ?? dofOrder.length > HEATMAP_ABOVE_DOFS;
  const [hovered, setHovered] = useState<[number, number] | null>(null);

  // En un DOF restringido la fuerza es la reacción (incógnita) y el
  // desplazamiento es el dato prescrito; en uno libre, al revés.
  const forces = dofOrder.map((entry) =>
    entry.restrained ? [solved.reactions.get(entry.nodeId)![entry.localDof]] : [forceOf(entry)],
  );
  const displacements = dofOrder.map((entry) => [solved.displacements.get(entry.nodeId)![entry.localDof]]);
  // Solo los pórticos con cargas en las barras tienen este término: en el
  // resto la ecuación queda como siempre, sin un vector de ceros de adorno.
  const fem = dofOrder.map((entry) => [assembly.fixedEndForces[entry.globalIndex]]);
  const hasFem = fem.some(([value]) => value !== 0);

  return (
    <DecimalsScope id="global-equation">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">
            Con la matriz ya ensamblada, la ecuación de rigidez del sistema es:
          </span>
          <ScopeDecimalsStepper />
          <div className="flex items-center gap-2 text-sm">
            <Switch id="global-heatmap" checked={heatmap} onCheckedChange={setChosenHeatmap} />
            <Label htmlFor="global-heatmap" className="font-normal">
              <Math tex="K" /> como mapa
            </Label>
          </div>
        </div>

        <MathBlock
          tex={
            hasFem
              ? String.raw`\begin{bmatrix} F \end{bmatrix} = \begin{bmatrix} K \end{bmatrix} \cdot \begin{bmatrix} U \end{bmatrix} + \begin{bmatrix} \mathrm{FEM} \end{bmatrix}`
              : String.raw`\begin{bmatrix} F \end{bmatrix} = \begin{bmatrix} K \end{bmatrix} \cdot \begin{bmatrix} U \end{bmatrix}`
          }
        />

        <MatrixEquation
          expand={{ title: "La ecuación de rigidez del sistema" }}
          header={heatmap ? <HeatmapReadout matrix={globalStiffness} labels={labels} cell={hovered} /> : undefined}
        >
          <EquationTerm tex="F">
            <MatrixTable
              matrix={forces}
              rowLabels={labels}
              cellClass={(row) => (dofOrder[row].restrained ? UNKNOWN : undefined)}
            />
          </EquationTerm>
          <MathOp tex="=" />
          <EquationTerm tex="K">
            <MatrixTable
              matrix={globalStiffness}
              labels={labels}
              symmetricHighlight
              heatmap={heatmap}
              onCellHover={(cell) => {
                setHovered(cell);
                onCellHover?.(cell);
              }}
            />
          </EquationTerm>
          <MathOp tex="\cdot" />
          <EquationTerm tex="U">
            <MatrixTable
              matrix={displacements}
              rowLabels={labels}
              cellClass={(row) => (dofOrder[row].restrained ? undefined : UNKNOWN)}
            />
          </EquationTerm>
          {hasFem && (
            <>
              <MathOp tex="+" />
              <EquationTerm tex="\mathrm{FEM}">
                <MatrixTable matrix={fem} rowLabels={labels} />
              </EquationTerm>
            </>
          )}
        </MatrixEquation>

        {children}

        {hasFem && (
          <p className="text-xs text-muted-foreground">
            <Math tex="\mathrm{FEM}" /> son los momentos y fuerzas de empotramiento perfecto de todas las barras, ya
            en ejes globales y sumados en su posición: lo que las barras les harían a los nudos si estos no se
            movieran. Por eso la ecuación de un pórtico con cargas en las barras lleva ese término, y{" "}
            <Math tex="F" /> son solo las cargas puestas en los nudos.
          </p>
        )}

        <p className="text-xs text-muted-foreground">
          Al pasar el mouse se resalta además la celda <span className="font-medium text-foreground">simétrica</span>:{" "}
          <Math tex="k_{ij} = k_{ji}" />. La fuerza que aparece en <Math tex="i" /> cuando <Math tex="j" /> se
          desplaza una unidad es la misma que aparece en <Math tex="j" /> cuando se desplaza <Math tex="i" /> — por
          eso la matriz es simétrica, y no por casualidad.
        </p>

        <p className="text-xs text-muted-foreground">
          Las celdas resaltadas son las <span className="font-medium text-foreground">incógnitas</span>: en un nudo
          restringido se conoce el desplazamiento y falta la reacción; en uno libre, al revés. Como están
          intercaladas, no se puede despejar de una sola vez — de ahí la partición del paso siguiente.
        </p>
      </div>
    </DecimalsScope>
  );
}

/**
 * Lo que el mapa no muestra: el número. Una línea fija encima de la ecuación y
 * no un tooltip, porque un tooltip tapa las celdas vecinas, que son justamente
 * con las que se lo quiere comparar.
 *
 * **Dos renglones fijos**, el valor y la leyenda, y no uno que envuelva: con
 * `flex-wrap` la leyenda cambiaba de renglón según lo largo del valor, y la
 * ecuación entera saltaba al mover el mouse por `K`.
 */
function HeatmapReadout({
  matrix,
  labels,
  cell,
}: {
  matrix: number[][];
  labels: string[];
  cell: [number, number] | null;
}) {
  const decimals = useDecimals();
  return (
    // `div` y no `p`: el panel le pone ancho máximo a los párrafos.
    <div className="flex flex-col gap-1 text-sm">
      <span className="min-h-5">
        {cell ? (
          <span className="whitespace-nowrap tabular-nums">
            <Math tex="K" />[{labels[cell[0]]}, {labels[cell[1]]}] ={" "}
            <span className="font-semibold">{matrix[cell[0]][cell[1]].toFixed(decimals)}</span>
          </span>
        ) : (
          <span className="text-muted-foreground">Pasá el mouse por una celda de K para ver su valor.</span>
        )}
      </span>
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <span className="size-3 border" style={{ backgroundColor: heatColor(1, 1) }} /> positivo
        <span className="ml-2 size-3 border" style={{ backgroundColor: heatColor(-1, 1) }} /> negativo
        <span className="ml-2 size-3 border" /> cero · más intenso, más grande
      </span>
    </div>
  );
}
