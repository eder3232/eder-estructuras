"use client";

import { useAtom, useSetAtom } from "jotai";
import { MinusCircle, PlusCircle } from "lucide-react";

import { FormulaInput } from "@/components/custom/formula-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { atomNodes } from "../store/nodes";
import { atomAddElement, atomElements, atomRemoveElement, atomUpdateElementField } from "../store/elements";

/**
 * Una barra de armadura espacial pide exactamente los mismos datos que una
 * plana (extremos, área, E) — la diferencia entre 2D y 3D vive toda en los
 * nudos. Por eso esta tabla es hoy idéntica a la de `/armaduras-2d`: es la
 * primera pareja byte-idéntica del repo, y el próximo sistema que la necesite
 * dispara la extracción a `src/components/custom/` (mismo criterio que se usó
 * con `errors-panel`, ver docs/state-pattern.md).
 */
export function ElementTable() {
  const [elements] = useAtom(atomElements);
  const [nodes] = useAtom(atomNodes);
  const addElement = useSetAtom(atomAddElement);
  const removeElement = useSetAtom(atomRemoveElement);
  const updateField = useSetAtom(atomUpdateElementField);

  return (
    <div className="max-w-full overflow-x-auto">
      <Table className="border">
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <Button size="icon" variant="outline" onClick={() => addElement()}>
                <PlusCircle className="m-auto" />
              </Button>
            </TableHead>
            <TableHead>Nombre</TableHead>
            <TableHead>Desde</TableHead>
            <TableHead>Hacia</TableHead>
            <TableHead>Área</TableHead>
            <TableHead>Elasticidad (E)</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {elements.map((element) => (
            <TableRow key={element.id}>
              <TableCell>
                <Button size="icon" variant="outline" onClick={() => removeElement(element.id)}>
                  <MinusCircle className="m-auto" />
                </Button>
              </TableCell>
              <TableCell>
                <Input
                  className="w-24"
                  defaultValue={element.name}
                  onBlur={(e) => updateField({ id: element.id, field: "name", value: e.target.value })}
                />
              </TableCell>
              <TableCell>
                <Select
                  value={element.fromNodeId}
                  onValueChange={(value) => updateField({ id: element.id, field: "fromNodeId", value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Nudo..." />
                  </SelectTrigger>
                  <SelectContent>
                    {nodes.map((node) => (
                      <SelectItem key={node.id} value={node.id}>
                        {node.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell>
                <Select
                  value={element.toNodeId}
                  onValueChange={(value) => updateField({ id: element.id, field: "toNodeId", value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Nudo..." />
                  </SelectTrigger>
                  <SelectContent>
                    {nodes.map((node) => (
                      <SelectItem key={node.id} value={node.id}>
                        {node.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell>
                <FormulaInput
                  value={element.area}
                  onChange={(value) => updateField({ id: element.id, field: "area", value })}
                />
              </TableCell>
              <TableCell>
                <FormulaInput
                  value={element.elasticity}
                  onChange={(value) => updateField({ id: element.id, field: "elasticity", value })}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
