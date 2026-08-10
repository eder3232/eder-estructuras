import type { AssemblyResult } from "@/lib/engine";
import { MatrixTable } from "@/components/custom/matrix-table";
import type { ElementRow } from "../../store/elements";
import { dofLabels, type NodeRow } from "../../store/nodes";

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

export function AssemblySteps({ steps, dofOrder, elements, nodesById }: AssemblyStepsProps) {
  const labels = dofOrder.map(
    (entry) => `${nodesById.get(entry.nodeId)?.name ?? entry.nodeId}${dofLabels[entry.localDof]}`,
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
          <div key={step.elementId} className="flex flex-col gap-2">
            <p className="text-sm">
              <span className="font-medium">Paso {i + 1}:</span> barra {element?.name ?? step.elementId}
              {element ? ` (área=${element.area}, E=${element.elasticity})` : ""} conecta {from}↔{to} → aporta en
              las posiciones x/y/z de {from} y {to}.
            </p>
            <MatrixTable
              matrix={step.globalStiffnessAfter}
              labels={labels}
              highlight={diffPositions(previous, step.globalStiffnessAfter)}
            />
          </div>
        );
      })}
    </div>
  );
}
