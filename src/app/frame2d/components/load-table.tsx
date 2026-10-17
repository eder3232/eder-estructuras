"use client";

import { useMemo } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { MinusCircle, PlusCircle } from "lucide-react";

import { memberAxis, type LoadDirection } from "@/lib/engine";
import { FormulaInput } from "@/components/custom/formula-input";
import { useHighlightRows } from "@/components/custom/highlight";
import { NodeCombobox, type NodeOption } from "@/components/custom/node-combobox";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { atomElements } from "../store/elements";
import { atomAddLoad, atomLoads, atomRemoveLoad, atomUpdateLoadField, type LoadKind } from "../store/loads";
import { atomNodes } from "../store/nodes";

const KIND_LABEL: Record<LoadKind, string> = {
  distributed: "Distribuida",
  point: "Puntual",
  moment: "Momento",
};

/**
 * Cortas a propósito: la tabla tiene trece columnas. Hacia dónde es positivo
 * cada eje lo dice la nota de arriba, porque el signo de una carga solo se
 * entiende contra su eje — y el de la perpendicular depende de cómo se dibujó
 * la barra, que es el error que cometió hasta el que escribió los tests del
 * motor (paso 2 de `docs/frame2d-v1.md`).
 */
const DIRECTION_LABEL: Record<LoadDirection, string> = {
  globalZ: "Vertical (Z)",
  globalX: "Horizontal (X)",
  perpendicular: "Perpendicular (y′)",
  axial: "Axial (x′)",
};

