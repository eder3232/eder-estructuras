import { atom } from "jotai";
import { FrameElement2D, SingularStiffnessError, System, type SolveResult, type SolveWarning } from "@/lib/engine";
import { atomNodes, type NodeRow } from "./nodes";
import { atomElements, type ElementRow } from "./elements";

import type { DomainError, DomainIssue } from "@/components/custom/errors-panel";
import { displayNames, withDisplayNames } from "@/lib/display-names";

/** Los mismos tres estados que `/armaduras-2d`: ver allá el porqué de cada uno. */
export type Frame2DResults =
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

export const atomResults = atom<Frame2DResults>((get) => {
  const nodes = get(atomNodes);
  const elements = get(atomElements);
  const nodesById = new Map(nodes.map((n) => [n.id, n]));

  // Sin barras no hay nada que resolver, y no un mecanismo; sin nudos, el motor
  // devolvía un "resuelto" vacío (B4 de docs/frame2d-v1.md).
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
        restrained: [node.restrainedX, node.restrainedZ, node.restrainedR],
        force: [node.forceX, node.forceZ, node.momentR],
        displacement: [node.displacementX, node.displacementZ, node.displacementR],
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
        new FrameElement2D(
          element.id,
          { id: from.id, x: from.x, z: from.z },
          { id: to.id, x: to.x, z: to.z },
          element.area,
          element.elasticity,
          element.inertia,
          {
            from: {
              axial: element.femAxialFrom,
              shear: element.femShearFrom,
              moment: element.femMomentFrom,
            },
            to: { axial: element.femAxialTo, shear: element.femShearTo, moment: element.femMomentTo },
          },
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
    const solved = system.solve();
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
