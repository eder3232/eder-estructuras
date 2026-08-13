import type { AssemblyResult } from "@/lib/engine";
import { DecimalsScope, ScopeDecimalsStepper } from "@/components/custom/decimals-scope";
import { MatrixTable } from "@/components/custom/matrix-table";
import type { ElementRow } from "../../store/elements";
import type { NodeRow } from "../../store/nodes";

interface AssemblyStepsProps {
  steps: AssemblyResult["steps"];
  dofOrder: AssemblyResult["dofOrder"];
  elements: ElementRow[];
  nodesById: Map<string, NodeRow>;
}

function diffPositions(prev: number[][] | null, curr: number[][]): [number, number][] {
  const positions: [number, number][] = [];
  curr.forEach((row, i) =>
    row.forEach((value, j) => {
      const prevValue = prev ? prev[i][j] : 0;
      if (value !== prevValue) positions.push([i, j]);
    }),
  );
  return positions;
}

const AXIS_LABEL = ["x", "z"];

export function AssemblySteps({ steps, dofOrder, elements, nodesById }: AssemblyStepsProps) {
  const labels = dofOrder.map(
    (entry) => `${nodesById.get(entry.nodeId)?.name ?? entry.nodeId}${AXIS_LABEL[entry.localDof]}`,
  );
  const elementsById = new Map(elements.map((e) => [e.id, e]));

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-muted-foreground">
        La matriz global se arma sumando la contribución de cada elemento, uno a la vez. Las celdas resaltadas son
        las que cambiaron en este paso.
      </p>
      {steps.map((step, i) => {
        const element = elementsById.get(step.elementId);
        const from = element ? (nodesById.get(element.fromNodeId)?.name ?? "?") : "?";
        const to = element ? (nodesById.get(element.toNodeId)?.name ?? "?") : "?";
        const previous = i > 0 ? steps[i - 1].globalStiffnessAfter : null;

        return (
          <DecimalsScope key={step.elementId} id={step.elementId}>
            <div className="flex flex-col gap-2">
              <div className="flex items-start justify-between gap-3">
                {/* `mb-0`: AccordionContent le mete `mb-4` a todo `p` que no
                    sea `:last-child`, y acá el stepper viene después. */}
                <p className="mb-0 text-sm">
                  <span className="font-medium">Paso {i + 1}:</span> barra {element?.name ?? step.elementId}
                  {element ? ` (área=${element.area}, E=${element.elasticity})` : ""} conecta {from}↔{to} → aporta en
                  las posiciones x/z de {from} y {to}.
                </p>
                <ScopeDecimalsStepper className="shrink-0" />
              </div>
              {/* La matriz global crece con la cantidad de nudos (2N×2N), así
                  que necesita su propio contenedor de scroll: sin él no se
                  desborda, se **recorta**, porque `AccordionContent` lleva
                  `overflow-hidden`. Y como es de las que crecen, las etiquetas
                  van fijas: scrollear una de 40×40 sin ellas es leer números
                  sin saber de qué grado de libertad son. */}
              <div className="max-w-full overflow-x-auto">
                <MatrixTable
                  matrix={step.globalStiffnessAfter}
                  labels={labels}
                  highlight={diffPositions(previous, step.globalStiffnessAfter)}
                  stickyLabels
                />
              </div>
            </div>
          </DecimalsScope>
        );
      })}
    </div>
  );
}
