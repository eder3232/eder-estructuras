import type { ReactNode } from "react";

import type { AssemblyResult, DofOrderEntry, SolveResult } from "@/lib/engine";
import { DecimalsScope, ScopeDecimalsStepper } from "@/components/custom/decimals-scope";
import { Math, MathBlock } from "@/components/custom/math";
import { EquationTerm, MathOp, MatrixEquation } from "@/components/custom/matrix-equation";
import { MatrixTable } from "@/components/custom/matrix-table";

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

  // En un DOF restringido la fuerza es la reacción (incógnita) y el
  // desplazamiento es el dato prescrito; en uno libre, al revés.
  const forces = dofOrder.map((entry) =>
    entry.restrained ? [solved.reactions.get(entry.nodeId)![entry.localDof]] : [forceOf(entry)],
  );
  const displacements = dofOrder.map((entry) => [solved.displacements.get(entry.nodeId)![entry.localDof]]);

  return (
    <DecimalsScope id="global-equation">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">
            Con la matriz ya ensamblada, la ecuación de rigidez del sistema es:
          </span>
          <ScopeDecimalsStepper />
        </div>

        <MathBlock tex="\begin{bmatrix} F \end{bmatrix} = \begin{bmatrix} K \end{bmatrix} \cdot \begin{bmatrix} U \end{bmatrix}" />

        <MatrixEquation>
          <EquationTerm tex="F">
            <MatrixTable
              matrix={forces}
              rowLabels={labels}
              cellClass={(row) => (dofOrder[row].restrained ? UNKNOWN : undefined)}
            />
          </EquationTerm>
          <MathOp tex="=" />
          <EquationTerm tex="K">
            <MatrixTable matrix={globalStiffness} labels={labels} symmetricHighlight onCellHover={onCellHover} />
          </EquationTerm>
          <MathOp tex="\cdot" />
          <EquationTerm tex="U">
            <MatrixTable
              matrix={displacements}
              rowLabels={labels}
              cellClass={(row) => (dofOrder[row].restrained ? undefined : UNKNOWN)}
            />
          </EquationTerm>
        </MatrixEquation>

        {children}

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
