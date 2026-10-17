"use client";

import { useMemo, useState } from "react";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { MinusCircle, PlusCircle } from "lucide-react";

import { FormulaInput } from "@/components/custom/formula-input";
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

const SECTION_FIELDS = [
  { field: "area", header: "Área (A)" },
  { field: "inertia", header: "Inercia (I)" },
  { field: "elasticity", header: "Elasticidad (E)" },
] as const;

export function ElementTable() {
  const [elements] = useAtom(atomElements);
  const [nodes] = useAtom(atomNodes);
  const addElement = useSetAtom(atomAddElement);
  const removeElement = useSetAtom(atomRemoveElement);
  const updateField = useSetAtom(atomUpdateElementField);
  // Una sola lista estable para toda la tabla: el combobox compara por identidad.
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
              {SECTION_FIELDS.map(({ field, header }) => (
                <TableHead key={field}>{header}</TableHead>
              ))}
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
                {SECTION_FIELDS.map(({ field }) => (
                  <TableCell key={field}>
                    <FormulaInput
                      className="w-28"
                      value={element[field]}
                      onChange={(value) => updateField({ id: element.id, field, value })}
                    />
                  </TableCell>
                ))}
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
 * Fija A, I y E en todas las barras de una: lo que hacía
 * `changePropertiesForAllEdges` en el `frame2d` original, y lo que ya tienen
 * las armaduras. Los campos arrancan con lo que tenga la primera barra.
 */
function BulkProperties() {
  const elements = useAtomValue(atomElements);
  const setAll = useSetAtom(atomSetAllElementsNumber);

  const first = elements[0];
  const [area, setArea] = useState(first?.area ?? 0);
  const [inertia, setInertia] = useState(first?.inertia ?? 0);
  const [elasticity, setElasticity] = useState(first?.elasticity ?? 0);

  if (elements.length === 0) return null;

  const fields = [
    { id: "bulk-area", label: "Área (A)", value: area, set: setArea },
    { id: "bulk-inertia", label: "Inercia (I)", value: inertia, set: setInertia },
    { id: "bulk-elasticity", label: "Elasticidad (E)", value: elasticity, set: setElasticity },
  ];

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-md border border-dashed p-3">
      {fields.map((f) => (
        <div key={f.id} className="flex flex-col gap-1">
          <Label htmlFor={f.id} className="text-xs text-muted-foreground">
            {f.label}
          </Label>
          <FormulaInput id={f.id} value={f.value} onChange={f.set} className="w-32" />
        </div>
      ))}
      <Button variant="secondary" onClick={() => setAll({ area, inertia, elasticity })}>
        Aplicar a las {elements.length} barras
      </Button>
    </div>
  );
}
