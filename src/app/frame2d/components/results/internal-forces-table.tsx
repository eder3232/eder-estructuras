"use client";

import { multiply } from "mathjs";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FrameElement2D, beamConventionEnds, type FrameInternalForce, type SolveResult } from "@/lib/engine";
import { useDecimals } from "@/components/custom/decimals-scope";
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
  const decimals = useDecimals();
  const show = (value: number) => value.toFixed(decimals);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Para cada barra: se llevan los desplazamientos globales de sus dos nudos a ejes locales (u_local = T·u_global)
        y se multiplican por la rigidez local, f_local = k_local · u_local + FEM. El sistema se resolvió con cargas
        solo nodales, así que acá se le devuelve a cada barra su carga repartida real sumando el FEM — por eso una
        viga simplemente apoyada con carga distribuida da momento cero en los extremos aunque su FEM no sea cero.
      </p>
      <p className="text-sm text-muted-foreground">
        <strong>Dos convenciones, y conviene no mezclarlas.</strong> <code>f_local</code> es la fuerza que los nudos
        le hacen a la barra, positiva según los ejes locales (<code>x′</code> hacia «hacia», <code>y′</code> a la
        izquierda, momento antihorario): es lo que da la matriz, y por eso la axial de una barra traccionada sale con
        signo opuesto en sus dos extremos. Los <strong>esfuerzos</strong> son la convención de viga de los textos (N
        positiva en tracción, V positivo horario, M positivo traccionando la fibra de abajo): un solo signo para toda
        la barra, el mismo de los diagramas.
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
              <TableHead>f x′</TableHead>
              <TableHead>f y′</TableHead>
              <TableHead>m</TableHead>
              <TableHead className="border-l">N</TableHead>
              <TableHead>V</TableHead>
              <TableHead>M</TableHead>
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
                    <TableCell colSpan={10}>—</TableCell>
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

              const beam = beamConventionEnds(result);
              return [
                { end: from.name, offset: 0, forces: result.from, stress: beam.from },
                { end: to.name, offset: 3, forces: result.to, stress: beam.to },
              ].map(({ end, offset, forces, stress }) => (
                <TableRow key={`${element.id}-${offset}`}>
                  <TableCell>{offset === 0 ? element.name : ""}</TableCell>
                  <TableCell>{end}</TableCell>
                  <TableCell className="tabular-nums">{show(localDisplacement[offset])}</TableCell>
                  <TableCell className="tabular-nums">{show(localDisplacement[offset + 1])}</TableCell>
                  <TableCell className="tabular-nums">{show(localDisplacement[offset + 2])}</TableCell>
                  <TableCell className="tabular-nums">{show(forces.axial)}</TableCell>
                  <TableCell className="tabular-nums">{show(forces.shear)}</TableCell>
                  <TableCell className="tabular-nums">{show(forces.moment)}</TableCell>
                  <TableCell className="border-l tabular-nums font-medium">{show(stress.N)}</TableCell>
                  <TableCell className="tabular-nums font-medium">{show(stress.V)}</TableCell>
                  <TableCell className="tabular-nums font-medium">{show(stress.M)}</TableCell>
                </TableRow>
              ));
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
