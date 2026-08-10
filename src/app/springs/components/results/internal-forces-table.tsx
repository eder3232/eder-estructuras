"use client";

import { useAtom } from "jotai";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { SolveResult } from "@/lib/engine";
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
        Para cada resorte: Δ = u_hacia − u_desde, y la fuerza interna F = k · Δ.
      </p>
      <div className="max-w-full overflow-x-auto">
        <Table className="border">
          <TableHeader>
            <TableRow>
              <TableHead>Elemento</TableHead>
              <TableHead>Sustitución de Δ</TableHead>
              <TableHead>Δ</TableHead>
              <TableHead>Sustitución de F</TableHead>
              <TableHead>F (fuerza interna)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {elements.map((element) => {
              const from = nodesById.get(element.fromNodeId)?.name ?? "?";
              const to = nodesById.get(element.toNodeId)?.name ?? "?";
              const uFrom = displacements.get(element.fromNodeId)?.[0] ?? 0;
              const uTo = displacements.get(element.toNodeId)?.[0] ?? 0;
              const delta = uTo - uFrom;
              const result = internalForces.get(element.id) as { axialForce: number } | undefined;

              return (
                <TableRow key={element.id}>
                  <TableCell>{element.name}</TableCell>
                  <TableCell className="tabular-nums">
                    Δ = u_{to} − u_{from} = {uTo.toFixed(decimals)} − {uFrom.toFixed(decimals)}
                  </TableCell>
                  <TableCell className="tabular-nums">{delta.toFixed(decimals)}</TableCell>
                  <TableCell className="tabular-nums">
                    F = {element.k} × {delta.toFixed(decimals)}
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
