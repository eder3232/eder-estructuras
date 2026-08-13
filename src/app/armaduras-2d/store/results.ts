import { atom } from "jotai";
import { SingularStiffnessError, System, TrussElement2D, type SolveResult, type SolveWarning } from "@/lib/engine";
import { atomNodes, type NodeRow } from "./nodes";
import { atomElements, type ElementRow } from "./elements";
import { atomRestrainedFirst, atomUseDofNumbers } from "./dof-order";

import type { DomainError, DomainIssue } from "@/components/custom/errors-panel";

export type Armaduras2DResults =
  /**
   * Hay resultados **y** puede haber advertencias: son dos cosas que conviven.
   * Un aviso nunca tira los resultados abajo — ver `docs/errores.md`.
   */
  | { status: "ok"; solved: SolveResult; warnings: DomainIssue[]; nodesById: Map<string, NodeRow> }
  | { status: "error"; errors: DomainError[]; nodesById: Map<string, NodeRow> }
  /**
   * No hay error: no hay todavía un modelo que resolver. Es un estado del
   * dominio y no de la pantalla —"¿hay algo que calcular?" se responde con los
   * datos, no con el layout—, así que se decide acá y no en el panel.
   */
  | {
      status: "empty";
      reason: "no-nodes" | "no-elements";
      nodeCount: number;
      nodesById: Map<string, NodeRow>;
    };

/**
 * Le pone nombre a lo que el motor solo sabe señalar por id.
 *
 * El motor no conoce los nombres a propósito —son de la UI, y cambiarlos no
 * debería recalcular nada—, así que la advertencia viaja con `refId` y el
 * nombre se resuelve acá, que es donde está la tabla.
 */
function toIssues(
  warnings: SolveWarning[],
  nodesById: Map<string, NodeRow>,
  elements: ElementRow[],
): DomainIssue[] {
  return warnings.map((warning) => ({
    ...warning,
    severity: "warning" as const,
    refName:
      warning.source === "node"
        ? nodesById.get(warning.refId)?.name
        : warning.source === "element"
          ? elements.find((e) => e.id === warning.refId)?.name
          : undefined,
  }));
}

export const atomResults = atom<Armaduras2DResults>((get) => {
  const nodes = get(atomNodes);
  const elements = get(atomElements);
  const restrainedFirst = get(atomRestrainedFirst);
  const useDofNumbers = get(atomUseDofNumbers);
  const nodesById = new Map(nodes.map((n) => [n.id, n]));

  // Antes de armar el sistema, y el orden importa. Un modelo con nudos y sin
  // barras llega igual a `solve()`: la `Kff` sale toda de ceros y el motor lo
  // reporta —con razón— como un mecanismo. Pero "cada grado de libertad está
  // suelto" es una respuesta rebuscada para "todavía no cargaste las barras".
  if (nodes.length === 0 || elements.length === 0) {
    return {
      status: "empty",
      reason: nodes.length === 0 ? "no-nodes" : "no-elements",
      nodeCount: nodes.length,
      nodesById,
    };
  }

  const system = new System(2);
  const errors: DomainError[] = [];

  for (const node of nodes) {
    try {
      system.addNode({
        id: node.id,
        restrained: [node.restrainedX, node.restrainedZ],
        force: [node.forceX, node.forceZ],
        displacement: [node.displacementX, node.displacementZ],
        dofNumbers: [node.dofNumberX, node.dofNumberZ],
      });
    } catch (e) {
      errors.push({
        source: "node",
        refId: node.id,
        refName: node.name,
        severity: "error",
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  for (const element of elements) {
    try {
      const from = nodesById.get(element.fromNodeId);
      const to = nodesById.get(element.toNodeId);
      if (!from || !to) {
        throw new Error(`El elemento ${element.name} referencia un nudo inexistente.`);
      }
      system.addElement(
        new TrussElement2D(
          element.id,
          { id: from.id, x: from.x, z: from.z },
          { id: to.id, x: to.x, z: to.z },
          element.area,
          element.elasticity,
        ),
      );
    } catch (e) {
      errors.push({
        source: "element",
        refId: element.id,
        refName: element.name,
        severity: "error",
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  if (errors.length > 0) {
    return { status: "error", errors, nodesById };
  }

  try {
    const solved = system.solve({ restrainedFirst, useDofNumbers });
    return { status: "ok", solved, warnings: toIssues(solved.warnings, nodesById, elements), nodesById };
  } catch (e) {
    return {
      status: "error",
      errors: [
        {
          severity: "error",
          source: "element",
          refId: "-",
          message: e instanceof Error ? e.message : String(e),
          // El motor no solo dice que no pudo: dice **por qué** y cómo se mueve
          // la estructura. Eso se lleva a la UI para poder dibujarlo.
          mechanism: e instanceof SingularStiffnessError ? e.diagnosis : undefined,
        },
      ],
      nodesById,
    };
  }
});
