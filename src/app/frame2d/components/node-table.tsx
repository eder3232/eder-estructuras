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
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <Button size="icon" variant="outline" onClick={() => addNode()}>
                <PlusCircle className="m-auto" />
              </Button>
            </TableHead>
            <TableHead>Nombre</TableHead>
            <TableHead>X</TableHead>
            <TableHead>Z</TableHead>
            <TableHead>Fuerza X</TableHead>
            <TableHead>Fuerza Z</TableHead>
            <TableHead>Momento</TableHead>
            <TableHead>Desplaz. X</TableHead>
            <TableHead>Desplaz. Z</TableHead>
            <TableHead>Giro</TableHead>
            <TableHead className="text-center">Restr. X</TableHead>
            <TableHead className="text-center">Restr. Z</TableHead>
            <TableHead className="text-center">Restr. θ</TableHead>
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
              <TableCell>
                <FormulaInput value={node.x} onChange={(value) => updateField({ id: node.id, field: "x", value })} />
              </TableCell>
              <TableCell>
                <FormulaInput value={node.z} onChange={(value) => updateField({ id: node.id, field: "z", value })} />
              </TableCell>
              <TableCell>
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
              <TableCell>
                <FormulaInput
                  value={node.momentR}
                  disabled={node.restrainedR}
                  onChange={(value) => updateField({ id: node.id, field: "momentR", value })}
                />
              </TableCell>
              <TableCell>
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
              <TableCell>
                <FormulaInput
                  value={node.displacementR}
                  disabled={!node.restrainedR}
                  onChange={(value) => updateField({ id: node.id, field: "displacementR", value })}
                />
              </TableCell>
              <TableCell className="text-center">
                <Checkbox
                  checked={node.restrainedX}
                  onCheckedChange={() => toggleRestrained({ id: node.id, axis: "x" })}
                />
              </TableCell>
              <TableCell className="text-center">
                <Checkbox
                  checked={node.restrainedZ}
                  onCheckedChange={() => toggleRestrained({ id: node.id, axis: "z" })}
                />
              </TableCell>
              <TableCell className="text-center">
                <Checkbox
                  checked={node.restrainedR}
                  onCheckedChange={() => toggleRestrained({ id: node.id, axis: "r" })}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
