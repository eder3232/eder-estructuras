import type { AssemblyResult, DofOrderEntry, SolveResult } from "@/lib/engine";
import { PartitionAndSolution as GenericPartitionAndSolution } from "@/components/custom/partition-and-solution";
import { dofLabels, displacementFieldByAxis, forceFieldByAxis, nodeAxes, type NodeRow } from "../../store/nodes";

/**
 * La partición genérica, con los tres ejes de un nudo espacial. Reemplaza a la
 * versión propia de 3D, que mostraba los cuatro bloques sueltos y las
 * incógnitas como tablas aisladas, sin la matriz reordenada ni las ecuaciones.
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
  // `localDof` es la posición dentro del nudo (0=x, 1=y, 2=z): hay que indexar el campo por eje.
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
