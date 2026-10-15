"use client";

import { useAtom } from "jotai";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { SolveResult, Truss3DInternalForce } from "@/lib/engine";
import { atomDecimals } from "@/components/custom/decimals";
import { operand } from "@/lib/operand";
import type { ElementRow } from "../../store/elements";
import { dofLabels, type NodeRow } from "../../store/nodes";

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
        Para cada barra: la elongación δ es la proyección del desplazamiento relativo entre sus extremos sobre el eje
        de la barra, δ = Σ c<sub>i</sub> · (u<sub>hacia,i</sub> − u<sub>desde,i</sub>) sobre los ejes x, y, z; y la
        fuerza axial es N = EA/L · δ. Positivo = tracción.
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
              const result = internalForces.get(element.id) as Truss3DInternalForce | undefined;

              if (!from || !to) {
                return (
                  <TableRow key={element.id}>
                    <TableCell>{element.name}</TableCell>
                    <TableCell colSpan={4}>—</TableCell>
                  </TableRow>
                );
              }

              const delta = [to.x - from.x, to.y - from.y, to.z - from.z];
              const length = Math.hypot(delta[0], delta[1], delta[2]);
              const cosines = delta.map((d) => (length === 0 ? 0 : d / length));
              const eaOverL = length === 0 ? 0 : (element.elasticity * element.area) / length;

              const uFrom = displacements.get(element.fromNodeId) ?? [0, 0, 0];
              const uTo = displacements.get(element.toNodeId) ?? [0, 0, 0];
              const elongation = cosines.reduce((sum, c, axis) => sum + c * (uTo[axis] - uFrom[axis]), 0);

              return (
                <TableRow key={element.id}>
                  <TableCell>{element.name}</TableCell>
                  <TableCell className="tabular-nums">
                    δ ={" "}
                    {cosines.map((c, axis) => (
                      <span key={dofLabels[axis]}>
                        {axis > 0 ? " + " : ""}
                        {operand(c, decimals)}×({operand(uTo[axis], decimals)} − {operand(uFrom[axis], decimals)})
                      </span>
                    ))}
                  </TableCell>
                  <TableCell className="tabular-nums">{elongation.toFixed(decimals)}</TableCell>
                  <TableCell className="tabular-nums">
                    N = {operand(eaOverL, decimals)} × {operand(elongation, decimals)}
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
