import type { AssemblyResult, DofOrderEntry, SolveResult } from "@/lib/engine";
import { PartitionAndSolution as GenericPartitionAndSolution } from "@/components/custom/partition-and-solution";
import { dofLabels, displacementFieldByAxis, forceFieldByAxis, nodeAxes, type NodeRow } from "../../store/nodes";

/**
 * La partición genérica, con los tres grados de libertad de un nudo de
 * pórtico (el tercero es un giro: su "fuerza" es un momento). Con cargas en
 * las barras las ecuaciones ganan solas los términos `FEM_f` y `FEM_r`.
 */
export function PartitionAndSolution({
  assembly,
  solved,
  nodesById,
}: {
  assembly: AssemblyResult;
  solved: SolveResult;
  nodesById: Map<string, NodeRow>;
}) {
  const node = (entry: DofOrderEntry) => nodesById.get(entry.nodeId)!;
  const axis = (entry: DofOrderEntry) => nodeAxes[entry.localDof];
  return (
    <GenericPartitionAndSolution
      assembly={assembly}
      solved={solved}
      labelOf={(entry) => `${nodesById.get(entry.nodeId)?.name ?? entry.nodeId}${dofLabels[entry.localDof]}`}
      forceOf={(entry) => node(entry)[forceFieldByAxis[axis(entry)]]}
      displacementOf={(entry) => node(entry)[displacementFieldByAxis[axis(entry)]]}
    />
  );
}
