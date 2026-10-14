"use client";

import { useMemo, useState } from "react";
import { useAtom, useSetAtom } from "jotai";
import { MinusCircle, PlusCircle } from "lucide-react";

import { FormulaInput } from "@/components/custom/formula-input";
import { useHighlightRows } from "@/components/custom/highlight";
import { NodeCombobox, type NodeOption } from "@/components/custom/node-combobox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { atomNodes } from "../store/nodes";
import {
  atomAddElement,
  atomElements,
  atomRemoveElement,
  atomSetAllElementsNumber,
  atomUpdateElementField,
} from "../store/elements";

export function ElementTable() {
  const [elements] = useAtom(atomElements);
  const [nodes] = useAtom(atomNodes);
  const addElement = useSetAtom(atomAddElement);
  const removeElement = useSetAtom(atomRemoveElement);
  const updateField = useSetAtom(atomUpdateElementField);
  // N3, igual que en la tabla de nudos — pero una barra enciende además **sus
  // dos nudos**, que es lo que hace el dibujo y lo que hace falta para leer una
  // fila que dice "desde v1 hacia v3".
  const rowHighlight = useHighlightRows();

  // Una sola lista para toda la tabla, y estable entre renders: el valor
  // seleccionado de cada fila sale de acá, así que la comparación por identidad
  // que hace el combobox funciona sin `isItemEqualToValue`.
  const options = useMemo<NodeOption[]>(() => nodes.map((n) => ({ value: n.id, label: n.name })), [nodes]);

  return (
    <div className="flex flex-col gap-4">
      <div className="max-w-full overflow-x-auto">
        <Table className="border">
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => addElement()}
                  aria-label="Agregar una barra al final"
                >
                  <PlusCircle className="m-auto" />
                </Button>
              </TableHead>
              <TableHead className="w-10" />
              <TableHead>Nombre</TableHead>
              <TableHead>Desde</TableHead>
              <TableHead>Hacia</TableHead>
              <TableHead>Área</TableHead>
              <TableHead>Elasticidad (E)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {elements.map((element) => (
              <TableRow
                key={element.id}
                {...rowHighlight({
                  kind: "element",
                  id: element.id,
                  nodeIds: [element.fromNodeId, element.toNodeId],
                })}
              >
                <TableCell>
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => addElement(element.id)}
                    aria-label={`Insertar una barra debajo de ${element.name}`}
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
      <BulkProperties />
    </div>
  );
}

/**
 * Fija área y módulo en todas las barras de una. Los dos campos arrancan con lo
 * que tenga la primera barra, que es lo que uno espera si lo que quiere es
 * cambiar el material de todas y no partir de cero.
 *
 * Va debajo de la tabla y no arriba a propósito: es una acción sobre lo que
 * acabás de cargar, no un paso previo.
 */
function BulkProperties() {
  const [elements] = useAtom(atomElements);
  const setAll = useSetAtom(atomSetAllElementsNumber);

  const first = elements[0];
  const [area, setArea] = useState(first?.area ?? 0);
  const [elasticity, setElasticity] = useState(first?.elasticity ?? 0);

  if (elements.length === 0) return null;

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-md border border-dashed p-3">
      <div className="flex flex-col gap-1">
        <Label htmlFor="bulk-area" className="text-xs text-muted-foreground">
          Área
        </Label>
        <FormulaInput id="bulk-area" value={area} onChange={setArea} className="w-32" />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="bulk-elasticity" className="text-xs text-muted-foreground">
          Elasticidad (E)
        </Label>
        <FormulaInput id="bulk-elasticity" value={elasticity} onChange={setElasticity} className="w-32" />
      </div>
      <Button variant="secondary" onClick={() => setAll({ area, elasticity })}>
        Aplicar a las {elements.length} barras
      </Button>
    </div>
  );
}
