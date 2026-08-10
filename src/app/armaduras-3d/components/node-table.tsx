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
  coordinateFieldByAxis,
  displacementFieldByAxis,
  forceFieldByAxis,
  nodeAxes,
  restrainedFieldByAxis,
} from "../store/nodes";

/**
 * Con 3 ejes la tabla tendría 14 columnas escritas a mano; se generan iterando
 * `nodeAxes` y los mapas eje → campo del store, que es además lo que evita que
 * agregar un eje obligue a tocar el JSX en cuatro lugares distintos.
 */
export function NodeTable() {
  const [nodes] = useAtom(atomNodes);
  const addNode = useSetAtom(atomAddNode);
  const removeNode = useSetAtom(atomRemoveNode);
  const toggleRestrained = useSetAtom(atomToggleNodeRestrained);
  const updateField = useSetAtom(atomUpdateNodeField);

  return (
    <div className="max-w-full overflow-x-auto">
      <Table className="border">
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <Button size="icon" variant="outline" onClick={() => addNode()}>
                <PlusCircle className="m-auto" />
              </Button>
            </TableHead>
            <TableHead>Nombre</TableHead>
            {nodeAxes.map((axis) => (
              <TableHead key={`coord-${axis}`}>{axis.toUpperCase()}</TableHead>
            ))}
            {nodeAxes.map((axis) => (
              <TableHead key={`force-${axis}`}>Fuerza {axis.toUpperCase()}</TableHead>
            ))}
            {nodeAxes.map((axis) => (
              <TableHead key={`disp-${axis}`}>Desplaz. {axis.toUpperCase()}</TableHead>
            ))}
            {nodeAxes.map((axis) => (
              <TableHead key={`restr-${axis}`} className="text-center">
                Restr. {axis.toUpperCase()}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {nodes.map((node) => (
            <TableRow key={node.id}>
              <TableCell>
                <Button size="icon" variant="outline" onClick={() => removeNode(node.id)}>
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

              {nodeAxes.map((axis) => (
                <TableCell key={`coord-${axis}`}>
                  <FormulaInput
                    value={node[coordinateFieldByAxis[axis]]}
                    onChange={(value) => updateField({ id: node.id, field: coordinateFieldByAxis[axis], value })}
                  />
                </TableCell>
              ))}

              {nodeAxes.map((axis) => (
                <TableCell key={`force-${axis}`}>
                  <FormulaInput
                    value={node[forceFieldByAxis[axis]]}
                    disabled={node[restrainedFieldByAxis[axis]]}
                    onChange={(value) => updateField({ id: node.id, field: forceFieldByAxis[axis], value })}
                  />
                </TableCell>
              ))}

              {nodeAxes.map((axis) => (
                <TableCell key={`disp-${axis}`}>
                  <FormulaInput
                    value={node[displacementFieldByAxis[axis]]}
                    disabled={!node[restrainedFieldByAxis[axis]]}
                    onChange={(value) => updateField({ id: node.id, field: displacementFieldByAxis[axis], value })}
                  />
                </TableCell>
              ))}

              {nodeAxes.map((axis) => (
                <TableCell key={`restr-${axis}`} className="text-center">
                  <Checkbox
                    checked={node[restrainedFieldByAxis[axis]]}
                    onCheckedChange={() => toggleRestrained({ id: node.id, axis })}
                  />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
