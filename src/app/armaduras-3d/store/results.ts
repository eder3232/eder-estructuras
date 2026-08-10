import { atom } from "jotai";
import { System, TrussElement3D, type SolveResult } from "@/lib/engine";
import { atomNodes, type NodeRow } from "./nodes";
import { atomElements } from "./elements";

import type { DomainError } from "@/components/custom/errors-panel";

export type Armaduras3DResults =
  | { status: "ok"; solved: SolveResult; nodesById: Map<string, NodeRow> }
  | { status: "error"; errors: DomainError[]; nodesById: Map<string, NodeRow> };

export const atomResults = atom<Armaduras3DResults>((get) => {
  const nodes = get(atomNodes);
  const elements = get(atomElements);
  const nodesById = new Map(nodes.map((n) => [n.id, n]));

  const system = new System(3);
  const errors: DomainError[] = [];

  for (const node of nodes) {
    try {
      system.addNode({
        id: node.id,
        restrained: [node.restrainedX, node.restrainedY, node.restrainedZ],
        force: [node.forceX, node.forceY, node.forceZ],
        displacement: [node.displacementX, node.displacementY, node.displacementZ],
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
        new TrussElement3D(
          element.id,
          { id: from.id, x: from.x, y: from.y, z: from.z },
          { id: to.id, x: to.x, y: to.y, z: to.z },
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
      errors: [{ source: "element", refId: "-", message: e instanceof Error ? e.message : String(e) }],
      nodesById,
    };
  }
});
