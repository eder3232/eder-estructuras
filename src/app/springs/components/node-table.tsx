"use client";

import { useAtom, useSetAtom } from "jotai";
import { MinusCircle, PlusCircle } from "lucide-react";

import { FormulaInput } from "@/components/custom/formula-input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { atomToggleUseDofNumbers, atomUseDofNumbers } from "../store/dof-order";
import {
  atomAddNode,
  atomNodes,
  atomRemoveNode,
  atomToggleNodeRestrained,
  atomUpdateNodeField,
} from "../store/nodes";

/**
 * Los nudos de un sistema de resortes: un solo grado de libertad cada uno, así
 * que la tabla va en un nivel (la de `/armaduras-2d` necesita dos porque cada
 * magnitud tiene dos ejes).
 */
export function NodeTable() {
  const [nodes] = useAtom(atomNodes);
  const [useDofNumbers] = useAtom(atomUseDofNumbers);
  const addNode = useSetAtom(atomAddNode);
  const removeNode = useSetAtom(atomRemoveNode);
  const toggleRestrained = useSetAtom(atomToggleNodeRestrained);
  const updateField = useSetAtom(atomUpdateNodeField);
  const toggleUseDofNumbers = useSetAtom(atomToggleUseDofNumbers);

  return (
    <div className="flex flex-col gap-3">
      {/* Arriba de la tabla porque le agrega una columna: su efecto está acá.
          El otro control de orden vive en Resultados, que es donde reordena
          las matrices. Igual que en `/armaduras-2d`. */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Checkbox id="use-dof-numbers" checked={useDofNumbers} onCheckedChange={() => toggleUseDofNumbers()} />
          <Label htmlFor="use-dof-numbers" className="font-normal">
            Numerar los grados de libertad a mano
          </Label>
        </div>
        <p className="max-w-3xl text-xs text-muted-foreground">
          Para cotejar contra un ejercicio resuelto: si el profesor numeró de otra forma, cargá su numeración y las
          matrices de la pantalla van a quedar como las del papel. Los resultados no cambian.
        </p>
      </div>

      <div className="max-w-full overflow-x-auto">
        <Table className="border">
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Button size="icon" variant="outline" onClick={() => addNode()} aria-label="Agregar un nudo al final">
                  <PlusCircle className="m-auto" />
                </Button>
              </TableHead>
              <TableHead className="w-10" />
              <TableHead>Nombre</TableHead>
              <TableHead>Fuerza</TableHead>
              <TableHead>Desplazamiento</TableHead>
              <TableHead className="text-center">Restringido</TableHead>
              {useDofNumbers && <TableHead>Grado de libertad</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {nodes.map((node) => (
              <TableRow key={node.id}>
                <TableCell>
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => addNode(node.id)}
                    aria-label={`Insertar un nudo debajo de ${node.name}`}
                  >
                    <PlusCircle className="m-auto" />
                  </Button>
                </TableCell>
                <TableCell>
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => removeNode(node.id)}
                    aria-label={`Eliminar ${node.name}`}
                  >
                    <MinusCircle className="m-auto" />
                  </Button>
                </TableCell>
                <TableCell>
                  <Input
                    className="w-24"
                    defaultValue={node.name}
                    onBlur={(e) => updateField({ id: node.id, field: "name", value: e.target.value })}
                  />
                </TableCell>
                <TableCell>
                  <FormulaInput
                    value={node.force}
                    disabled={node.restrained}
                    onChange={(value) => updateField({ id: node.id, field: "force", value })}
                  />
                </TableCell>
                <TableCell>
                  <FormulaInput
                    value={node.displacement}
                    disabled={!node.restrained}
                    onChange={(value) => updateField({ id: node.id, field: "displacement", value })}
                  />
                </TableCell>
                <TableCell className="text-center">
                  <Checkbox
                    checked={node.restrained}
                    onCheckedChange={() => toggleRestrained(node.id)}
                    aria-label={`Restringir ${node.name}`}
                  />
                </TableCell>
                {useDofNumbers && (
                  <TableCell>
                    <FormulaInput
                      className="w-16"
                      decimals={0}
                      value={node.dofNumber}
                      onChange={(value) => updateField({ id: node.id, field: "dofNumber", value })}
                    />
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