export function LoadTable() {
  const loads = useAtomValue(atomLoads);
  const elements = useAtomValue(atomElements);
  const nodes = useAtomValue(atomNodes);
  const addLoad = useSetAtom(atomAddLoad);
  const removeLoad = useSetAtom(atomRemoveLoad);
  const update = useSetAtom(atomUpdateLoadField);
  // N3 para las cargas: una fila enciende **su barra** (y la carga dibujada
  // sobre ella), y señalar la barra en el dibujo enciende las filas de todas
  // sus cargas. Una carga no es un objeto del dibujo con identidad propia: es
  // de su barra.
  const rowHighlight = useHighlightRows();
  const elementsById = useMemo(() => new Map(elements.map((e) => [e.id, e])), [elements]);

  const options = useMemo<NodeOption[]>(() => elements.map((e) => ({ value: e.id, label: e.name })), [elements]);

  // La L de cada barra con los nudos de ahora: se muestra al lado de cada carga
  // porque es contra lo que se miden `a` y `b`.
  const lengthOf = useMemo(() => {
    const nodesById = new Map(nodes.map((n) => [n.id, n]));
    return new Map(
      elements.flatMap((e) => {
        const from = nodesById.get(e.fromNodeId);
        const to = nodesById.get(e.toNodeId);
        return from && to ? [[e.id, memberAxis(from, to).length] as const] : [];
      }),
    );
  }, [nodes, elements]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex max-w-3xl flex-col gap-2 text-sm text-muted-foreground">
        <p>
          Las cargas que van <strong>a lo largo de una barra</strong>, no en un nudo. El programa calcula con ellas
          los momentos de empotramiento perfecto (FEM) de cada barra —la tabla de abajo los muestra— y, después,
          los diagramas.
        </p>
        <p>
          Cada valor lleva el signo de su eje: <code>+Z</code> hacia arriba, <code>+X</code> hacia la derecha,{" "}
          <code>+x′</code> hacia el nudo «hacia» y el momento antihorario. Una carga de gravedad es{" "}
          <strong>vertical y negativa</strong>. Las
          posiciones <code>a</code> y <code>b</code> se miden <strong>a lo largo de la barra</strong> desde su nudo
          «desde». La perpendicular positiva (<code>+y′</code>) apunta a la izquierda de la barra mirándola de
          «desde» a «hacia». Una distribuida va de <code>q₁</code> en <code>a</code> a <code>q₂</code> en{" "}
          <code>b</code>: iguales es uniforme, una en cero es triangular. <strong>Por proyección</strong> quiere
          decir que la intensidad es por metro de planta (o de altura), no por metro de barra: el caso de la nieve o
          el peso de una cubierta sobre una barra inclinada.
        </p>
      </div>

      <div className="max-w-full overflow-x-auto">
        <Table className="border">
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => addLoad()}
                  aria-label="Agregar una carga al final"
                  disabled={elements.length === 0}
                >
                  <PlusCircle className="m-auto" />
                </Button>
              </TableHead>
              <TableHead className="w-10" />
              <TableHead>Nombre</TableHead>
              <TableHead>Barra</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Dirección</TableHead>
              <TableHead className="whitespace-normal leading-tight">Valor (q₁, P o M)</TableHead>
              <TableHead>q₂</TableHead>
              <TableHead className="w-16 whitespace-normal text-center leading-tight">Toda la barra</TableHead>
              <TableHead>a</TableHead>
              <TableHead>b</TableHead>
              <TableHead>L</TableHead>
              <TableHead className="w-24 whitespace-normal text-center leading-tight">Por proyección</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loads.length === 0 && (
              <TableRow>
                <TableCell colSpan={13} className="text-center text-sm text-muted-foreground">
                  Sin cargas en barras. Con el + se agrega la primera.
                </TableCell>
              </TableRow>
            )}
            {loads.map((load) => {
              const distributed = load.kind === "distributed";
              const global = load.direction === "globalX" || load.direction === "globalZ";
              const length = lengthOf.get(load.elementId);
              const element = elementsById.get(load.elementId);
              return (
                <TableRow
                  key={load.id}
                  {...rowHighlight({
                    kind: "element",
                    id: load.elementId,
                    nodeIds: element ? [element.fromNodeId, element.toNodeId] : [],
                  })}
                >
                  <TableCell>
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => addLoad({ afterId: load.id })}
                      aria-label={`Insertar una carga debajo de ${load.name}`}
                    >
                      <PlusCircle className="m-auto" />
                    </Button>
                  </TableCell>
                  <TableCell>
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => removeLoad(load.id)}
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
                    <NodeCombobox
                      options={options}
                      value={load.elementId}
                      excluded=""
                      label={`Barra de la carga ${load.name}`}
                      placeholder="Barra..."
                      emptyText="Ninguna barra con ese nombre."
                      onChange={(value) => update({ id: load.id, field: "elementId", value })}
                    />
                  </TableCell>
                  <TableCell>
                    <Select
                      value={load.kind}
                      onValueChange={(value) => update({ id: load.id, field: "kind", value: value as LoadKind })}
                    >
                      <SelectTrigger className="w-30" aria-label={`Tipo de la carga ${load.name}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(KIND_LABEL) as LoadKind[]).map((kind) => (
                          <SelectItem key={kind} value={kind}>
                            {KIND_LABEL[kind]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    {load.kind === "moment" ? (
                      <span className="text-sm text-muted-foreground">antihorario +</span>
                    ) : (
                      <Select
                        value={load.direction}
                        onValueChange={(value) =>
                          update({ id: load.id, field: "direction", value: value as LoadDirection })
                        }
                      >
                        <SelectTrigger className="w-40" aria-label={`Dirección de la carga ${load.name}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(Object.keys(DIRECTION_LABEL) as LoadDirection[]).map((direction) => (
                            <SelectItem key={direction} value={direction}>
                              {DIRECTION_LABEL[direction]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </TableCell>
                  <TableCell>
                    <FormulaInput
                      className="w-20"
                      value={load.q1}
                      onChange={(value) => update({ id: load.id, field: "q1", value })}
                    />
                  </TableCell>
                  <TableCell>
                    <FormulaInput
                      className="w-20"
                      // Vacía donde no aplica: un número viejo en una celda gris se lee como dato.
                      value={distributed ? load.q2 : Number.NaN}
                      disabled={!distributed}
                      onChange={(value) => update({ id: load.id, field: "q2", value })}
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <Checkbox
                      checked={distributed && load.wholeBar}
                      disabled={!distributed}
                      aria-label={`La carga ${load.name} cubre toda la barra`}
                      onCheckedChange={(checked) => update({ id: load.id, field: "wholeBar", value: checked === true })}
                    />
                  </TableCell>
                  <TableCell>
                    <FormulaInput
                      className="w-16"
                      value={distributed && load.wholeBar ? 0 : load.a}
                      disabled={distributed && load.wholeBar}
                      onChange={(value) => update({ id: load.id, field: "a", value })}
                    />
                  </TableCell>
                  <TableCell>
                    <FormulaInput
                      className="w-16"
                      value={!distributed ? Number.NaN : load.wholeBar ? (length ?? 0) : load.b}
                      disabled={!distributed || load.wholeBar}
                      onChange={(value) => update({ id: load.id, field: "b", value })}
                    />
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums text-muted-foreground">
                    {length === undefined ? "—" : Number(length.toFixed(4))}
                  </TableCell>
                  <TableCell className="text-center">
                    <Checkbox
                      checked={distributed && global && load.projected}
                      disabled={!distributed || !global}
                      aria-label={`La carga ${load.name} es por unidad de proyección`}
                      onCheckedChange={(checked) =>
                        update({ id: load.id, field: "projected", value: checked === true })
                      }
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
