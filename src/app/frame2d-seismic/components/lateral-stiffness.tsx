"use client";

import { useMemo } from "react";
import { useAtomValue } from "jotai";

import { useDecimals } from "@/components/custom/decimals-scope";
import { Math, MathBlock } from "@/components/custom/math";
import { MatrixTable } from "@/components/custom/matrix-table";
import { NoResults } from "@/components/custom/no-results";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { dofLabels } from "@/app/frame2d/store/nodes";
import { atomLateralAnalysis, type LateralResult } from "../store/analysis";
import { caseViews } from "../store/cases";
import { num } from "./format";

const REASON: Record<Extract<LateralResult, { status: "unavailable" }>["reason"], string> = {
  "no-levels": "No hay niveles: un nivel es una cota, por encima de la base, con algún nudo libre en x.",
  "case-error": "Algún caso no se pudo resolver: el detalle está en su procedimiento, más arriba.",
  "seismic-error": "Las fuerzas sísmicas no se pudieron calcular: el detalle está en la sección del sismo.",
};

/** Espacio que no parte el renglón: «N1 x» y «Nivel 1» se partían en dos en el rótulo de una fila. */
const NBSP = String.fromCharCode(0xa0);

/** El rótulo de cada grado de libertad de `K_ff`: el del piso si es de un diafragma. */
function useFreeLabels(freeGlobalIndices: number[]): string[] {
  const results = useAtomValue(caseViews.CS.atomResults);
  return useMemo(() => {
    if (results.status !== "ok") return freeGlobalIndices.map(String);
    const byIndex = new Map(results.solved.assembly.dofOrder.map((e) => [e.globalIndex, e]));
    return freeGlobalIndices.map((index) => {
      const entry = byIndex.get(index);
      if (!entry) return String(index);
      if (entry.diaphragmId) return `${entry.diaphragmId.replace("Nivel ", "N")}${NBSP}x`;
      return `${results.nodesById.get(entry.nodeId)?.name ?? entry.nodeId}${dofLabels[entry.localDof]}`;
    });
  }, [results, freeGlobalIndices]);
}

/**
 * Una matriz con su nombre. **Con scroll propio**: K_bb de un pórtico de tres
 * pisos y dos vanos es de 18×18 y ensanchaba la página entera (medido, paso 7).
 * Pasados 19 grados, mapa de calor, como la K de los otros sistemas (D13).
 */
function Matrix({ tex, matrix, rows, cols }: { tex: string; matrix: number[][]; rows: string[]; cols: string[] }) {
  return (
    <div className="flex w-fit max-w-full flex-col gap-1">
      <Math tex={tex} />
      <div className="max-w-full overflow-x-auto">
        <MatrixTable matrix={matrix} rowLabels={rows} colLabels={cols} heatmap={cols.length > 19} />
      </div>
    </div>
  );
}

/**
 * La rigidez lateral por condensación estática: el puente entre el método
 * matricial y el análisis sísmico de edificios.
 */
