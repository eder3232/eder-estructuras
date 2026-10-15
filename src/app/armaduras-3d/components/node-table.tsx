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
} from "../store/nodes";

/** Los grupos de columnas numéricas, en el orden de la tabla. */
const NUMBER_GROUPS = [
  { title: "Coordenadas", fieldByAxis: coordinateFieldByAxis },
  { title: "Fuerza", fieldByAxis: forceFieldByAxis },
  { title: "Desplazamiento", fieldByAxis: displacementFieldByAxis },
] as const;

/**
 * La tabla de nudos de una armadura espacial: con tres ejes son 12 columnas de
 * datos, 15 con la numeración manual.
 *
 * El encabezado va en dos niveles, la magnitud arriba y el eje abajo, igual que
 * en `/armaduras-2d` (U1). Acá hacía más falta: con una columna por eje y un
 * rótulo de una letra, nada le daba ancho a las coordenadas y quedaban
 * **aplastadas** hasta no leerse (hallazgo 2 del paso 0, ver
 * docs/armaduras-3d-v1.md). Por eso las celdas numéricas llevan además un
 * ancho mínimo propio: el rótulo del grupo ya no es lo que lo fija.
 *
 * Las columnas se generan iterando `nodeAxes`: agregar un eje no obliga a
 * tocar el JSX en cinco lugares.
 */
export function NodeTable() {
  const [nodes] = useAtom(atomNodes);
  const [useDofNumbers] = useAtom(atomUseDofNumbers);
  const addNode = useSetAtom(atomAddNode);
  const removeNode = useSetAtom(atomRemoveNode);
  const toggleRestrained = useSetAtom(atomToggleNodeRestrained);
  const updateField = useSetAtom(atomUpdateNodeField);
  const toggleUseDofNumbers = useSetAtom(atomToggleUseDofNumbers);
  const rowHighlight = useHighlightRows();

  const groupTitles = [
    ...NUMBER_GROUPS.map((group) => group.title),
    "Restringido",
    ...(useDofNumbers ? ["Grado de libertad"] : []),
  ];

  return (
    <div className="flex flex-col gap-3">
      {/* Arriba de la tabla porque lo que hace es agregarle columnas (ver la
          misma tabla de `/armaduras-2d`). */}
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
              {groupTitles.map((title) => (
                <TableHead key={title} colSpan={nodeAxes.length} className="h-9 border-l text-center">
                  {title}
                </TableHead>
              ))}
            </TableRow>
            <TableRow>
              {groupTitles.map((title) => (
                <Fragment key={title}>
                  {nodeAxes.map((axis, i) => (
                    <TableHead key={axis} className={`h-8 text-center ${i === 0 ? "border-l" : ""}`}>
                      {axis.toUpperCase()}
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
                    className="w-24"
                    defaultValue={node.name}
                    onBlur={(e) => updateField({ id: node.id, field: "name", value: e.target.value })}
                  />
                </TableCell>

                {NUMBER_GROUPS.map((group) =>
                  nodeAxes.map((axis, i) => {
                    const field = group.fieldByAxis[axis];
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
                    // El `Checkbox` de `ui/` agranda su área de click 12 px hacia
                    // cada lado con un `::after`, y la celda de `ui/` le saca el
                    // padding derecho a las que tienen un checkbox. En la última
                    // columna eso salía 3 px por fuera de la tabla, medido, y
                    // alcanzaba para una barra de scroll sobre una tabla que entra.
                    className={`text-center ${i === 0 ? "border-l" : ""} ${
                      i === nodeAxes.length - 1 && !useDofNumbers ? "[&:has([role=checkbox])]:pr-4" : ""
                    }`}
                  >
                    <Checkbox
                      checked={node[restrainedFieldByAxis[axis]]}
                      onCheckedChange={() => toggleRestrained({ id: node.id, axis })}
                      aria-label={`Restringir ${node.name} en ${axis}`}
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
