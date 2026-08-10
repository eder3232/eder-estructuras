"use client";

import { useAtom } from "jotai";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { SolveResult, TrussInternalForce } from "@/lib/engine";
import { atomDecimals } from "@/components/custom/decimals";
import type { ElementRow } from "../../store/elements";
import type { NodeRow } from "../../store/nodes";

interface InternalForcesTableProps {
  elements: ElementRow[];
  internalForces: SolveResult["internalForces"];
  displacements: SolveResult["displacements"];
  nodesById: Map<string, NodeRow>;
}

export function InternalForcesTable({ elements, internalForces, displacements, nodesById }: InternalForcesTableProps) {
  const [decimals] = useAtom(atomDecimals);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Para cada barra: elongación δ = −cos·u_desde,x − sin·u_desde,z + cos·u_hacia,x + sin·u_hacia,z, y la fuerza
        axial N = EA/L · δ.
      </p>
      <div className="max-w-full overflow-x-auto">
        <Table className="border">
          <TableHeader>
            <TableRow>
              <TableHead>Elemento</TableHead>
              <TableHead>Sustitución de δ</TableHead>
              <TableHead>δ</TableHead>
              <TableHead>Sustitución de N</TableHead>
              <TableHead>N (fuerza axial)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {elements.map((element) => {
              const from = nodesById.get(element.fromNodeId);
              const to = nodesById.get(element.toNodeId);
              const result = internalForces.get(element.id) as TrussInternalForce | undefined;

              if (!from || !to) {
                return (
                  <TableRow key={element.id}>
                    <TableCell>{element.name}</TableCell>
                    <TableCell colSpan={4}>—</TableCell>
                  </TableRow>
                );
              }

              const dx = to.x - from.x;
              const dz = to.z - from.z;
              const length = Math.hypot(dx, dz);
              const cos = length === 0 ? 0 : dx / length;
              const sin = length === 0 ? 0 : dz / length;
              const eaOverL = length === 0 ? 0 : (element.elasticity * element.area) / length;

              const [uFromX, uFromZ] = displacements.get(element.fromNodeId) ?? [0, 0];
              const [uToX, uToZ] = displacements.get(element.toNodeId) ?? [0, 0];
              const elongation = -cos * uFromX - sin * uFromZ + cos * uToX + sin * uToZ;

              return (
                <TableRow key={element.id}>
                  <TableCell>{element.name}</TableCell>
                  <TableCell className="tabular-nums">
                    δ = −{cos.toFixed(decimals)}×{uFromX.toFixed(decimals)} − {sin.toFixed(decimals)}×
                    {uFromZ.toFixed(decimals)} + {cos.toFixed(decimals)}×{uToX.toFixed(decimals)} +{" "}
                    {sin.toFixed(decimals)}×{uToZ.toFixed(decimals)}
                  </TableCell>
                  <TableCell className="tabular-nums">{elongation.toFixed(decimals)}</TableCell>
                  <TableCell className="tabular-nums">
                    N = {eaOverL.toFixed(decimals)} × {elongation.toFixed(decimals)}
                  </TableCell>
                  <TableCell className="tabular-nums font-medium">
                    {result ? result.axialForce.toFixed(decimals) : "—"}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
