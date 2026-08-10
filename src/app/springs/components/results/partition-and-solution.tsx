import type { AssemblyResult, SolveResult } from "@/lib/engine";
import { MatrixTable } from "../matrix-table";
import type { NodeRow } from "../../store/nodes";

interface PartitionAndSolutionProps {
  assembly: AssemblyResult;
  solved: SolveResult;
  nodesById: Map<string, NodeRow>;
}

export function PartitionAndSolution({ assembly, solved, nodesById }: PartitionAndSolutionProps) {
  const { partition, dofOrder } = assembly;
  const entryFor = (globalIndex: number) => dofOrder.find((e) => e.globalIndex === globalIndex)!;

  const freeEntries = partition.free.map(entryFor);
  const restrainedEntries = partition.restrained.map(entryFor);

  const freeLabels = freeEntries.map((e) => nodesById.get(e.nodeId)?.name ?? e.nodeId);
  const restrainedLabels = restrainedEntries.map((e) => nodesById.get(e.nodeId)?.name ?? e.nodeId);

  const ff = freeEntries.map((e) => [nodesById.get(e.nodeId)!.force]);
  const ur = restrainedEntries.map((e) => [nodesById.get(e.nodeId)!.displacement]);
  const uf = freeEntries.map((e) => [solved.displacements.get(e.nodeId)![0]]);
  const rr = restrainedEntries.map((e) => [solved.reactions.get(e.nodeId)![0]]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">
          Separando la matriz global en las posiciones libres (f) y restringidas (r):
        </p>
        <div className="flex flex-wrap gap-6">
          <LabeledMatrix title="Kff" matrix={partition.kff} labels={freeLabels} />
          <LabeledMatrix title="Kfr" matrix={partition.kfr} rowLabels={freeLabels} colLabels={restrainedLabels} />
          <LabeledMatrix title="Krf" matrix={partition.krf} rowLabels={restrainedLabels} colLabels={freeLabels} />
          <LabeledMatrix title="Krr" matrix={partition.krr} labels={restrainedLabels} />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">
          Resolviendo los desplazamientos libres: Uf = Kff⁻¹ · (Ff − Kfr · Ur)
        </p>
        <div className="flex flex-wrap items-end gap-6">
          <LabeledMatrix title="Ff (conocida)" matrix={ff} rowLabels={freeLabels} />
          <LabeledMatrix title="Ur (conocida)" matrix={ur} rowLabels={restrainedLabels} />
          <LabeledMatrix title="Uf (resuelta)" matrix={uf} rowLabels={freeLabels} />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">
          Reacciones en los nudos restringidos: Rr = Krf · Uf + Krr · Ur
        </p>
        <LabeledMatrix title="Rr (resuelta)" matrix={rr} rowLabels={restrainedLabels} />
      </div>
    </div>
  );
}

function LabeledMatrix({
  title,
  matrix,
  labels,
  rowLabels,
  colLabels,
}: {
  title: string;
  matrix: number[][];
  labels?: string[];
  rowLabels?: string[];
  colLabels?: string[];
}) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-sm font-medium">{title}</p>
      <MatrixTable matrix={matrix} labels={labels} rowLabels={rowLabels} colLabels={colLabels} />
    </div>
  );
}
