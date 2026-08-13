import { atom } from "jotai";
import { SingularStiffnessError, System, TrussElement2D, type SolveResult } from "@/lib/engine";
import { atomNodes, type NodeRow } from "./nodes";
import { atomElements } from "./elements";

import type { DomainError } from "@/components/custom/errors-panel";

export type Armaduras2DResults =
  | { status: "ok"; solved: SolveResult; nodesById: Map<string, NodeRow> }
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

export const atomResults = atom<Armaduras2DResults>((get) => {
  const nodes = get(atomNodes);
  const elements = get(atomElements);
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
      });
    } catch (e) {
      errors.push({ source: "node", refId: node.id, message: e instanceof Error ? e.message : String(e) });
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
      errors.push({ source: "element", refId: element.id, message: e instanceof Error ? e.message : String(e) });
    }
  }

  if (errors.length > 0) {
    return { status: "error", errors, nodesById };
  }

  try {
    return { status: "ok", solved: system.solve(), nodesById };
  } catch (e) {
    return {
      status: "error",
      errors: [
        {
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
