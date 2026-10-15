import { atom } from "jotai";
import { SingularStiffnessError, System, TrussElement3D, type SolveResult, type SolveWarning } from "@/lib/engine";
import { atomNodes, type NodeRow } from "./nodes";
import { atomElements, type ElementRow } from "./elements";
import { atomRestrainedFirst, atomUseDofNumbers } from "./dof-order";

import type { DomainError, DomainIssue } from "@/components/custom/errors-panel";
import { displayNames, withDisplayNames } from "@/lib/display-names";

/** Los mismos tres estados que `/armaduras-2d`: ver allá el porqué de cada uno. */
export type Armaduras3DResults =
  | { status: "ok"; solved: SolveResult; warnings: DomainIssue[]; nodesById: Map<string, NodeRow> }
  | { status: "error"; errors: DomainError[]; nodesById: Map<string, NodeRow> }
  | {
      status: "empty";
      reason: "no-nodes" | "no-elements";
      nodeCount: number;
      nodesById: Map<string, NodeRow>;
    };

/** Le pone nombre a lo que el motor solo sabe señalar por id. */
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

export const atomResults = atom<Armaduras3DResults>((get) => {
  const nodes = get(atomNodes);
  const elements = get(atomElements);
  const restrainedFirst = get(atomRestrainedFirst);
  const useDofNumbers = get(atomUseDofNumbers);
  const nodesById = new Map(nodes.map((n) => [n.id, n]));

  // Sin barras no hay nada que resolver, y no un mecanismo: la `Kff` saldría
  // toda de ceros y el motor lo diría —con razón, pero de la forma más
  // rebuscada— como "cada grado de libertad está suelto" (B4).
  if (nodes.length === 0 || elements.length === 0) {
    return {
      status: "empty",
      reason: nodes.length === 0 ? "no-nodes" : "no-elements",
      nodeCount: nodes.length,
      nodesById,
    };
  }

  const system = new System(3);
  const errors: DomainError[] = [];
  // Los mensajes del motor nombran ids; acá se cambian por lo que ve el alumno (B2).
  const names = displayNames(nodes, elements);

  for (const node of nodes) {
    try {
      system.addNode({
        id: node.id,
        restrained: [node.restrainedX, node.restrainedY, node.restrainedZ],
        force: [node.forceX, node.forceY, node.forceZ],
        displacement: [node.displacementX, node.displacementY, node.displacementZ],
        dofNumbers: [node.dofNumberX, node.dofNumberY, node.dofNumberZ],
      });
    } catch (e) {
      errors.push({
        source: "node",
        refId: node.id,
        refName: node.name,
        severity: "error",
        message: withDisplayNames(e instanceof Error ? e.message : String(e), names),
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
        new TrussElement3D(
          element.id,
          { id: from.id, x: from.x, y: from.y, z: from.z },
          { id: to.id, x: to.x, y: to.y, z: to.z },
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
        message: withDisplayNames(e instanceof Error ? e.message : String(e), names),
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
          message: withDisplayNames(e instanceof Error ? e.message : String(e), names),
          mechanism: e instanceof SingularStiffnessError ? e.diagnosis : undefined,
        },
      ],
      nodesById,
    };
  }
});
