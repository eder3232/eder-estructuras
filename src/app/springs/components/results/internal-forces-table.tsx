import type { SolveResult, SpringInternalForce } from "@/lib/engine";
import { useDecimals } from "@/components/custom/decimals-scope";
import { Math, MathBlock } from "@/components/custom/math";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ElementRow } from "../../store/elements";
import type { NodeRow } from "../../store/nodes";
import { operand } from "@/lib/operand";

interface InternalForcesTableProps {
  elements: ElementRow[];
  internalForces: SolveResult["internalForces"];
  displacements: SolveResult["displacements"];
  nodesById: Map<string, NodeRow>;
}

/**
 * La fuerza en cada resorte, con la sustitución a la vista. Es el mismo paso
 * que en `/armaduras-2d` sin la proyección: el resorte ya está sobre el eje, así
 * que su estiramiento es la diferencia de desplazamientos de sus dos nudos.
 */
export function InternalForcesTable({ elements, internalForces, displacements, nodesById }: InternalForcesTableProps) {
  const decimals = useDecimals();

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Con los desplazamientos de sus dos nudos, cada resorte da cuánto se estiró. La fuerza sale de multiplicarlo
        por su rigidez:
      </p>
      <MathBlock tex="\Delta = u_j - u_i \qquad F = k\,\Delta" />
      <p className="text-sm text-muted-foreground">
        Con <Math tex="i" /> el nudo «desde» y <Math tex="j" /> el «hacia», y el eje positivo yendo de{" "}
        <Math tex="i" /> a <Math tex="j" />: <Math tex="F > 0" /> es un resorte estirado y <Math tex="F < 0" /> uno
        comprimido. <span className="font-medium text-foreground">Esa convención es la única forma de leer el
        signo</span>, porque un sistema de resortes no tiene geometría: si das vuelta un resorte en la tabla, su{" "}
        <Math tex="F" /> cambia de signo — no cambió el resorte, cambió de qué lado se mira.
      </p>
      <div className="max-w-full overflow-x-auto">
        <Table className="border">
          <TableHeader>
            <TableRow>
              <TableHead>Resorte</TableHead>
              <TableHead>
                Sustitución de <Math tex="\Delta" />
              </TableHead>
              <TableHead>
                <Math tex="\Delta" />
              </TableHead>
              <TableHead>
                Sustitución de <Math tex="F" />
              </TableHead>
              <TableHead>
                <Math tex="F" /> (fuerza)
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {elements.map((element) => {
              const from = nodesById.get(element.fromNodeId)?.name ?? "?";
              const to = nodesById.get(element.toNodeId)?.name ?? "?";
              const uFrom = displacements.get(element.fromNodeId)?.[0] ?? 0;
              const uTo = displacements.get(element.toNodeId)?.[0] ?? 0;
              const delta = uTo - uFrom;
              const result = internalForces.get(element.id) as SpringInternalForce | undefined;

              return (
                <TableRow key={element.id}>
                  <TableCell>{element.name}</TableCell>
                  <TableCell className="whitespace-nowrap tabular-nums">
                    u<sub>{to}</sub> − u<sub>{from}</sub> = {operand(uTo, decimals)} − {operand(uFrom, decimals)}
                  </TableCell>
                  <TableCell className="tabular-nums">{delta.toFixed(decimals)}</TableCell>
                  <TableCell className="whitespace-nowrap tabular-nums">
                    {operand(element.k, decimals)} × {operand(delta, decimals)}
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
