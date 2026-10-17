"use client";

import { useMemo } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { MinusCircle, PlusCircle } from "lucide-react";

import { FormulaInput } from "@/components/custom/formula-input";
import { useHighlightRows } from "@/components/custom/highlight";
import { NodeCombobox, type NodeOption } from "@/components/custom/node-combobox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { atomNodes } from "@/app/frame2d/store/nodes";
import {
  atomAddNodalLoad,
  atomNodalLoads,
  atomRemoveNodalLoad,
  atomUpdateNodalLoad,
  type GravityCase,
} from "../store/model";
import { GRAVITY_CASES } from "./cases";

/**
 * Las cargas aplicadas **en un nudo**, de un caso. En `/frame2d` van en la
 * tabla de nudos; acá no, porque cada una es de un caso. Las del sismo no van
 * acá: salen de la E.030 (o se escriben por nivel).
 */
export function NodalLoadTable() {
  const loads = useAtomValue(atomNodalLoads);
  const nodes = useAtomValue(atomNodes);
  const add = useSetAtom(atomAddNodalLoad);
  const remove = useSetAtom(atomRemoveNodalLoad);
  const update = useSetAtom(atomUpdateNodalLoad);
  const rowHighlight = useHighlightRows();
  const options = useMemo<NodeOption[]>(() => nodes.map((n) => ({ value: n.id, label: n.name })), [nodes]);
  const nodesById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  return (
    <div className="flex flex-col gap-3">
      <p className="max-w-3xl text-sm text-muted-foreground">
        Fuerzas y momentos aplicados en un nudo (por ejemplo, el apoyo de una viga secundaria), con el signo de su
        eje: <code>+X</code> a la derecha, <code>+Z</code> hacia arriba, el momento antihorario. Solo en un grado
        de libertad libre.
      </p>
      <div className="max-w-full overflow-x-auto">
        <Table className="border">
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => add()}
                  aria-label="Agregar una carga en nudo al final"
                  disabled={nodes.length === 0}
                >
                  <PlusCircle className="m-auto" />
                </Button>
              </TableHead>
              <TableHead className="w-10" />
              <TableHead>Nombre</TableHead>
              <TableHead>Caso</TableHead>
              <TableHead>Nudo</TableHead>
              <TableHead className="text-center">X</TableHead>
              <TableHead className="text-center">Z</TableHead>
              <TableHead className="text-center">M</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loads.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-sm text-muted-foreground">
                  Sin cargas en nudos. Con el + se agrega la primera.
                </TableCell>
              </TableRow>
            )}
            {loads.map((load) => {
              const node = nodesById.get(load.nodeId);
              return (
                <TableRow key={load.id} {...rowHighlight({ kind: "node", id: load.nodeId })}>
                  <TableCell>
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => add({ afterId: load.id })}
                      aria-label={`Insertar una carga en nudo debajo de ${load.name}`}
                    >
                      <PlusCircle className="m-auto" />
                    </Button>
                  </TableCell>
                  <TableCell>
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => remove(load.id)}
                      aria-label={`Eliminar ${load.name}`}
                    >
                      <MinusCircle className="m-auto" />
                    </Button>
                  </TableCell>
                  <TableCell>
                    <Input
                      className="w-16"
                      defaultValue={load.name}
                      onBlur={(e) => update({ id: load.id, field: "name", value: e.target.value })}
                    />
                  </TableCell>
                  <TableCell>
                    <Select
                      value={load.loadCase}
                      onValueChange={(value) => update({ id: load.id, field: "loadCase", value: value as GravityCase })}
                    >
                      <SelectTrigger className="w-20" aria-label={`Caso de la carga ${load.name}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {GRAVITY_CASES.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <NodeCombobox
                      options={options}
                      value={load.nodeId}
                      excluded=""
                      label={`Nudo de la carga ${load.name}`}
                      onChange={(value) => update({ id: load.id, field: "nodeId", value })}
                    />
                  </TableCell>
                  {(["forceX", "forceZ", "moment"] as const).map((field, i) => {
                    // Solo en un grado libre, que es lo que exige el motor.
                    const restrained = node ? [node.restrainedX, node.restrainedZ, node.restrainedR][i] : false;
                    return (
                      <TableCell key={field}>
                        <FormulaInput
                          className="min-w-16"
                          value={load[field]}
                          disabled={restrained}
                          onChange={(value) => update({ id: load.id, field, value })}
                        />
                      </TableCell>
                    );
                  })}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
