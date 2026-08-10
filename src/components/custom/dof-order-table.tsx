import type { AssemblyResult } from "@/lib/engine";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface DofOrderTableProps {
  dofOrder: AssemblyResult["dofOrder"];
  nodesById: Map<string, { name: string }>;
  /** Etiqueta de cada grado de libertad local (ej. ["x", "z"] en armaduras 2D). Si se omite, no se muestra la columna. */
  dofLabels?: string[];
}

export function DofOrderTable({ dofOrder, nodesById, dofLabels }: DofOrderTableProps) {
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
              {dofLabels && <TableHead>Eje</TableHead>}
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
                  {dofLabels && <TableCell>{dofLabels[entry.localDof]}</TableCell>}
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
