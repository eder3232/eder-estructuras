"use client";

import { useState } from "react";

import { TrussElement3D, type AssemblyResult } from "@/lib/engine";
import { DecimalsScope } from "@/components/custom/decimals-scope";
import { Math } from "@/components/custom/math";
import { cellKey, type CellKey } from "@/components/custom/matrix-quiz-check";
import { PositionsQuiz, ValuesQuiz } from "@/components/custom/matrix-quiz";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { ElementRow } from "../../store/elements";
import { dofLabels, type NodeRow } from "../../store/nodes";

interface PracticeModeProps {
  elements: ElementRow[];
  nodesById: Map<string, NodeRow>;
  assembly: AssemblyResult;
}

/**
 * Modo práctica, con los dos ejercicios de `/armaduras-2d`: **dónde** aporta
 * una barra y **cuánto**.
 *
 * El segundo es distinto en 3D: se completa **un bloque de 3×3**, el del nudo
 * de origen, y no la 6×6 entera (docs/armaduras-3d-v1.md, decisión 7). Las 36
 * celdas son cuatro copias del mismo bloque con el signo cambiado; pedirlas
 * todas sería repetir nueve cuentas cuatro veces, y lo que hay que aprender es
 * justamente que alcanza con una.
 *
 * Arranca apagado por lo mismo que en 2D: la página es material de estudio, no
 * un examen.
 */
export function PracticeMode({ elements, nodesById, assembly }: PracticeModeProps) {
  const [enabled, setEnabled] = useState(false);
  const [elementId, setElementId] = useState(elements[0]?.id ?? "");

  const element = elements.find((e) => e.id === elementId) ?? elements[0];
  const from = element ? nodesById.get(element.fromNodeId) : undefined;
  const to = element ? nodesById.get(element.toNodeId) : undefined;

  const globalLabels = assembly.dofOrder.map(
    (entry) => `${nodesById.get(entry.nodeId)?.name ?? entry.nodeId}${dofLabels[entry.localDof]}`,
  );

  return (
    <DecimalsScope id="practice">
      <div className="flex flex-col gap-4 rounded-md border border-dashed p-4">
        <div className="flex flex-wrap items-center gap-3">
          <Switch id="practice-mode" checked={enabled} onCheckedChange={setEnabled} />
          <Label htmlFor="practice-mode" className="font-medium">
            Modo práctica
          </Label>
          <span className="text-sm text-muted-foreground">
            Resolvelo vos y comparalo con lo que calcula la app.
          </span>
        </div>

        {enabled && element && from && to && (
          <>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted-foreground">Barra:</span>
              <Select value={element.id} onValueChange={setElementId}>
                <SelectTrigger size="sm" className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {elements.map((row) => {
                    const a = nodesById.get(row.fromNodeId)?.name ?? "?";
                    const b = nodesById.get(row.toNodeId)?.name ?? "?";
                    return (
                      <SelectItem key={row.id} value={row.id}>
                        {row.name} ({a}↔{b})
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <PositionsQuiz
              key={`pos-${element.id}`}
              labels={globalLabels}
              expected={positionsOf(assembly, element)}
              title={`¿Dónde aporta ${element.name}?`}
            />

            <ValuesQuiz
              key={`val-${element.id}`}
              rowLabels={dofLabels.map((axis) => `${from.name}${axis}`)}
              colLabels={dofLabels.map((axis) => `${from.name}${axis}`)}
              expected={originBlockOf(element, from, to)}
              title={`El bloque de ${from.name} en la matriz de ${element.name}`}
              instruction={
                <>
                  completá el bloque de 3×3 del nudo de origen, cuyas celdas son <Math tex="\frac{EA}{L}\,C_i\,C_j" />.
                  Los otros tres bloques de la barra son este mismo con el signo cambiado. Podés escribir la cuenta (
                  <code className="text-xs">2e7*0.002/3*0.5*0.5</code>) en vez del resultado.
                </>
              }
            />
          </>
        )}
      </div>
    </DecimalsScope>
  );
}

/**
 * Las 36 posiciones de la matriz global donde una barra suma algo: el producto
 * cruzado de los 6 grados de libertad de sus dos nudos, sacados del `dofOrder`
 * real para que el ejercicio no se desincronice del ensamblaje.
 */
function positionsOf(assembly: AssemblyResult, element: ElementRow): CellKey[] {
  const indexOf = (nodeId: string, localDof: number) =>
    assembly.dofOrder.findIndex((e) => e.nodeId === nodeId && e.localDof === localDof);

  const dofs = [element.fromNodeId, element.toNodeId]
    .flatMap((nodeId) => [0, 1, 2].map((axis) => indexOf(nodeId, axis)))
    .filter((i) => i >= 0);

  return dofs.flatMap((row) => dofs.map((col) => cellKey(row, col)));
}

/** El bloque 3×3 del nudo de origen, recortado de la `K` que calcula el motor. */
function originBlockOf(element: ElementRow, from: NodeRow, to: NodeRow): number[][] {
  try {
    const k = new TrussElement3D(
      element.id,
      { id: from.id, x: from.x, y: from.y, z: from.z },
      { id: to.id, x: to.x, y: to.y, z: to.z },
      element.area,
      element.elasticity,
    ).stiffness();
    return k.slice(0, 3).map((row) => row.slice(0, 3));
  } catch {
    return [[0]];
  }
}
