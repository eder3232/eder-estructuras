import type { AssemblyResult, DofOrderEntry, SolveResult } from "@/lib/engine";
import { PartitionAndSolution as GenericPartitionAndSolution } from "@/components/custom/partition-and-solution";
import type { NodeRow } from "../../store/nodes";

const AXIS_LABEL = ["x", "z"];

/** La partición genérica, con los dos ejes de un nudo de armadura plana. */
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
  return (
    <GenericPartitionAndSolution
      assembly={assembly}
      solved={solved}
      labelOf={(entry) => `${nodesById.get(entry.nodeId)?.name ?? entry.nodeId}${AXIS_LABEL[entry.localDof]}`}
      forceOf={(entry) => (entry.localDof === 0 ? node(entry).forceX : node(entry).forceZ)}
      displacementOf={(entry) => (entry.localDof === 0 ? node(entry).displacementX : node(entry).displacementZ)}
    />
  );
}
