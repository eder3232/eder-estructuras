"use client";

import { useMemo } from "react";
import { useAtomValue, useSetAtom } from "jotai";

import { useDecimals } from "@/components/custom/decimals-scope";
import { FormulaInput } from "@/components/custom/formula-input";
import { useHighlightRows } from "@/components/custom/highlight";
import { Math } from "@/components/custom/math";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { atomNodes } from "@/app/frame2d/store/nodes";
import { atomLevelInputs, atomUpdateLevelInput } from "../store/model";
import { atomLevels, atomSeismicForces } from "../store/seismic";
import { num } from "./format";

/**
 * Los niveles salen de las cotas de los nudos (no se cargan): los nudos de
 * cada uno forman su diafragma rígido. Acá se escribe el peso de cada nivel
 * —o la fuerza, si se eligió escribirlas— y se ve el reparto en altura.
 */
export function LevelsTable() {
  const levels = useAtomValue(atomLevels);
  const inputs = useAtomValue(atomLevelInputs);
  const forces = useAtomValue(atomSeismicForces);
  const nodes = useAtomValue(atomNodes);
  const update = useSetAtom(atomUpdateLevelInput);
  const rowHighlight = useHighlightRows();
  const d = useDecimals();
  const names = useMemo(() => new Map(nodes.map((n) => [n.id, n.name])), [nodes]);

  if (levels.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No hay niveles: un nivel es una cota, por encima de la base, con algún nudo libre en x.
      </p>
    );
  }

  const manual = forces.status === "ok" && forces.mode === "manual";
  const detail = forces.status === "ok" && forces.mode === "e030" ? forces.detail : null;

  return (
    <div className="flex flex-col gap-3">
      <p className="max-w-3xl text-sm text-muted-foreground">
        <Math tex="P_i" /> es el peso del nivel <strong>que le toca a este pórtico</strong> —carga permanente más el
        porcentaje de la viva del artículo 31: 50% en categorías A y B, 25% en C, 25% en azoteas—. No sale de las
        cargas dibujadas: pide el área tributaria del edificio, que la página no tiene. Los nudos de cada nivel
        forman un <strong>diafragma rígido</strong> (artículo 30.3): se desplazan lo mismo en x, y la fuerza del
        nivel se aplica en el primero.
      </p>
      <div className="max-w-full overflow-x-auto">
        <Table className="w-auto border">
          <TableHeader>
            <TableRow>
              <TableHead>Nivel</TableHead>
              <TableHead>Nudos</TableHead>
              <TableHead className="text-right">
                <Math tex="h_i" />
              </TableHead>
              <TableHead className="text-center">
                <Math tex="P_i" />
              </TableHead>
              {detail && (
                <>
                  <TableHead className="text-right">
                    <Math tex={String.raw`P_i\,h_i^{\,k}`} />
                  </TableHead>
                  <TableHead className="text-right">
                    <Math tex={String.raw`\alpha_i`} />
                  </TableHead>
                </>
              )}
              <TableHead className={manual ? "text-center" : "text-right"}>
                <Math tex="F_i" />
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {levels.map((level, i) => (
              <TableRow
                key={level.id}
                {...rowHighlight({ kind: "node", id: level.nodeIds[0], nodeIds: level.nodeIds })}
              >
                <TableCell>{level.name}</TableCell>
                <TableCell className="text-sm">
                  {level.nodeIds.map((id) => names.get(id) ?? id).join(", ")}
                  {level.nodeIds.length === 1 && (
                    <span className="text-muted-foreground"> (un solo nudo: sin diafragma)</span>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">{num(level.height, d)}</TableCell>
                <TableCell>
                  <FormulaInput
                    className="w-24"
                    value={inputs.weights[i] ?? 0}
                    onChange={(value) => update({ field: "weights", index: i, value })}
                  />
                </TableCell>
                {detail && (
                  <>
                    <TableCell className="text-right tabular-nums">{num(detail.levels[i].weightedHeight, d)}</TableCell>
                    <TableCell className="text-right tabular-nums">{num(detail.levels[i].alpha, d)}</TableCell>
                  </>
                )}
                <TableCell className="text-right tabular-nums">
                  {manual ? (
                    <FormulaInput
                      className="w-24"
                      value={inputs.manualForces[i] ?? 0}
                      onChange={(value) => update({ field: "manualForces", index: i, value })}
                    />
                  ) : forces.status === "ok" ? (
                    num(forces.forces[i], d)
                  ) : (
                    "—"
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          {forces.status === "ok" && (
            <TableFooter>
              <TableRow>
                <TableCell colSpan={3}>Suma</TableCell>
                <TableCell className="text-right tabular-nums">
                  {num(
                    levels.reduce((sum, _, i) => sum + (inputs.weights[i] ?? 0), 0),
                    d,
                  )}
                </TableCell>
                {detail && (
                  <>
                    <TableCell />
                    <TableCell className="text-right tabular-nums">
                      {num(
                        detail.levels.reduce((sum, l) => sum + l.alpha, 0),
                        d,
                      )}
                    </TableCell>
                  </>
                )}
                <TableCell className="text-right tabular-nums">
                  {num(
                    forces.forces.reduce((sum, f) => sum + f, 0),
                    d,
                  )}
                </TableCell>
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </div>
    </div>
  );
}
