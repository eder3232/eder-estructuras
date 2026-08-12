import type { AssemblyResult, SolveResult } from "@/lib/engine";
import { DecimalsScope, ScopeDecimalsStepper } from "@/components/custom/decimals-scope";
import { MathBlock } from "@/components/custom/math";
import { EquationTerm, MathOp, MatrixEquation } from "@/components/custom/matrix-equation";
import { MatrixTable } from "@/components/custom/matrix-table";
import type { NodeRow } from "../../store/nodes";

interface GlobalEquationProps {
  assembly: AssemblyResult;
  solved: SolveResult;
  nodesById: Map<string, NodeRow>;
}

const AXIS_LABEL = ["x", "z"];

/** Clase de una celda incógnita. Se resuelve en el paso siguiente, no se conoce todavía. */
const UNKNOWN = "bg-primary/15 font-semibold";

/**
 * El cierre del ensamblaje: la ecuación de rigidez del sistema completo, con la
 * matriz recién armada entre los vectores de fuerza y desplazamiento.
 *
 * Lo que agrega sobre el original —que mostraba las tres matrices y ya— es
 * **marcar cuáles de esos números son incógnitas**. Es la pregunta que se
 * responde al particionar, y sin señalarla la ecuación parece ya resuelta:
 * están todos los números a la vista, calculados, sin distinguir el dato de lo
 * que se dedujo. La tabla de grados de libertad ya lo dice en palabras; acá se
 * ve de un vistazo, y se ve **por qué hay que partir la matriz**: los conocidos
 * y los incógnitos están intercalados.
 */
export function GlobalEquation({ assembly, solved, nodesById }: GlobalEquationProps) {
  const { dofOrder, globalStiffness } = assembly;

  const labels = dofOrder.map(
    (entry) => `${nodesById.get(entry.nodeId)?.name ?? entry.nodeId}${AXIS_LABEL[entry.localDof]}`,
  );

  // En un DOF restringido la fuerza es la reacción (incógnita) y el
  // desplazamiento es el dato prescrito; en uno libre, al revés.
  const forces = dofOrder.map((entry) => {
    const node = nodesById.get(entry.nodeId)!;
    if (entry.restrained) return [solved.reactions.get(entry.nodeId)![entry.localDof]];
    return [entry.localDof === 0 ? node.forceX : node.forceZ];
  });

  const displacements = dofOrder.map((entry) => [
    solved.displacements.get(entry.nodeId)![entry.localDof],
  ]);

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
            <MatrixTable matrix={globalStiffness} labels={labels} />
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

        <p className="text-xs text-muted-foreground">
          Las celdas resaltadas son las <span className="font-medium text-foreground">incógnitas</span>: en un nudo
          restringido se conoce el desplazamiento y falta la reacción; en uno libre, al revés. Como están
          intercaladas, no se puede despejar de una sola vez — de ahí la partición del paso siguiente.
        </p>
      </div>
    </DecimalsScope>
  );
}
