import { useState } from "react";

import { cellContributions, type AssemblyResult, type SolveResult } from "@/lib/engine";
import { useHighlight, useSetHighlight } from "@/components/custom/highlight";
import { useDecimals } from "@/components/custom/decimals-scope";
import { GlobalEquation as GenericGlobalEquation } from "@/components/custom/global-equation";
import { SchemaDiagram } from "@/components/custom/diagram-2d/schema-diagram";
import type { DiagramSupport } from "@/components/custom/diagram-2d/types";
import type { ElementRow } from "../../store/elements";
import type { NodeRow } from "../../store/nodes";

interface GlobalEquationProps {
  assembly: AssemblyResult;
  solved: SolveResult;
  nodesById: Map<string, NodeRow>;
  elements: ElementRow[];
}

/** El `Math` de JS, que acá está tapado por el componente de KaTeX del mismo nombre. */
const globalMath = globalThis.Math;

const AXIS_LABEL = ["x", "z"];

/**
 * La ecuación global genérica (`custom/global-equation.tsx`) con lo que es de
 * armaduras: los dos ejes, y el vínculo matriz ↔ modelo (N4) — pasar el mouse
 * por una celda de `K` enciende las barras que aportan ahí, en el dibujo.
 */
export function GlobalEquation({ assembly, solved, nodesById, elements }: GlobalEquationProps) {
  const { dofOrder } = assembly;
  const setHighlight = useSetHighlight();
  const [cell, setCell] = useState<[number, number] | null>(null);
  const elementNodeIds = elements.map((e) => ({ id: e.id, nodeIds: [e.fromNodeId, e.toNodeId] }));

  return (
    <GenericGlobalEquation
      assembly={assembly}
      solved={solved}
      labelOf={(entry) => `${nodesById.get(entry.nodeId)?.name ?? entry.nodeId}${AXIS_LABEL[entry.localDof]}`}
      forceOf={(entry) => {
        const node = nodesById.get(entry.nodeId)!;
        return entry.localDof === 0 ? node.forceX : node.forceZ;
      }}
      onCellHover={(hovered) => {
        setCell(hovered);
        if (!hovered) return setHighlight(null);
        const [row, col] = hovered;
        setHighlight({
          nodeIds: [dofOrder[row].nodeId, dofOrder[col].nodeId],
          elementIds: cellContributions(assembly.steps, elementNodeIds, dofOrder, row, col).map((c) => c.elementId),
        });
      }}
    >
      <WhoContributes assembly={assembly} cell={cell} elements={elements} nodesById={nodesById} />
    </GenericGlobalEquation>
  );
}

/**
 * De dónde sale el número de la celda que tiene el mouse encima.
 *
 * Responde *¿por qué aparece un número acá y no en la de al lado?*, que es lo
 * que no se entiende del método matricial. Y la respuesta es **topológica**:
 * una barra aporta a `K[i][j]` si toca los dos nudos, el de la fila y el de la
 * columna. Por eso los ceros de la matriz global son pares de nudos que ninguna
 * barra conecta — se ve en el dibujo antes que en la cuenta.
 *
 * El dibujo va **al lado de la matriz** y no se reusa el de arriba de la
 * página: cuando el mouse está en una celda de la sección 2, el esquema del
 * encabezado quedó a mil píxeles de scroll y no se ve. Un resaltado que no se
 * mira no existe.
 */
function WhoContributes({
  assembly,
  cell,
  elements,
  nodesById,
}: {
  assembly: AssemblyResult;
  cell: [number, number] | null;
  elements: ElementRow[];
  nodesById: Map<string, NodeRow>;
}) {
  const decimals = useDecimals();
  const highlight = useHighlight();
  const { dofOrder } = assembly;

  const nodes = [...nodesById.values()];
  const supports: DiagramSupport[] = nodes
    .filter((n) => n.restrainedX || n.restrainedZ)
    .map((n) => ({ nodeId: n.id, x: n.x, z: n.z, restrainedX: n.restrainedX, restrainedZ: n.restrainedZ }));

  const contribuciones = cell
    ? cellContributions(
        assembly.steps,
        elements.map((e) => ({ id: e.id, nodeIds: [e.fromNodeId, e.toNodeId] })),
        dofOrder,
        cell[0],
        cell[1],
      )
    : [];

  const nombre = (index: number) => {
    const entry = dofOrder[index];
    return `${nodesById.get(entry.nodeId)?.name ?? entry.nodeId}${AXIS_LABEL[entry.localDof]}`;
  };

  return (
    <div className="flex flex-wrap items-start gap-4 rounded-md border border-dashed p-3">
      <SchemaDiagram
        nodes={nodes}
        elements={elements}
        supports={supports}
        forces={[]}
        highlight={highlight}
        className="h-56 w-56 md:h-56 md:w-56"
      />
      <div className="flex max-w-md flex-col gap-1 text-sm">
        {cell === null ? (
          <p className="text-muted-foreground">
            <span className="font-medium text-foreground">Pasá el mouse por una celda de K</span> y acá se dibuja de
            dónde sale ese número: una barra aporta a una celda solo si toca <span className="italic">los dos</span>{" "}
            nudos, el de la fila y el de la columna. Por eso los ceros son pares de nudos que ninguna barra conecta.
          </p>
        ) : (
          <>
            <p>
              Celda{" "}
              <span className="font-medium">
                {nombre(cell[0])} · {nombre(cell[1])}
              </span>
              {contribuciones.length === 0 ? (
                <>
                  : <span className="font-medium text-foreground">ninguna barra conecta esos dos nudos</span>, así
                  que vale cero. No es que la cuenta diera cero — es que no hay nada que sumar.
                </>
              ) : (
                <>
                  {" "}
                  — le aportan {contribuciones.length === 1 ? "una barra" : `${contribuciones.length} barras`}:
                </>
              )}
            </p>
            {contribuciones.length > 0 && (
              <ul className="flex flex-col gap-0.5 text-muted-foreground">
                {contribuciones.map((c) => {
                  const barra = elements.find((e) => e.id === c.elementId);
                  return (
                    <li key={c.elementId} className="tabular-nums">
                      <span className="font-medium text-foreground">{barra?.name ?? c.elementId}</span>:{" "}
                      {c.value.toFixed(decimals)}
                      {globalMath.abs(c.value) < 1e-9 && (
                        <span className="ml-1 italic">
                          — toca los dos nudos, pero no tiene rigidez en esa dirección
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  );
}
