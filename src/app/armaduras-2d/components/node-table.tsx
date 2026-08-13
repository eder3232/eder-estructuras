"use client";

import { useAtom, useSetAtom } from "jotai";
import { MinusCircle, PlusCircle } from "lucide-react";

import { FormulaInput } from "@/components/custom/formula-input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  atomAddNode,
  atomNodes,
  atomRemoveNode,
  atomToggleNodeRestrained,
  atomUpdateNodeField,
} from "../store/nodes";

export function NodeTable() {
  const [nodes] = useAtom(atomNodes);
  const addNode = useSetAtom(atomAddNode);
  const removeNode = useSetAtom(atomRemoveNode);
  const toggleRestrained = useSetAtom(atomToggleNodeRestrained);
  const updateField = useSetAtom(atomUpdateNodeField);

  return (
    <div className="max-w-full overflow-x-auto">
      <Table className="border">
        {/*
          Encabezado de dos niveles: la magnitud arriba y el eje abajo. Nueve
          columnas planas obligaban a repetir la magnitud en cada una
          ("Fuerza X", "Fuerza Z", "Desplaz. X"…), y esa repetición es la que
          hacía la tabla mucho más ancha de lo que necesita: el rótulo largo le
          fijaba el piso al ancho de cada columna, no el dato.

          Es también donde van los rótulos de unidad de U5 —una vez por
          magnitud y no una por eje— y donde entra el grupo "Grado de libertad"
          de M1b, que agrega un par de columnas más con la misma forma.

          Las dos columnas de acciones y la de nombre atraviesan los dos
          renglones con `rowSpan`, y por eso el renglón de grupos no lleva
          borde inferior: cortaría por la mitad las celdas que lo cruzan.
        */}
        <TableHeader>
          <TableRow className="border-b-0">
            <TableHead rowSpan={2} className="w-10">
              <Button size="icon" variant="outline" onClick={() => addNode()} aria-label="Agregar un nudo al final">
                <PlusCircle className="m-auto" />
              </Button>
            </TableHead>
            <TableHead rowSpan={2} className="w-10" />
            <TableHead rowSpan={2}>Nombre</TableHead>
            <TableHead colSpan={2} className="h-9 border-l text-center">
              Coordenadas
            </TableHead>
            <TableHead colSpan={2} className="h-9 border-l text-center">
              Fuerza
            </TableHead>
            <TableHead colSpan={2} className="h-9 border-l text-center">
              Desplazamiento
            </TableHead>
            <TableHead colSpan={2} className="h-9 border-l text-center">
              Restringido
            </TableHead>
          </TableRow>
          <TableRow>
            <TableHead className="h-8 border-l text-center">X</TableHead>
            <TableHead className="h-8 text-center">Z</TableHead>
            <TableHead className="h-8 border-l text-center">X</TableHead>
            <TableHead className="h-8 text-center">Z</TableHead>
            <TableHead className="h-8 border-l text-center">X</TableHead>
            <TableHead className="h-8 text-center">Z</TableHead>
            <TableHead className="h-8 border-l text-center">X</TableHead>
            <TableHead className="h-8 text-center">Z</TableHead>
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
              {/* El `border-l` de la primera columna de cada grupo baja por todo
                  el cuerpo: sin eso la agrupación existe solo en el encabezado y
                  se pierde tres filas más abajo, que es donde hace falta. */}
              <TableCell className="border-l">
                <FormulaInput value={node.x} onChange={(value) => updateField({ id: node.id, field: "x", value })} />
              </TableCell>
              <TableCell>
                <FormulaInput value={node.z} onChange={(value) => updateField({ id: node.id, field: "z", value })} />
              </TableCell>
              <TableCell className="border-l">
                <FormulaInput
                  value={node.forceX}
                  disabled={node.restrainedX}
                  onChange={(value) => updateField({ id: node.id, field: "forceX", value })}
                />
              </TableCell>
              <TableCell>
                <FormulaInput
                  value={node.forceZ}
                  disabled={node.restrainedZ}
                  onChange={(value) => updateField({ id: node.id, field: "forceZ", value })}
                />
              </TableCell>
              <TableCell className="border-l">
                <FormulaInput
                  value={node.displacementX}
                  disabled={!node.restrainedX}
                  onChange={(value) => updateField({ id: node.id, field: "displacementX", value })}
                />
              </TableCell>
              <TableCell>
                <FormulaInput
                  value={node.displacementZ}
                  disabled={!node.restrainedZ}
                  onChange={(value) => updateField({ id: node.id, field: "displacementZ", value })}
                />
              </TableCell>
              <TableCell className="border-l text-center">
                <Checkbox
                  checked={node.restrainedX}
                  onCheckedChange={() => toggleRestrained({ id: node.id, axis: "x" })}
                  aria-label={`Restringir ${node.name} en x`}
                />
              </TableCell>
              <TableCell className="text-center">
                <Checkbox
                  checked={node.restrainedZ}
                  onCheckedChange={() => toggleRestrained({ id: node.id, axis: "z" })}
                  aria-label={`Restringir ${node.name} en z`}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
