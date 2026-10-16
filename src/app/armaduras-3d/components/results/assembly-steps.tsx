import type { AssemblyResult } from "@/lib/engine";
import { AssemblySteps as GenericAssemblySteps } from "@/components/custom/assembly-steps";
import type { ElementRow } from "../../store/elements";
import { dofLabels, type NodeRow } from "../../store/nodes";

interface AssemblyStepsProps {
  steps: AssemblyResult["steps"];
  dofOrder: AssemblyResult["dofOrder"];
  elements: ElementRow[];
  nodesById: Map<string, NodeRow>;
}

/** El ensamblaje genérico (`custom/assembly-steps.tsx`) con los tres ejes del espacio. */
export function AssemblySteps({ steps, dofOrder, elements, nodesById }: AssemblyStepsProps) {
  const labels = dofOrder.map(
    (entry) => `${nodesById.get(entry.nodeId)?.name ?? entry.nodeId}${dofLabels[entry.localDof]}`,
  );
  const elementsById = new Map(elements.map((e) => [e.id, e]));

  return (
    <GenericAssemblySteps
      steps={steps}
      labels={labels}
      describe={(step) => {
        const element = elementsById.get(step.elementId);
        const from = element ? (nodesById.get(element.fromNodeId)?.name ?? "?") : "?";
        const to = element ? (nodesById.get(element.toNodeId)?.name ?? "?") : "?";
        return (
          <>
            barra {element?.name ?? step.elementId}
            {element ? ` (área=${element.area}, E=${element.elasticity})` : ""} conecta {from}↔{to} → aporta en las
            posiciones x/y/z de {from} y {to}.
          </>
        );
      }}
    />
  );
}
