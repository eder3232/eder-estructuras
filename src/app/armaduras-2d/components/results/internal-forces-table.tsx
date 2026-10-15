"use client";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TrussElement2D, type SolveResult, type TrussInternalForce } from "@/lib/engine";
import { useDecimals } from "@/components/custom/decimals-scope";
import { Math, MathBlock } from "@/components/custom/math";
import type { ElementRow } from "../../store/elements";
import type { NodeRow } from "../../store/nodes";
import { operand } from "@/lib/operand";

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
        Con los desplazamientos de sus dos nudos, cada barra da su elongación proyectando esos desplazamientos
        sobre su propio eje. La fuerza axial sale de multiplicarla por la rigidez de la barra:
      </p>
      <MathBlock tex="\delta = -C_x\,u_{i,x} - C_z\,u_{i,z} + C_x\,u_{j,x} + C_z\,u_{j,z} \qquad N = \frac{EA}{L}\,\delta" />
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
              const result = internalForces.get(element.id) as TrussInternalForce | undefined;

              // Misma regla que en las matrices locales: la geometría se le pide
              // al elemento del motor, no se recalcula acá. Antes este archivo
              // tenía su propia copia de cos/sin/EA-L.
              let geometry;
              if (from && to) {
                try {
                  geometry = new TrussElement2D(
                    element.id,
                    { id: from.id, x: from.x, z: from.z },
                    { id: to.id, x: to.x, z: to.z },
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

              const { cos, sin, eaOverL } = geometry;
              const [uFromX, uFromZ] = displacements.get(element.fromNodeId) ?? [0, 0];
              const [uToX, uToZ] = displacements.get(element.toNodeId) ?? [0, 0];
              const elongation = -cos * uFromX - sin * uFromZ + cos * uToX + sin * uToZ;

              return (
                <TableRow key={element.id}>
                  <TableCell>{element.name}</TableCell>
                  <TableCell className="whitespace-nowrap tabular-nums">
                    −{operand(cos, decimals)}×{operand(uFromX, decimals)} − {operand(sin, decimals)}×
                    {operand(uFromZ, decimals)} + {operand(cos, decimals)}×{operand(uToX, decimals)} +{" "}
                    {operand(sin, decimals)}×{operand(uToZ, decimals)}
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
