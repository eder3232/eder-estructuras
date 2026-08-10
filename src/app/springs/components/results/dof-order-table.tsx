import type { AssemblyResult } from "@/lib/engine";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { NodeRow } from "../../store/nodes";

interface DofOrderTableProps {
  dofOrder: AssemblyResult["dofOrder"];
  nodesById: Map<string, NodeRow>;
}

export function DofOrderTable({ dofOrder, nodesById }: DofOrderTableProps) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground">
        Cada posición del vector/matriz global corresponde a un nudo. Antes de armar el álgebra, así es como se
        reparte:
      </p>
      <div className="max-w-full overflow-x-auto">
        <Table className="border">
          <TableHeader>
            <TableRow>
              <TableHead>Posición</TableHead>
              <TableHead>Nudo</TableHead>
              <TableHead>Restringido</TableHead>
              <TableHead>Incógnita a resolver en esta posición</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {dofOrder.map((entry) => {
              const node = nodesById.get(entry.nodeId);
              return (
                <TableRow key={entry.globalIndex}>
                  <TableCell>{entry.globalIndex}</TableCell>
                  <TableCell>{node?.name ?? entry.nodeId}</TableCell>
                  <TableCell>{entry.restrained ? "Sí" : "No"}</TableCell>
                  <TableCell>
                    {entry.restrained ? "Fuerza de reacción" : "Desplazamiento"}
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
