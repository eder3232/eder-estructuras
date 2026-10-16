import type { AssemblyResult, SolveResult } from "@/lib/engine";
import { GlobalEquation as GenericGlobalEquation } from "@/components/custom/global-equation";
import { dofLabels, forceFieldByAxis, nodeAxes, type NodeRow } from "../../store/nodes";

/**
 * La ecuación global genérica con los tres ejes. Sin el vínculo matriz ↔
 * modelo (N4) de `/armaduras-2d`, que en 3D pide dibujar en la escena y quedó
 * para la v2 (docs/armaduras-3d-v1.md).
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
