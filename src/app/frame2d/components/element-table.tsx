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

export function ElementTable() {
  const [elements] = useAtom(atomElements);
  const [nodes] = useAtom(atomNodes);
  const addElement = useSetAtom(atomAddElement);
  const removeElement = useSetAtom(atomRemoveElement);
  const updateField = useSetAtom(atomUpdateElementField);

  const femFields = [
    { field: "femAxialFrom", header: "N desde" },
    { field: "femShearFrom", header: "V desde" },
    { field: "femMomentFrom", header: "M desde" },
    { field: "femAxialTo", header: "N hacia" },
    { field: "femShearTo", header: "V hacia" },
    { field: "femMomentTo", header: "M hacia" },
  ] as const;

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground">
        Las columnas de empotramiento perfecto (FEM) son las cargas repartidas a lo largo de la barra, convertidas a
        fuerzas y momentos en sus extremos con las tablas de siempre. Van <strong>en ejes locales de la barra</strong>
        {" "}(N sobre su eje, V perpendicular): el motor las lleva a ejes globales solo. Dejalas en cero si la barra no
        tiene carga repartida.
      </p>
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
            {femFields.map(({ field, header }) => (
              <TableHead key={field}>FEM {header}</TableHead>
            ))}
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
                  value={element.inertia}
                  onChange={(value) => updateField({ id: element.id, field: "inertia", value })}
                />
              </TableCell>
              <TableCell>
                <FormulaInput
                  value={element.elasticity}
                  onChange={(value) => updateField({ id: element.id, field: "elasticity", value })}
                />
              </TableCell>
              {femFields.map(({ field }) => (
                <TableCell key={field}>
                  <FormulaInput
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
    </div>
  );
}
