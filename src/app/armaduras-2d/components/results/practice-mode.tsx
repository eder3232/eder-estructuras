"use client";

import { useState } from "react";

import { TrussElement2D, type AssemblyResult } from "@/lib/engine";
import { DecimalsScope } from "@/components/custom/decimals-scope";
import { cellKey, type CellKey } from "@/components/custom/matrix-quiz-check";
import { PositionsQuiz, ValuesQuiz } from "@/components/custom/matrix-quiz";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { ElementRow } from "../../store/elements";
import type { NodeRow } from "../../store/nodes";

interface PracticeModeProps {
  elements: ElementRow[];
  nodesById: Map<string, NodeRow>;
  assembly: AssemblyResult;
}

const AXIS_LABEL = ["x", "z"];

/**
 * Modo práctica: la app deja de mostrar el resultado y lo pregunta.
 *
 * **Arranca apagado a propósito.** La página es material de estudio, no un
 * examen: quien entra a mirar cómo se resuelve una armadura no quiere que le
 * escondan los números. El interruptor lo pide quien ya leyó y quiere probarse.
 *
 * Son dos ejercicios y el orden importa: primero **dónde** aporta la barra
 * —clicks, el paso donde más se confunden— y después **cuánto**, que es la
 * cuenta. Los dos corrigen contra lo que calcula el motor, no contra valores
 * escritos a mano acá: si la fórmula del motor cambia, el ejercicio cambia con
 * ella.
 */
export function PracticeMode({ elements, nodesById, assembly }: PracticeModeProps) {
  const [enabled, setEnabled] = useState(false);
  const [elementId, setElementId] = useState(elements[0]?.id ?? "");

  const element = elements.find((e) => e.id === elementId) ?? elements[0];
  const from = element ? nodesById.get(element.fromNodeId) : undefined;
  const to = element ? nodesById.get(element.toNodeId) : undefined;

  const labelOf = (entry: AssemblyResult["dofOrder"][number]) =>
    `${nodesById.get(entry.nodeId)?.name ?? entry.nodeId}${AXIS_LABEL[entry.localDof]}`;
  const globalLabels = assembly.dofOrder.map(labelOf);

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
              rowLabels={[`${from.name}x`, `${from.name}z`, `${to.name}x`, `${to.name}z`]}
              colLabels={[`${from.name}x`, `${from.name}z`, `${to.name}x`, `${to.name}z`]}
              expected={stiffnessOf(element, from, to)}
              title={`La matriz de ${element.name} en ejes globales`}
            />
          </>
        )}
      </div>
    </DecimalsScope>
  );
}

/**
 * Las 16 posiciones de la matriz global donde una barra suma algo: el producto
 * cruzado de los 4 grados de libertad de sus dos nudos.
 *
 * Es la misma cuenta que hace `System` al ensamblar, y por eso el ejercicio no
 * puede "desincronizarse" del motor: las posiciones salen del `dofOrder` real.
 */
function positionsOf(assembly: AssemblyResult, element: ElementRow): CellKey[] {
  const indexOf = (nodeId: string, localDof: number) =>
    assembly.dofOrder.findIndex((e) => e.nodeId === nodeId && e.localDof === localDof);

  const dofs = [
    indexOf(element.fromNodeId, 0),
    indexOf(element.fromNodeId, 1),
    indexOf(element.toNodeId, 0),
    indexOf(element.toNodeId, 1),
  ].filter((i) => i >= 0);

  return dofs.flatMap((row) => dofs.map((col) => cellKey(row, col)));
}

/** La `K` de la barra en ejes globales, pedida al mismo elemento que usa el motor. */
function stiffnessOf(element: ElementRow, from: NodeRow, to: NodeRow): number[][] {
  try {
    return new TrussElement2D(
      element.id,
      { id: from.id, x: from.x, z: from.z },
      { id: to.id, x: to.x, z: to.z },
      element.area,
      element.elasticity,
    ).stiffness();
  } catch {
    return [[0]];
  }
}
