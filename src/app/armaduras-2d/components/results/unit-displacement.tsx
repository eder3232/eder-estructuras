"use client";

import { useState } from "react";

import { TrussElement2D, unitDisplacementState, type AssemblyResult, type TrussInternalForce } from "@/lib/engine";
import { DecimalsScope, ScopeDecimalsStepper } from "@/components/custom/decimals-scope";
import { DeformedDiagram } from "@/components/custom/diagram-2d/deformed-diagram";
import type { DiagramForce } from "@/components/custom/diagram-2d/types";
import { Math as Tex } from "@/components/custom/math";
import { MatrixTable } from "@/components/custom/matrix-table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ElementRow } from "../../store/elements";
import type { NodeRow } from "../../store/nodes";

interface UnitDisplacementProps {
  elements: ElementRow[];
  nodesById: Map<string, NodeRow>;
  assembly: AssemblyResult;
}

const AXIS_LABEL = ["x", "z"];

/**
 * El experimento que **define** a la matriz de rigidez, dibujado.
 *
 * `k_ij` es la fuerza que aparece en el grado de libertad *i* cuando se impone
 * un desplazamiento unitario en el *j* y todos los demás se mantienen en cero.
 * O sea que una columna de `K` no es una lista de números: es un experimento
 * físico completo. Los números ya estaban en pantalla desde el principio; lo
 * que faltaba era poder *verlo*, que es lo único que un libro no puede hacer.
 *
 * Va acá, debajo de la matriz global, y no en una sección propia: habla de la
 * matriz que está justo arriba, y separarlas obligaría a recordar los números
 * mientras se scrollea.
 */
export function UnitDisplacement({ elements, nodesById, assembly }: UnitDisplacementProps) {
  const nodes = [...nodesById.values()];
  const labelOf = (entry: AssemblyResult["dofOrder"][number]) =>
    `${nodesById.get(entry.nodeId)?.name ?? entry.nodeId}${AXIS_LABEL[entry.localDof]}`;

  // El primer DOF libre: empezar por uno restringido mostraría una estructura
  // que se mueve desde un apoyo, que es el caso menos intuitivo de los dos.
  const firstFree = assembly.dofOrder.find((e) => !e.restrained) ?? assembly.dofOrder[0];
  const [selected, setSelected] = useState(firstFree.globalIndex);
  const entry = assembly.dofOrder.find((e) => e.globalIndex === selected) ?? firstFree;

  const { displacements, forces } = unitDisplacementState(assembly, entry.globalIndex);

  const diagramDisplacements = new Map<string, [number, number]>(
    nodes.map((n) => {
      const [dx, dz] = displacements.get(n.id) ?? [0, 0];
      return [n.id, [dx, dz]];
    }),
  );

  const diagramForces: DiagramForce[] = forces.map((force) => {
    const node = nodesById.get(force.nodeId)!;
    return {
      nodeId: force.nodeId,
      x: node.x,
      z: node.z,
      axis: force.localDof === 0 ? "x" : "z",
      value: force.value,
    };
  });

  // La fuerza interna que aparece en cada barra bajo ese desplazamiento: es lo
  // que explica *por qué* la columna vale lo que vale — las barras que se
  // estiran son las que ponen los números. Se construye el mismo elemento que
  // usa el motor, igual que en `local-stiffness-list.tsx`, en vez de rehacer la
  // geometría acá.
  const elementForceValue = new Map<string, number>();
  for (const element of elements) {
    const from = nodesById.get(element.fromNodeId);
    const to = nodesById.get(element.toNodeId);
    if (!from || !to) continue;
    try {
      const truss = new TrussElement2D(
        element.id,
        { id: from.id, x: from.x, z: from.z },
        { id: to.id, x: to.x, z: to.z },
        element.area,
        element.elasticity,
      );
      const internal = truss.internalForce([
        displacements.get(from.id) ?? [0, 0],
        displacements.get(to.id) ?? [0, 0],
      ]) as TrussInternalForce;
      elementForceValue.set(element.id, internal.axialForce);
    } catch {
      // Área o longitud inválidas: el panel de errores ya lo está diciendo.
    }
  }

  const columna = forces.map((f) => [f.value]);
  const etiquetas = assembly.dofOrder.map(labelOf);

  return (
    <DecimalsScope id="unit">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">Imponer un desplazamiento de 1 en:</span>
          <Select value={String(selected)} onValueChange={(value) => setSelected(Number(value))}>
            <SelectTrigger size="sm" className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {assembly.dofOrder.map((dof) => (
                <SelectItem key={dof.globalIndex} value={String(dof.globalIndex)}>
                  {labelOf(dof)}
                  {dof.restrained ? " (apoyo)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <ScopeDecimalsStepper />
        </div>

        <p className="text-sm text-muted-foreground">
          Se mueve <span className="font-medium text-foreground">solo</span> ese grado de libertad, una unidad, y se
          sostienen todos los demás en cero. Las fuerzas que hacen falta para lograrlo{" "}
          <span className="font-medium text-foreground">son la columna {labelOf(entry)} de la matriz</span> de acá
          arriba — no se parecen a la columna: <em>son</em> la columna. Eso es lo que dice{" "}
          <Tex tex="k_{ij}" />: la fuerza en <Tex tex="i" /> cuando <Tex tex="j" /> se desplaza una unidad.
        </p>

        <div className="flex flex-wrap items-start gap-6">
          <DeformedDiagram
            nodes={nodes}
            elements={elements}
            displacements={diagramDisplacements}
            reactions={diagramForces}
            elementForceValue={elementForceValue}
            scale={{ initial: 1, max: 4, step: 0.1 }}
            showZeroAxialLabels={false}
            legend={
              <>
                Línea punteada: la estructura sin mover. Línea sólida: con {labelOf(entry)} desplazado una unidad.
                Las flechas son las fuerzas que hay que aplicar para sostener esa configuración, y el número sobre
                cada barra es la fuerza interna que le aparece: las barras que se estiran o se acortan son las que
                ponen los números de la columna.
              </>
            }
          />

          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium">Columna {labelOf(entry)}</span>
            <MatrixTable matrix={columna} rowLabels={etiquetas} colLabels={[labelOf(entry)]} stickyLabels />
          </div>
        </div>
      </div>
    </DecimalsScope>
  );
}
