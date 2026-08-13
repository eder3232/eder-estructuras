import { atom } from "jotai";
import { SpringElement, System, type SolveResult } from "@/lib/engine";
import { atomNodes, type NodeRow } from "./nodes";
import { atomElements } from "./elements";

import type { DomainError } from "@/components/custom/errors-panel";

export type SpringsResults =
  | { status: "ok"; solved: SolveResult; nodesById: Map<string, NodeRow> }
  | { status: "error"; errors: DomainError[]; nodesById: Map<string, NodeRow> };

export const atomResults = atom<SpringsResults>((get) => {
  const nodes = get(atomNodes);
  const elements = get(atomElements);
  const nodesById = new Map(nodes.map((n) => [n.id, n]));

  const system = new System(1);
  const errors: DomainError[] = [];

  for (const node of nodes) {
    try {
      system.addNode({
        id: node.id,
        restrained: [node.restrained],
        force: [node.force],
        displacement: [node.displacement],
      });
    } catch (e) {
      errors.push({ severity: "error", source: "node", refId: node.id, message: e instanceof Error ? e.message : String(e) });
    }
  }

  for (const element of elements) {
    try {
      system.addElement(new SpringElement(element.id, [element.fromNodeId, element.toNodeId], element.k));
    } catch (e) {
      errors.push({ severity: "error", source: "element", refId: element.id, message: e instanceof Error ? e.message : String(e) });
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
      errors: [{ severity: "error", source: "element", refId: "-", message: e instanceof Error ? e.message : String(e) }],
      nodesById,
    };
  }
});
