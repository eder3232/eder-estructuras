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
            <TableHead>Fuerza</TableHead>
            <TableHead>Desplazamiento</TableHead>
            <TableHead className="text-center">Restringido</TableHead>
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
                <Checkbox checked={node.restrained} onCheckedChange={() => toggleRestrained(node.id)} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
