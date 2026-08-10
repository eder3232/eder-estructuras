"use client";

import { useAtom } from "jotai";
import { multiply } from "mathjs";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FrameElement2D, type FrameInternalForce, type SolveResult } from "@/lib/engine";
import { atomDecimals } from "@/components/custom/decimals";
import type { ElementRow } from "../../store/elements";
import type { NodeRow } from "../../store/nodes";

interface InternalForcesTableProps {
  elements: ElementRow[];
  internalForces: SolveResult["internalForces"];
  displacements: SolveResult["displacements"];
  nodesById: Map<string, NodeRow>;
}

/**
 * La fuerza interna de una barra de pórtico no es un solo número con signo como
 * la axial de una armadura: son tres cantidades (axial, corte y momento) en cada
 * extremo, y se obtienen en ejes locales — por eso primero se muestra el paso
 * intermedio u_local = T·u_global, y recién después k_local·u_local.
 */
export function InternalForcesTable({
  elements,
  internalForces,
  displacements,
  nodesById,
}: InternalForcesTableProps) {
  const [decimals] = useAtom(atomDecimals);
  const show = (value: number) => value.toFixed(decimals);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Para cada barra: se llevan los desplazamientos globales de sus dos nudos a ejes locales (u_local = T·u_global)
        y se multiplican por la rigidez local, f_local = k_local · u_local + FEM. El resultado son la fuerza axial
        (N), el corte (V) y el momento (M) en cada extremo. El sistema se resolvió con cargas solo nodales, así que
        acá se le devuelve a cada barra su carga repartida real sumando el FEM — por eso una viga simplemente apoyada
        con carga distribuida da momento cero en los extremos aunque su FEM no sea cero.
      </p>
      <div className="max-w-full overflow-x-auto">
        <Table className="border">
          <TableHeader>
            <TableRow>
              <TableHead>Elemento</TableHead>
              <TableHead>Extremo</TableHead>
              <TableHead>u local</TableHead>
              <TableHead>w local</TableHead>
              <TableHead>θ local</TableHead>
              <TableHead>N (axial)</TableHead>
              <TableHead>V (corte)</TableHead>
              <TableHead>M (momento)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {elements.flatMap((element) => {
              const from = nodesById.get(element.fromNodeId);
              const to = nodesById.get(element.toNodeId);
              const result = internalForces.get(element.id) as FrameInternalForce | undefined;

              if (!from || !to || !result) {
                return [
                  <TableRow key={element.id}>
                    <TableCell>{element.name}</TableCell>
                    <TableCell colSpan={7}>—</TableCell>
                  </TableRow>,
                ];
              }

              const frameElement = new FrameElement2D(
                element.id,
                { id: from.id, x: from.x, z: from.z },
                { id: to.id, x: to.x, z: to.z },
                element.area,
                element.elasticity,
                element.inertia,
              );

              const globalDisplacement = [
                ...(displacements.get(element.fromNodeId) ?? [0, 0, 0]),
                ...(displacements.get(element.toNodeId) ?? [0, 0, 0]),
              ].map((value) => [value]);
              const localDisplacement = (
                multiply(frameElement.transform(), globalDisplacement) as number[][]
              ).map((row) => row[0]);

              return [
                { end: from.name, offset: 0, forces: result.from },
                { end: to.name, offset: 3, forces: result.to },
              ].map(({ end, offset, forces }) => (
                <TableRow key={`${element.id}-${offset}`}>
                  <TableCell>{offset === 0 ? element.name : ""}</TableCell>
                  <TableCell>{end}</TableCell>
                  <TableCell className="tabular-nums">{show(localDisplacement[offset])}</TableCell>
                  <TableCell className="tabular-nums">{show(localDisplacement[offset + 1])}</TableCell>
                  <TableCell className="tabular-nums">{show(localDisplacement[offset + 2])}</TableCell>
                  <TableCell className="tabular-nums font-medium">{show(forces.axial)}</TableCell>
                  <TableCell className="tabular-nums font-medium">{show(forces.shear)}</TableCell>
                  <TableCell className="tabular-nums font-medium">{show(forces.moment)}</TableCell>
                </TableRow>
              ));
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
