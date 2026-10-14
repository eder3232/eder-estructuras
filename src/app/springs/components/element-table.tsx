"use client";

import { useMemo } from "react";
import { useAtom, useSetAtom } from "jotai";
import { MinusCircle, PlusCircle } from "lucide-react";

import { FormulaInput } from "@/components/custom/formula-input";
import { NodeCombobox, type NodeOption } from "@/components/custom/node-combobox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { atomAddElement, atomElements, atomRemoveElement, atomUpdateElementField } from "../store/elements";
import { atomNodes } from "../store/nodes";

export function ElementTable() {
  const [elements] = useAtom(atomElements);
  const [nodes] = useAtom(atomNodes);
  const addElement = useSetAtom(atomAddElement);
  const removeElement = useSetAtom(atomRemoveElement);
  const updateField = useSetAtom(atomUpdateElementField);

  // Una sola lista para toda la tabla, y estable entre renders: el combobox
  // compara el valor elegido por identidad (ver `custom/node-combobox.tsx`).
  const options = useMemo<NodeOption[]>(() => nodes.map((n) => ({ value: n.id, label: n.name })), [nodes]);

  return (
    <div className="max-w-full overflow-x-auto">
      <Table className="border">
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <Button size="icon" variant="outline" onClick={() => addElement()} aria-label="Agregar un resorte al final">
                <PlusCircle className="m-auto" />
              </Button>
            </TableHead>
            <TableHead className="w-10" />
            <TableHead>Nombre</TableHead>
            <TableHead>Desde</TableHead>
            <TableHead>Hacia</TableHead>
            {/* `normal-case` en la `k`: el encabezado de `ui/` va en mayúsculas y
                la convertía en `K`, que en este método es otra cosa — la matriz
                global. Es la trampa del `uppercase` que ya costó tres veces. */}
            <TableHead>
              Rigidez (<span className="normal-case">k</span>)
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {elements.map((element) => (
            <TableRow key={element.id}>
              <TableCell>
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => addElement(element.id)}
                  aria-label={`Insertar un resorte debajo de ${element.name}`}
                >
                  <PlusCircle className="m-auto" />
                </Button>
              </TableCell>
              <TableCell>
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => removeElement(element.id)}
                  aria-label={`Eliminar ${element.name}`}
                >
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
                <FormulaInput value={element.k} onChange={(value) => updateField({ id: element.id, field: "k", value })} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
