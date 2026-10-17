import type { AssemblyResult, SolveResult } from "@/lib/engine";
import { GlobalEquation as GenericGlobalEquation } from "@/components/custom/global-equation";
import { dofLabels, forceFieldByAxis, nodeAxes, type NodeRow } from "../../store/nodes";

/**
 * La ecuación global genérica con los tres grados de libertad de un pórtico.
 * Con cargas en las barras gana sola el término `+ FEM` (`F = K·U + FEM`).
 * Sin el vínculo matriz ↔ modelo (N4), que quedó para la v2.
 */
export function GlobalEquation({
  assembly,
  solved,
  nodesById,
}: {
  assembly: AssemblyResult;
  solved: SolveResult;
  nodesById: Map<string, NodeRow>;
}) {
  return (
    <GenericGlobalEquation
      assembly={assembly}
      solved={solved}
      labelOf={(entry) => `${nodesById.get(entry.nodeId)?.name ?? entry.nodeId}${dofLabels[entry.localDof]}`}
      forceOf={(entry) => nodesById.get(entry.nodeId)![forceFieldByAxis[nodeAxes[entry.localDof]]]}
    />
  );
}
