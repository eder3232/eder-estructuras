"use client";

import { useAtomValue, useSetAtom } from "jotai";

import { useDecimals } from "@/components/custom/decimals-scope";
import { FormulaInput } from "@/components/custom/formula-input";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { atomElements, atomUpdateElementField, type ElementRow } from "../store/elements";
import { atomMemberLoads } from "../store/results";

const FIELDS = [
  { field: "femAxialFrom", end: "from", key: "axial", header: "N" },
  { field: "femShearFrom", end: "from", key: "shear", header: "V" },
  { field: "femMomentFrom", end: "from", key: "moment", header: "M" },
  { field: "femAxialTo", end: "to", key: "axial", header: "N" },
  { field: "femShearTo", end: "to", key: "shear", header: "V" },
  { field: "femMomentTo", end: "to", key: "moment", header: "M" },
] as const satisfies readonly { field: keyof ElementRow; end: "from" | "to"; key: string; header: string }[];

/**
 * El FEM de cada barra: **calculado de sus cargas** (solo lectura, para
 * cotejarlo con el pizarrón) o **escrito a mano**, que es la flexibilidad que
 * tenía el original para una carga que la tabla no ofrezca.
 *
 * Va en una tabla aparte y no como seis columnas de la de barras: así estaba
 * antes, y le daba a la tabla de barras 13 columnas para un dato que la
 * mayoría de las barras no tiene.
 */
export function FemTable() {
  const elements = useAtomValue(atomElements);
  const { fem, brokenElementIds } = useAtomValue(atomMemberLoads);
  const update = useSetAtom(atomUpdateElementField);
  const decimals = useDecimals();

  if (elements.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      <p className="max-w-3xl text-sm text-muted-foreground">
        En <strong>ejes locales de la barra</strong> (N sobre su eje, V perpendicular), con el signo de la{" "}
        <strong>reacción del empotramiento</strong>: N positiva hacia el extremo «hacia», V positiva a la izquierda de
        la barra mirándola de «desde» a «hacia», y M positivo antihorario. Una viga horizontal con carga q hacia abajo
        da V = qL/2 en los dos extremos, M = qL²/12 en «desde» y −qL²/12 en «hacia». Con <strong>«a mano»</strong>{" "}
        se escriben los seis valores y las cargas de esa barra dejan de contar.
      </p>
      <div className="max-w-full overflow-x-auto">
        <Table className="border">
          <TableHeader>
            <TableRow>
              <TableHead rowSpan={2}>Barra</TableHead>
              <TableHead rowSpan={2} className="text-center">
                A mano
              </TableHead>
              <TableHead colSpan={3} className="border-l text-center">
                Extremo «desde»
              </TableHead>
              <TableHead colSpan={3} className="border-l text-center">
                Extremo «hacia»
              </TableHead>
            </TableRow>
            <TableRow>
              {FIELDS.map(({ field, header }, i) => (
                <TableHead key={field} className={i % 3 === 0 ? "border-l text-right" : "text-right"}>
                  {header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {elements.map((element) => {
              const values = fem.get(element.id);
              return (
                <TableRow key={element.id}>
                  <TableCell>{element.name}</TableCell>
                  <TableCell className="text-center">
                    <Checkbox
                      checked={element.manualFem}
                      aria-label={`FEM de ${element.name} a mano`}
                      onCheckedChange={(checked) =>
                        update({ id: element.id, field: "manualFem", value: checked === true })
                      }
                    />
                  </TableCell>
                  {FIELDS.map(({ field, end, key }, i) => (
                    <TableCell key={field} className={i % 3 === 0 ? "border-l" : undefined}>
                      {element.manualFem ? (
                        <FormulaInput
                          className="w-28"
                          value={element[field]}
                          onChange={(value) => update({ id: element.id, field, value })}
                        />
                      ) : (
                        <span className="block w-28 text-right text-sm tabular-nums text-muted-foreground">
                          {/* Con una carga mal escrita, la suma de las demás sería el FEM de otra carga. */}
                          {values && !brokenElementIds.has(element.id) ? values[end][key].toFixed(decimals) : "—"}
                        </span>
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
