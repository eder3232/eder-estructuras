"use client";

import { useState } from "react";

import type { AssemblyResult } from "@/lib/engine";
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

/**
 * Modo práctica: la app deja de mostrar el resultado y lo pregunta. Los mismos
 * dos ejercicios que `/armaduras-2d` —**dónde** aporta un resorte en la matriz
 * global, y **cuánto**— con los componentes de quiz genéricos.
 *
 * **Arranca apagado**: la página es material de estudio, no un examen.
 *
 * Los dos corrigen contra el motor: las posiciones salen del mismo mapa con
 * que se ensambla (`AssemblyStep.dofs`), así que el ejercicio no se puede
 * desincronizar del cálculo aunque el alumno haya cambiado el orden de los
 * grados de libertad.
 */
export function PracticeMode({ elements, nodesById, assembly }: PracticeModeProps) {
  const [enabled, setEnabled] = useState(false);
  const [elementId, setElementId] = useState(elements[0]?.id ?? "");

  const element = elements.find((e) => e.id === elementId) ?? elements[0];
  const from = element ? nodesById.get(element.fromNodeId) : undefined;
  const to = element ? nodesById.get(element.toNodeId) : undefined;
  const dofs = element ? assembly.steps.find((step) => step.elementId === element.id)?.dofs : undefined;
  const globalLabels = assembly.dofOrder.map((entry) => nodesById.get(entry.nodeId)?.name ?? entry.nodeId);

  return (
    <DecimalsScope id="practice">
      <div className="flex flex-col gap-4 rounded-md border border-dashed p-4">
        <div className="flex flex-wrap items-center gap-3">
          <Switch id="practice-mode" checked={enabled} onCheckedChange={setEnabled} />
          <Label htmlFor="practice-mode" className="font-medium">
            Modo práctica
          </Label>
          <span className="text-sm text-muted-foreground">Resolvelo vos y comparalo con lo que calcula la app.</span>
        </div>

        {enabled && element && from && to && dofs && (
          <>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted-foreground">Resorte:</span>
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
              expected={positionsOf(dofs)}
              title={`¿Dónde aporta ${element.name}?`}
              instruction="hacé click en cada posición de la matriz global donde ese resorte suma algo."
            />

            <ValuesQuiz
              key={`val-${element.id}`}
              rowLabels={[from.name, to.name]}
              colLabels={[from.name, to.name]}
              expected={[
                [element.k, -element.k],
                [-element.k, element.k],
              ]}
              title={`La matriz de ${element.name}`}
              instruction="completá la matriz de rigidez de ese resorte. Ojo con los signos: cada fila tiene que sumar cero."
            />
          </>
        )}
      </div>
    </DecimalsScope>
  );
}

/** Las 4 celdas de la matriz global donde suma un resorte: el producto cruzado de sus dos grados de libertad. */
function positionsOf(dofs: number[]): CellKey[] {
  return dofs.flatMap((row) => dofs.map((col) => cellKey(row, col)));
}
