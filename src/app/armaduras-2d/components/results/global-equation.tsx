import { useState } from "react";

import { cellContributions, type AssemblyResult, type SolveResult } from "@/lib/engine";
import { useHighlight, useSetHighlight } from "@/components/custom/highlight";
import { DecimalsScope, ScopeDecimalsStepper, useDecimals } from "@/components/custom/decimals-scope";
import { Math, MathBlock } from "@/components/custom/math";
import { EquationTerm, MathOp, MatrixEquation } from "@/components/custom/matrix-equation";
import { MatrixTable } from "@/components/custom/matrix-table";
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

/** Clase de una celda incógnita. Se resuelve en el paso siguiente, no se conoce todavía. */
const UNKNOWN = "bg-primary/15 font-semibold";

/**
 * El cierre del ensamblaje: la ecuación de rigidez del sistema completo, con la
 * matriz recién armada entre los vectores de fuerza y desplazamiento.
 *
 * Lo que agrega sobre el original —que mostraba las tres matrices y ya— es
 * **marcar cuáles de esos números son incógnitas**. Es la pregunta que se
 * responde al particionar, y sin señalarla la ecuación parece ya resuelta:
 * están todos los números a la vista, calculados, sin distinguir el dato de lo
 * que se dedujo. La tabla de grados de libertad ya lo dice en palabras; acá se
 * ve de un vistazo, y se ve **por qué hay que partir la matriz**: los conocidos
 * y los incógnitos están intercalados.
 */
export function GlobalEquation({ assembly, solved, nodesById, elements }: GlobalEquationProps) {
  const { dofOrder, globalStiffness } = assembly;
  const setHighlight = useSetHighlight();
  const [cell, setCell] = useState<[number, number] | null>(null);
  const elementNodeIds = elements.map((e) => ({ id: e.id, nodeIds: [e.fromNodeId, e.toNodeId] }));

  const labels = dofOrder.map(
    (entry) => `${nodesById.get(entry.nodeId)?.name ?? entry.nodeId}${AXIS_LABEL[entry.localDof]}`,
  );

  // En un DOF restringido la fuerza es la reacción (incógnita) y el
  // desplazamiento es el dato prescrito; en uno libre, al revés.
  const forces = dofOrder.map((entry) => {
    const node = nodesById.get(entry.nodeId)!;
    if (entry.restrained) return [solved.reactions.get(entry.nodeId)![entry.localDof]];
    return [entry.localDof === 0 ? node.forceX : node.forceZ];
  });

  const displacements = dofOrder.map((entry) => [
    solved.displacements.get(entry.nodeId)![entry.localDof],
  ]);

  return (
    <DecimalsScope id="global-equation">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">
            Con la matriz ya ensamblada, la ecuación de rigidez del sistema es:
          </span>
          <ScopeDecimalsStepper />
        </div>

        <MathBlock tex="\begin{bmatrix} F \end{bmatrix} = \begin{bmatrix} K \end{bmatrix} \cdot \begin{bmatrix} U \end{bmatrix}" />

        <MatrixEquation>
          <EquationTerm tex="F">
            <MatrixTable
              matrix={forces}
              rowLabels={labels}
              cellClass={(row) => (dofOrder[row].restrained ? UNKNOWN : undefined)}
            />
          </EquationTerm>
          <MathOp tex="=" />
          <EquationTerm tex="K">
            <MatrixTable
              matrix={globalStiffness}
              labels={labels}
              symmetricHighlight
              onCellHover={(hovered) => {
                setCell(hovered);
                if (!hovered) return setHighlight(null);
                const [row, col] = hovered;
                setHighlight({
                  nodeIds: [dofOrder[row].nodeId, dofOrder[col].nodeId],
                  elementIds: cellContributions(assembly.steps, elementNodeIds, dofOrder, row, col).map(
                    (c) => c.elementId,
                  ),
                });
              }}
            />
          </EquationTerm>
          <MathOp tex="\cdot" />
          <EquationTerm tex="U">
            <MatrixTable
              matrix={displacements}
              rowLabels={labels}
              cellClass={(row) => (dofOrder[row].restrained ? undefined : UNKNOWN)}
            />
          </EquationTerm>
        </MatrixEquation>

        <WhoContributes
          assembly={assembly}
          cell={cell}
          elements={elements}
          nodesById={nodesById}
        />

        {/* La instrucción de pasar el mouse se dice **una sola vez**, en el
            bloque de arriba. Este párrafo era el que la traía, y con el bloque
            nuevo quedaban dos textos seguidos empezando igual. */}
        <p className="text-xs text-muted-foreground">
          Al pasar el mouse se resalta además la celda <span className="font-medium text-foreground">simétrica</span>:{" "}
          <Math tex="k_{ij} = k_{ji}" />. La fuerza que aparece en <Math tex="i" /> cuando <Math tex="j" /> se
          desplaza una unidad es la misma que aparece en <Math tex="j" /> cuando se desplaza <Math tex="i" /> — por
          eso la matriz es simétrica, y no por casualidad.
        </p>

        <p className="text-xs text-muted-foreground">
          Las celdas resaltadas son las <span className="font-medium text-foreground">incógnitas</span>: en un nudo
          restringido se conoce el desplazamiento y falta la reacción; en uno libre, al revés. Como están
          intercaladas, no se puede despejar de una sola vez — de ahí la partición del paso siguiente.
        </p>
      </div>
    </DecimalsScope>
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
