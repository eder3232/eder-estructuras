"use client";

import { useState } from "react";

import { FrameElement2D, type AssemblyResult } from "@/lib/engine";
import { DecimalsScope } from "@/components/custom/decimals-scope";
import { Math, MathBlock } from "@/components/custom/math";
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
 * Modo práctica, con los dos ejercicios de los otros sistemas: **dónde** aporta
 * una barra y **cuánto**.
 *
 * El segundo es, como en `/armaduras-3d`, **un bloque de 3×3**: el del nudo de
 * origen en ejes globales, y no la 6×6 entera (decisión del 2026-10-17, ver
 * `docs/frame2d-v1.md`). Con una diferencia que el ejercicio enseña: en un
 * pórtico los otros tres bloques **no** son este con el signo cambiado —el de
 * acoplamiento lleva `2EI/L` donde este lleva `4EI/L`—, así que acá no se dice
 * eso.
 *
 * Arranca apagado: la página es material de estudio, no un examen.
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

            {/* La fórmula va afuera del ejercicio y no en su `instruction`: la
                instrucción va dentro de un `<p>`, y un bloque de KaTeX es un
                `div` (lo marcó la consola como error de hidratación). */}
            <div className="flex flex-col gap-1 text-sm text-muted-foreground">
              <span>
                El bloque del nudo de origen en ejes globales sale de <Math tex="T^{T} k\, T" />, con{" "}
                <Math tex="c = \Delta x/L" /> y <Math tex="s = \Delta z/L" />:
              </span>
              <MathBlock tex="K_{ii} = \def\arraystretch{2.2}\begin{bmatrix} \frac{EA}{L}c^2 + \frac{12EI}{L^3}s^2 & \left(\frac{EA}{L} - \frac{12EI}{L^3}\right)cs & -\frac{6EI}{L^2}s \\ \left(\frac{EA}{L} - \frac{12EI}{L^3}\right)cs & \frac{EA}{L}s^2 + \frac{12EI}{L^3}c^2 & \frac{6EI}{L^2}c \\ -\frac{6EI}{L^2}s & \frac{6EI}{L^2}c & \frac{4EI}{L} \end{bmatrix}" />
            </div>

            <ValuesQuiz
              key={`val-${element.id}`}
              rowLabels={dofLabels.map((axis) => `${from.name}${axis}`)}
              colLabels={dofLabels.map((axis) => `${from.name}${axis}`)}
              expected={originBlockOf(element, from, to)}
              title={`El bloque de ${from.name} en la matriz de ${element.name}`}
              instruction={
                <>
                  completá el bloque de 3×3 del nudo de origen con la fórmula de arriba. En una barra horizontal o
                  vertical la mitad de los términos se van. Podés escribir la cuenta (
                  <code className="text-xs">4*2e7*0.0031/5</code>) en vez del resultado.
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
    const k = new FrameElement2D(
      element.id,
      { id: from.id, x: from.x, z: from.z },
      { id: to.id, x: to.x, z: to.z },
      element.area,
      element.elasticity,
      element.inertia,
    ).stiffness();
    return k.slice(0, 3).map((row) => row.slice(0, 3));
  } catch {
    return [[0]];
  }
}
