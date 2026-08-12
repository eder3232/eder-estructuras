import type { AssemblyResult, SolveResult } from "@/lib/engine";
import { DecimalsScope, ScopeDecimalsStepper } from "@/components/custom/decimals-scope";
import { Math, MathBlock } from "@/components/custom/math";
import { EquationTerm, MathOp, MatrixEquation } from "@/components/custom/matrix-equation";
import { MatrixTable } from "@/components/custom/matrix-table";
import { cn } from "@/lib/utils";
import type { NodeRow } from "../../store/nodes";

interface PartitionAndSolutionProps {
  assembly: AssemblyResult;
  solved: SolveResult;
  nodesById: Map<string, NodeRow>;
}

const AXIS_LABEL = ["x", "z"];

/**
 * Un color por zona. Son cuatro tonos distintos y no cuatro intensidades del
 * mismo, porque lo que hay que poder hacer es señalar una zona y nombrarla — no
 * ordenarlas. Al /20 funcionan en claro y en oscuro sin tocar los tokens.
 */
const ZONE = {
  kff: "bg-sky-500/20",
  kfr: "bg-emerald-500/20",
  krf: "bg-amber-500/20",
  krr: "bg-violet-500/20",
} as const;

export function PartitionAndSolution({ assembly, solved, nodesById }: PartitionAndSolutionProps) {
  const { partition, dofOrder, globalStiffness } = assembly;
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

  // La matriz global con sus filas y columnas reordenadas: primero las libres,
  // después las restringidas. Es la misma matriz, no otra.
  const order = [...partition.free, ...partition.restrained];
  const permuted = order.map((row) => order.map((col) => globalStiffness[row][col]));
  const permutedLabels = [...freeLabels, ...restrainedLabels];
  const cut = partition.free.length;

  const zoneClass = (row: number, col: number) =>
    cn(
      row < cut ? (col < cut ? ZONE.kff : ZONE.kfr) : col < cut ? ZONE.krf : ZONE.krr,
      // La línea del corte, para que se vea que son cuatro bloques y no un damero.
      row === cut - 1 && "border-b-2 border-b-foreground/50",
      col === cut - 1 && "border-r-2 border-r-foreground/50",
    );

  return (
    <div className="flex flex-col gap-8">
      {/* ── El corte ───────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">
          Para poder despejar hay que separar lo conocido de lo incógnito. Se reordena la matriz global poniendo
          primero los grados de libertad <span className="font-medium text-foreground">libres</span> (f) y después
          los <span className="font-medium text-foreground">restringidos</span> (r). Es la misma matriz de antes,
          con las filas y las columnas permutadas — y así el corte deja cuatro bloques:
        </p>

        <MathBlock tex="\begin{bmatrix} F_f \\ F_r \end{bmatrix} = \begin{bmatrix} K_{ff} & K_{fr} \\ K_{rf} & K_{rr} \end{bmatrix} \cdot \begin{bmatrix} U_f \\ U_r \end{bmatrix}" />

        <DecimalsScope id="permuted">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Matriz global reordenada</span>
              <ScopeDecimalsStepper />
            </div>
            <div className="max-w-full overflow-x-auto">
              <MatrixTable matrix={permuted} labels={permutedLabels} cellClass={zoneClass} />
            </div>
          </div>
        </DecimalsScope>

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {(
            [
              ["kff", "Kff — libre con libre"],
              ["kfr", "Kfr — libre con restringido"],
              ["krf", "Krf — restringido con libre"],
              ["krr", "Krr — restringido con restringido"],
            ] as const
          ).map(([zone, text]) => (
            <span key={zone} className="flex items-center gap-1.5">
              <span className={cn("inline-block size-3 rounded-sm border", ZONE[zone])} />
              {text}
            </span>
          ))}
        </div>
      </div>

      {/* ── Los bloques sueltos ────────────────────────────────────────── */}
      <div className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">Cada bloque por separado:</p>
        <div className="flex flex-wrap gap-6">
          <LabeledMatrix scopeId="kff" title="Kff" matrix={partition.kff} labels={freeLabels} zone={ZONE.kff} />
          <LabeledMatrix
            scopeId="kfr"
            title="Kfr"
            matrix={partition.kfr}
            rowLabels={freeLabels}
            colLabels={restrainedLabels}
            zone={ZONE.kfr}
          />
          <LabeledMatrix
            scopeId="krf"
            title="Krf"
            matrix={partition.krf}
            rowLabels={restrainedLabels}
            colLabels={freeLabels}
            zone={ZONE.krf}
          />
          <LabeledMatrix
            scopeId="krr"
            title="Krr"
            matrix={partition.krr}
            labels={restrainedLabels}
            zone={ZONE.krr}
          />
        </div>
      </div>

      {/* ── Despejar los desplazamientos ───────────────────────────────── */}
      <DecimalsScope id="solve-uf">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">
              De la primera fila del sistema se despejan los desplazamientos libres:
            </span>
            <ScopeDecimalsStepper />
          </div>

          <MathBlock tex="\begin{bmatrix} U_f \end{bmatrix} = \begin{bmatrix} K_{ff} \end{bmatrix}^{-1} \cdot \left( \begin{bmatrix} F_f \end{bmatrix} - \begin{bmatrix} K_{fr} \end{bmatrix} \cdot \begin{bmatrix} U_r \end{bmatrix} \right)" />

          <MatrixEquation>
            <EquationTerm tex="U_f">
              <MatrixTable matrix={uf} rowLabels={freeLabels} />
            </EquationTerm>
            <MathOp tex="=" />
            <EquationTerm tex="K_{ff}^{-1}">
              <MatrixTable matrix={partition.kff} labels={freeLabels} />
            </EquationTerm>
            {/* `\Big(` y no `\left(`: `\left`/`\right` tienen que estar
                balanceados dentro de una misma expresión, y acá cada operador es
                una llamada suelta a KaTeX. Un `\left(` solo no parsea. */}
            <MathOp tex="\cdot\ \Big(" />
            <EquationTerm tex="F_f">
              <MatrixTable matrix={ff} rowLabels={freeLabels} />
            </EquationTerm>
            <MathOp tex="-" />
            <EquationTerm tex="K_{fr}">
              <MatrixTable matrix={partition.kfr} rowLabels={freeLabels} colLabels={restrainedLabels} />
            </EquationTerm>
            <MathOp tex="\cdot" />
            <EquationTerm tex="U_r">
              <MatrixTable matrix={ur} rowLabels={restrainedLabels} />
            </EquationTerm>
            <MathOp tex="\Big)" />
          </MatrixEquation>

          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Ojo con las dos U</span>: <Math tex="U_r" /> son los
            desplazamientos <span className="font-medium">impuestos</span> en los apoyos (el dato, casi siempre
            cero) y <Math tex="U_f" /> son los que se acaban de calcular. Son vectores distintos.
          </p>
        </div>
      </DecimalsScope>

      {/* ── Despejar las reacciones ────────────────────────────────────── */}
      <DecimalsScope id="solve-rr">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">
              Con los desplazamientos ya conocidos, la segunda fila da las reacciones:
            </span>
            <ScopeDecimalsStepper />
          </div>

          <MathBlock tex="\begin{bmatrix} R_r \end{bmatrix} = \begin{bmatrix} K_{rf} \end{bmatrix} \cdot \begin{bmatrix} U_f \end{bmatrix} + \begin{bmatrix} K_{rr} \end{bmatrix} \cdot \begin{bmatrix} U_r \end{bmatrix}" />

          <MatrixEquation>
            <EquationTerm tex="R_r">
              <MatrixTable matrix={rr} rowLabels={restrainedLabels} />
            </EquationTerm>
            <MathOp tex="=" />
            <EquationTerm tex="K_{rf}">
              <MatrixTable matrix={partition.krf} rowLabels={restrainedLabels} colLabels={freeLabels} />
            </EquationTerm>
            <MathOp tex="\cdot" />
            <EquationTerm tex="U_f">
              <MatrixTable matrix={uf} rowLabels={freeLabels} />
            </EquationTerm>
            <MathOp tex="+" />
            <EquationTerm tex="K_{rr}">
              <MatrixTable matrix={partition.krr} labels={restrainedLabels} />
            </EquationTerm>
            <MathOp tex="\cdot" />
            <EquationTerm tex="U_r">
              <MatrixTable matrix={ur} rowLabels={restrainedLabels} />
            </EquationTerm>
          </MatrixEquation>
        </div>
      </DecimalsScope>
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
  zone,
}: {
  scopeId: string;
  title: string;
  matrix: number[][];
  labels?: string[];
  rowLabels?: string[];
  colLabels?: string[];
  /** Color de la zona que ocupa este bloque en la matriz reordenada de arriba. */
  zone?: string;
}) {
  return (
    <DecimalsScope id={scopeId}>
      <div className="flex flex-col gap-1">
        {/* Sin `justify-between`: cada `LabeledMatrix` vive en un `flex-wrap` y
            mide lo que mide su tabla, así que el stepper pegado al borde derecho
            se corría al subir decimales — ver `ScopeDecimalsStepper`. */}
        <div className="flex items-center gap-2">
          {zone && <span className={cn("inline-block size-3 rounded-sm border", zone)} />}
          <span className="text-sm font-medium">{title}</span>
          <ScopeDecimalsStepper />
        </div>
        <MatrixTable matrix={matrix} labels={labels} rowLabels={rowLabels} colLabels={colLabels} />
      </div>
    </DecimalsScope>
  );
}
