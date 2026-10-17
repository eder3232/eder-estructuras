"use client";

import { useMemo } from "react";
import { useAtom, useSetAtom } from "jotai";
import { MinusCircle, PlusCircle } from "lucide-react";

import { FormulaInput } from "@/components/custom/formula-input";
import { NodeCombobox, type NodeOption } from "@/components/custom/node-combobox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { atomNodes } from "../store/nodes";
import { atomAddElement, atomElements, atomRemoveElement, atomUpdateElementField } from "../store/elements";

export function ElementTable() {
  const [elements] = useAtom(atomElements);
  const [nodes] = useAtom(atomNodes);
  const addElement = useSetAtom(atomAddElement);
  const removeElement = useSetAtom(atomRemoveElement);
  const updateField = useSetAtom(atomUpdateElementField);
  // Una sola lista estable para toda la tabla: el combobox compara por identidad.
  const options = useMemo<NodeOption[]>(() => nodes.map((n) => ({ value: n.id, label: n.name })), [nodes]);

  return (
    <div className="flex flex-col gap-2">
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
            <TableHead>Inercia (I)</TableHead>
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
                <NodeCombobox
                  options={options}
                  value={element.fromNodeId}
                  excluded={element.toNodeId}
                  label={`Nudo de origen de ${element.name}`}
                  onChange={(value) => updateField({ id: element.id, field: "fromNodeId", value })}
                />
              </TableCell>
              <TableCell>
                <NodeCombobox
                  options={options}
                  value={element.toNodeId}
                  excluded={element.fromNodeId}
                  label={`Nudo de destino de ${element.name}`}
                  onChange={(value) => updateField({ id: element.id, field: "toNodeId", value })}
                />
              </TableCell>
              <TableCell>
                <FormulaInput
                  className="w-28"
                  value={element.area}
                  onChange={(value) => updateField({ id: element.id, field: "area", value })}
                />
              </TableCell>
              <TableCell>
                <FormulaInput
                  className="w-28"
                  value={element.inertia}
                  onChange={(value) => updateField({ id: element.id, field: "inertia", value })}
                />
              </TableCell>
              <TableCell>
                <FormulaInput
                  className="w-28"
                  value={element.elasticity}
                  onChange={(value) => updateField({ id: element.id, field: "elasticity", value })}
                />
              </TableCell>
            </TableRow>
          ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
