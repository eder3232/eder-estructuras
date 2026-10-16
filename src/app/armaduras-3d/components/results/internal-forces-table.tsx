"use client";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TrussElement3D, type SolveResult, type Truss3DInternalForce } from "@/lib/engine";
import { useDecimals } from "@/components/custom/decimals-scope";
import { Math, MathBlock } from "@/components/custom/math";
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
  const decimals = useDecimals();

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Con los desplazamientos de sus dos nudos, cada barra da su elongación proyectando el desplazamiento relativo
        de sus extremos sobre su propio eje, ahora con tres cosenos. La fuerza axial sale de multiplicarla por la
        rigidez de la barra:
      </p>
      <MathBlock tex="\delta = C_x\,(u_{j,x} - u_{i,x}) + C_y\,(u_{j,y} - u_{i,y}) + C_z\,(u_{j,z} - u_{i,z}) \qquad N = \frac{EA}{L}\,\delta" />
      <p className="text-sm text-muted-foreground">
        <Math tex="N > 0" /> es tracción y <Math tex="N < 0" /> compresión: es el signo que colorea las barras en
        la forma deformada.
      </p>
      <div className="max-w-full overflow-x-auto">
        <Table className="border">
          <TableHeader>
            <TableRow>
              <TableHead>Barra</TableHead>
              <TableHead>
                Sustitución de <Math tex="\delta" />
              </TableHead>
              <TableHead>
                <Math tex="\delta" />
              </TableHead>
              <TableHead>
                Sustitución de <Math tex="N" />
              </TableHead>
              <TableHead>
                <Math tex="N" /> (fuerza axial)
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {elements.map((element) => {
              const from = nodesById.get(element.fromNodeId);
              const to = nodesById.get(element.toNodeId);
              const result = internalForces.get(element.id) as Truss3DInternalForce | undefined;

              // La geometría se le pide al elemento del motor, como en las
              // matrices locales: antes este archivo tenía su propia copia de
              // los cosenos y de EA/L.
              let geometry;
              if (from && to) {
                try {
                  geometry = new TrussElement3D(
                    element.id,
                    { id: from.id, x: from.x, y: from.y, z: from.z },
                    { id: to.id, x: to.x, y: to.y, z: to.z },
                    element.area,
                    element.elasticity,
                  ).breakdown();
                } catch {
                  geometry = undefined;
                }
              }

              if (!from || !to || !geometry) {
                return (
                  <TableRow key={element.id}>
                    <TableCell>{element.name}</TableCell>
                    <TableCell colSpan={4}>—</TableCell>
                  </TableRow>
                );
              }

              const { cosines, eaOverL } = geometry;

              const uFrom = displacements.get(element.fromNodeId) ?? [0, 0, 0];
              const uTo = displacements.get(element.toNodeId) ?? [0, 0, 0];
              const elongation = cosines.reduce((sum, c, axis) => sum + c * (uTo[axis] - uFrom[axis]), 0);

              return (
                <TableRow key={element.id}>
                  <TableCell>{element.name}</TableCell>
                  <TableCell className="whitespace-nowrap tabular-nums">
                    {cosines.map((c, axis) => (
                      <span key={dofLabels[axis]}>
                        {axis > 0 ? " + " : ""}
                        {operand(c, decimals)}×({operand(uTo[axis], decimals)} − {operand(uFrom[axis], decimals)})
                      </span>
                    ))}
                  </TableCell>
                  <TableCell className="tabular-nums">{elongation.toFixed(decimals)}</TableCell>
                  <TableCell className="whitespace-nowrap tabular-nums">
                    {operand(eaOverL, decimals)} × {operand(elongation, decimals)}
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