export function LateralStiffness() {
  const lateral = useAtomValue(atomLateralAnalysis);
  const d = useDecimals();
  const labels = useFreeLabels(lateral.status === "ok" ? lateral.freeGlobalIndices : []);

  if (lateral.status === "unavailable") return <NoResults tone="empty" title="Sin rigidez lateral">{REASON[lateral.reason]}</NoResults>;
  if (lateral.status === "error") return <NoResults tone="error" title="No se pudo condensar">{lateral.message}</NoResults>;

  const { condensation, levels } = lateral;
  const kept = condensation.keep.map((i) => labels[i]);
  const dropped = condensation.drop.map((i) => labels[i]);
  const levelNames = levels.map((l) => l.name.replace(" ", NBSP));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex max-w-3xl flex-col gap-2 text-sm text-muted-foreground">
        <p>
          En un sismo las fuerzas entran <strong>solo por la traslación de cada piso</strong>. Si se separan esos
          grados (<Math tex="a" />, uno por nivel) del resto de los libres (<Math tex="b" />: los giros y los
          verticales), las ecuaciones de <Math tex={String.raw`K_{ff}\,u = F`} /> con <Math tex="F_b = 0" /> dejan
          despejar <Math tex="u_b" /> y reemplazarlo:
        </p>
        <MathBlock
          tex={String.raw`\begin{bmatrix} K_{aa} & K_{ab} \\ K_{ba} & K_{bb} \end{bmatrix} \begin{bmatrix} u_a \\ u_b \end{bmatrix} = \begin{bmatrix} F_a \\ 0 \end{bmatrix} \;\Rightarrow\; u_b = -K_{bb}^{-1} K_{ba}\, u_a \;\Rightarrow\; \underbrace{\left(K_{aa} - K_{ab}\,K_{bb}^{-1}\,K_{ba}\right)}_{K_L} u_a = F_a`}
        />
        <p>
          <Math tex="K_L" /> es la <strong>matriz de rigidez lateral</strong> del pórtico: {levels.length}×
          {levels.length}, una fila por piso. Es la que se usa después para el análisis de edificios (y la del
          análisis modal). No se aproxima nada: es la misma estructura, vista solo por sus pisos.
        </p>
      </div>

      <h4 className="font-medium">Las cuatro partes de <Math tex="K_{ff}" /></h4>
      <div className="flex flex-col gap-4">
        <Matrix tex="K_{aa}" matrix={condensation.kaa} rows={kept} cols={kept} />
        <Matrix tex="K_{ab}" matrix={condensation.kab} rows={kept} cols={dropped} />
        <Matrix tex="K_{bb}" matrix={condensation.kbb} rows={dropped} cols={dropped} />
        <Matrix tex={String.raw`K_{ab}\,K_{bb}^{-1}\,K_{ba}`} matrix={condensation.correction} rows={kept} cols={kept} />
        <Matrix
          tex={String.raw`K_L = K_{aa} - K_{ab}\,K_{bb}^{-1}\,K_{ba}`}
          matrix={condensation.condensed}
          rows={levelNames}
          cols={levelNames}
        />
      </div>

      <h4 className="font-medium">El control</h4>
      <p className="max-w-3xl text-sm text-muted-foreground">
        Con las fuerzas sísmicas, <Math tex={String.raw`u_a = K_L^{-1} F`} /> tiene que dar lo mismo que el análisis
        completo del caso CS. Si da igual, la condensación está bien:
      </p>
      <div className="max-w-full overflow-x-auto">
        <Table className="w-auto border">
          <TableHeader>
            <TableRow>
              <TableHead>Nivel</TableHead>
              <TableHead className="text-right">
                <Math tex="F_i" />
              </TableHead>
              <TableHead className="text-right">
                <Math tex={String.raw`K_L^{-1} F`} />
              </TableHead>
              <TableHead className="text-right">Análisis completo (CS)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {levels.map((level, i) => (
              <TableRow key={level.id}>
                <TableCell>{level.name}</TableCell>
                <TableCell className="text-right tabular-nums">{num(lateral.forces[i], d)}</TableCell>
                <TableCell className="text-right tabular-nums">{lateral.condensedDisplacements[i].toExponential(d)}</TableCell>
                <TableCell className="text-right tabular-nums">{lateral.displacements[i].toExponential(d)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="max-w-3xl text-sm text-muted-foreground">
        <strong>Por qué no da la fórmula del libro</strong>: para un pórtico de vigas rígidas, cada columna
        biempotrada aporta <Math tex={String.raw`12EI/h^3`} />. Esa fórmula supone además vigas que no giran y
        columnas que no se acortan; esta matriz no supone nada de eso, así que es un poco más flexible —y más
        exacta—. Con vigas y columnas muy rígidas la app la reproduce (está en sus tests).
      </p>
    </div>
  );
}
