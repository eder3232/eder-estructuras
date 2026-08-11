import type { AssemblyResult, SolveResult } from "@/lib/engine";
import { DecimalsScope, ScopeDecimalsStepper } from "@/components/custom/decimals-scope";
import { MatrixTable } from "@/components/custom/matrix-table";
import type { NodeRow } from "../../store/nodes";

interface PartitionAndSolutionProps {
  assembly: AssemblyResult;
  solved: SolveResult;
  nodesById: Map<string, NodeRow>;
}

const AXIS_LABEL = ["x", "z"];

export function PartitionAndSolution({ assembly, solved, nodesById }: PartitionAndSolutionProps) {
  const { partition, dofOrder } = assembly;
  const entryFor = (globalIndex: number) => dofOrder.find((e) => e.globalIndex === globalIndex)!;

  const freeEntries = partition.free.map(entryFor);
  const restrainedEntries = partition.restrained.map(entryFor);

  const labelFor = (entry: (typeof dofOrder)[number]) =>
    `${nodesById.get(entry.nodeId)?.name ?? entry.nodeId}${AXIS_LABEL[entry.localDof]}`;
  const freeLabels = freeEntries.map(labelFor);
  const restrainedLabels = restrainedEntries.map(labelFor);

  const forceOf = (entry: (typeof dofOrder)[number]) => {
    const node = nodesById.get(entry.nodeId)!;
    return entry.localDof === 0 ? node.forceX : node.forceZ;
  };
  const displacementOf = (entry: (typeof dofOrder)[number]) => {
    const node = nodesById.get(entry.nodeId)!;
    return entry.localDof === 0 ? node.displacementX : node.displacementZ;
  };

  const ff = freeEntries.map((e) => [forceOf(e)]);
  const ur = restrainedEntries.map((e) => [displacementOf(e)]);
  const uf = freeEntries.map((e) => [solved.displacements.get(e.nodeId)![e.localDof]]);
  const rr = restrainedEntries.map((e) => [solved.reactions.get(e.nodeId)![e.localDof]]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">
          Separando la matriz global en las posiciones libres (f) y restringidas (r):
        </p>
        <div className="flex flex-wrap gap-6">
          <LabeledMatrix scopeId="kff" title="Kff" matrix={partition.kff} labels={freeLabels} />
          <LabeledMatrix scopeId="kfr" title="Kfr" matrix={partition.kfr} rowLabels={freeLabels} colLabels={restrainedLabels} />
          <LabeledMatrix scopeId="krf" title="Krf" matrix={partition.krf} rowLabels={restrainedLabels} colLabels={freeLabels} />
          <LabeledMatrix scopeId="krr" title="Krr" matrix={partition.krr} labels={restrainedLabels} />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">
          Resolviendo los desplazamientos libres: Uf = Kff⁻¹ · (Ff − Kfr · Ur)
        </p>
        <div className="flex flex-wrap items-end gap-6">
          <LabeledMatrix scopeId="ff" title="Ff (conocida)" matrix={ff} rowLabels={freeLabels} />
          <LabeledMatrix scopeId="ur" title="Ur (conocida)" matrix={ur} rowLabels={restrainedLabels} />
          <LabeledMatrix scopeId="uf" title="Uf (resuelta)" matrix={uf} rowLabels={freeLabels} />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">
          Reacciones en los nudos restringidos: Rr = Krf · Uf + Krr · Ur
        </p>
        <LabeledMatrix scopeId="rr" title="Rr (resuelta)" matrix={rr} rowLabels={restrainedLabels} />
      </div>
    </div>
  );
}

/**
 * Es el bloque donde el override por tabla más se justifica: Kff maneja
 * magnitudes de rigidez (~10⁶) y Uf desplazamientos (~10⁻³), y están una al lado
 * de la otra. Un único número de decimales deja a una ilegible por ruido o a la
 * otra en puros ceros.
 */
function LabeledMatrix({
  scopeId,
  title,
  matrix,
  labels,
  rowLabels,
  colLabels,
}: {
  scopeId: string;
  title: string;
  matrix: number[][];
  labels?: string[];
  rowLabels?: string[];
  colLabels?: string[];
}) {
  return (
    <DecimalsScope id={scopeId}>
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium">{title}</span>
          <ScopeDecimalsStepper />
        </div>
        <MatrixTable matrix={matrix} labels={labels} rowLabels={rowLabels} colLabels={colLabels} />
      </div>
    </DecimalsScope>
  );
}
