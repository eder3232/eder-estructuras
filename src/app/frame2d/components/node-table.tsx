"use client";

import { Fragment } from "react";
import { useAtom, useSetAtom } from "jotai";
import { MinusCircle, PlusCircle } from "lucide-react";

import { FormulaInput } from "@/components/custom/formula-input";
import { useHighlightRows } from "@/components/custom/highlight";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { atomToggleUseDofNumbers, atomUseDofNumbers } from "../store/dof-order";
import {
  atomAddNode,
  atomNodes,
  atomRemoveNode,
  atomToggleNodeRestrained,
  atomUpdateNodeField,
  coordinateFieldByAxis,
  displacementFieldByAxis,
  dofNumberFieldByAxis,
  forceFieldByAxis,
  nodeAxes,
  restrainedFieldByAxis,
  type NodeAxis,
  type NodeNumericField,
} from "../store/nodes";

/**
 * Los grupos de columnas numéricas, en el orden de la tabla. A diferencia de
 * las armaduras, **no todos tienen los mismos ejes**: las coordenadas son dos,
 * y el tercer grado de libertad es un giro, así que su columna dice `M` en las
 * fuerzas y `θ` en los desplazamientos.
 */
const NUMBER_GROUPS: {
  title: "Coordenadas" | "Fuerza" | "Desplazamiento";
  axes: readonly NodeAxis[];
  fieldByAxis: Partial<Record<NodeAxis, NodeNumericField>>;
  third: string;
}[] = [
  { title: "Coordenadas", axes: ["x", "z"], fieldByAxis: coordinateFieldByAxis, third: "" },
  { title: "Fuerza", axes: nodeAxes, fieldByAxis: forceFieldByAxis, third: "M" },
  { title: "Desplazamiento", axes: nodeAxes, fieldByAxis: displacementFieldByAxis, third: "θ" },
];

const axisLabel = (axis: NodeAxis, third: string) => (axis === "r" ? third : axis.toUpperCase());

/**
 * La tabla de nudos de un pórtico: 11 columnas de datos, 14 con la numeración
 * manual. Encabezado en dos niveles, la magnitud arriba y el eje abajo (U1 de
 * `/armaduras-2d`): con un rótulo largo por columna («Desplaz. X») era el
 * rótulo y no el dato lo que le fijaba el ancho a la tabla.
 */
export function NodeTable({ withLoads = true }: {
  /**
   * `false` en `frame2d-seismic`: ahí las cargas van **por caso**, en su propia
   * tabla, así que la de nudos queda en geometría y apoyos.
   */
  withLoads?: boolean;
} = {}) {
  const numberGroups = withLoads ? NUMBER_GROUPS : NUMBER_GROUPS.filter((g) => g.title === "Coordenadas");
  const [nodes] = useAtom(atomNodes);
  const [useDofNumbers] = useAtom(atomUseDofNumbers);
  const addNode = useSetAtom(atomAddNode);
  const removeNode = useSetAtom(atomRemoveNode);
  const toggleRestrained = useSetAtom(atomToggleNodeRestrained);
  const updateField = useSetAtom(atomUpdateNodeField);
  const toggleUseDofNumbers = useSetAtom(atomToggleUseDofNumbers);
  const rowHighlight = useHighlightRows();

  const groups = [
    ...numberGroups,
    { title: "Restringido", axes: nodeAxes, third: "θ" },
    ...(useDofNumbers ? [{ title: "Grado de libertad", axes: nodeAxes, third: "θ" }] : []),
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Checkbox id="use-dof-numbers" checked={useDofNumbers} onCheckedChange={() => toggleUseDofNumbers()} />
          <Label htmlFor="use-dof-numbers" className="font-normal">
            Numerar los grados de libertad a mano
          </Label>
        </div>
        <p className="max-w-3xl text-xs text-muted-foreground">
          Para cotejar contra un ejercicio resuelto: si el profesor numeró de otra forma, cargá su numeración y las
          matrices de la pantalla van a quedar como las del papel. Los resultados no cambian.
        </p>
      </div>

      <div className="max-w-full overflow-x-auto">
        <Table className="border">
          <TableHeader>
            <TableRow className="border-b-0">
              <TableHead rowSpan={2} className="w-10">
                <Button size="icon" variant="outline" onClick={() => addNode()} aria-label="Agregar un nudo al final">
                  <PlusCircle className="m-auto" />
                </Button>
              </TableHead>
              <TableHead rowSpan={2} className="w-10" />
              <TableHead rowSpan={2}>Nombre</TableHead>
              {groups.map((group) => (
                <TableHead key={group.title} colSpan={group.axes.length} className="h-9 border-l text-center">
                  {group.title}
                </TableHead>
              ))}
            </TableRow>
            <TableRow>
              {groups.map((group) => (
                <Fragment key={group.title}>
                  {group.axes.map((axis, i) => (
                    <TableHead key={axis} className={`h-8 text-center ${i === 0 ? "border-l" : ""}`}>
                      {axisLabel(axis, group.third)}
                    </TableHead>
                  ))}
                </Fragment>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {nodes.map((node) => (
              <TableRow key={node.id} {...rowHighlight({ kind: "node", id: node.id })}>
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
                    className="w-20"
                    defaultValue={node.name}
                    onBlur={(e) => updateField({ id: node.id, field: "name", value: e.target.value })}
                  />
                </TableCell>

                {numberGroups.map((group) =>
                  group.axes.map((axis, i) => {
                    const field = group.fieldByAxis[axis]!;
                    const restrained = node[restrainedFieldByAxis[axis]];
                    // Fuerza solo en un grado libre, desplazamiento solo en uno
                    // restringido: es lo que `System.addNode` exige.
                    const disabled =
                      group.title === "Fuerza" ? restrained : group.title === "Desplazamiento" ? !restrained : false;
                    return (
                      <TableCell key={`${group.title}-${axis}`} className={i === 0 ? "border-l" : undefined}>
                        <FormulaInput
                          className="min-w-16"
                          value={node[field]}
                          disabled={disabled}
                          onChange={(value) => updateField({ id: node.id, field, value })}
                        />
                      </TableCell>
                    );
                  }),
                )}

                {nodeAxes.map((axis, i) => (
                  <TableCell
                    key={`restr-${axis}`}
                    // El `Checkbox` de `ui/` agranda su área de click con un
                    // `::after` y la celda de `ui/` le saca el padding derecho:
                    // en la última columna salía por fuera de la tabla (medido
                    // en `/armaduras-3d`).
                    className={`text-center ${i === 0 ? "border-l" : ""} ${
                      i === nodeAxes.length - 1 && !useDofNumbers ? "[&:has([role=checkbox])]:pr-4" : ""
                    }`}
                  >
                    <Checkbox
                      checked={node[restrainedFieldByAxis[axis]]}
                      onCheckedChange={() => toggleRestrained({ id: node.id, axis })}
                      aria-label={`Restringir ${node.name} en ${axisLabel(axis, "θ")}`}
                    />
                  </TableCell>
                ))}

                {useDofNumbers &&
                  nodeAxes.map((axis, i) => (
                    <TableCell key={`dof-${axis}`} className={i === 0 ? "border-l" : undefined}>
                      <FormulaInput
                        className="w-16"
                        decimals={0}
                        value={node[dofNumberFieldByAxis[axis]]}
                        onChange={(value) => updateField({ id: node.id, field: dofNumberFieldByAxis[axis], value })}
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
