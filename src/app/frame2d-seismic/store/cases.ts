import { atom, type Atom } from "jotai";

import type { DomainError } from "@/components/custom/errors-panel";
import type { Frame2DView } from "@/app/frame2d/frame2d-view";
import { frame2DClassification } from "@/app/frame2d/store/classification";
import { atomRestrainedFirst, atomUseDofNumbers } from "@/app/frame2d/store/dof-order";
import { atomElements, type ElementRow } from "@/app/frame2d/store/elements";
import { atomLoads, type LoadRow } from "@/app/frame2d/store/loads";
import { atomNodes, type NodeRow } from "@/app/frame2d/store/nodes";
import {
  frame2DMemberDiagrams,
  frame2DMemberLoads,
  frame2DMemberShapes,
  solveFrame2D,
  type Frame2DResults,
} from "@/app/frame2d/store/results";
import { atomNodalLoads, type CaseId, type NodalLoadRow } from "./model";
import { atomDiaphragms, atomLevels, atomSeismicForces, type Level, type SeismicForces } from "./seismic";

/**
 * Los nudos tal como los ve un caso: con **sus** cargas y nada más. Las
 * fuerzas y los desplazamientos de `NodeRow` no se usan en este módulo.
 *
 * En CS, cada Fᵢ va al primer nudo de su nivel: con el diafragma da lo mismo
 * en cuál (el test del paso 1 lo fija), y en un nivel de un solo nudo es ese.
 */
export function caseNodes(
  nodes: NodeRow[],
  caseId: CaseId,
  nodalLoads: NodalLoadRow[],
  levels: Level[],
  seismic: SeismicForces,
): NodeRow[] {
  const result = nodes.map((node) => ({
    ...node,
    forceX: 0,
    forceZ: 0,
    momentR: 0,
    displacementX: 0,
    displacementZ: 0,
    displacementR: 0,
  }));
  const byId = new Map(result.map((n) => [n.id, n]));

  if (caseId === "CS") {
    if (seismic.status === "ok") {
      levels.forEach((level, i) => {
        const owner = byId.get(level.nodeIds[0]);
        if (owner) owner.forceX += seismic.forces[i] ?? 0;
      });
    }
    return result;
  }

  for (const load of nodalLoads) {
    if (load.loadCase !== caseId) continue;
    const node = byId.get(load.nodeId);
    if (!node) continue;
    node.forceX += load.forceX;
    node.forceZ += load.forceZ;
    node.momentR += load.moment;
  }
  return result;
}

/** Las cargas en barras del caso. Sin caso es muerta. CS no tiene cargas en barras. */
export function caseLoads(loads: LoadRow[], caseId: CaseId): LoadRow[] {
  return loads.filter((load) => (load.loadCase ?? "CM") === caseId);
}

/** El FEM a mano no tiene caso: en este módulo no se usa. */
export function caseElements(elements: ElementRow[]): ElementRow[] {
  return elements.map((e) => (e.manualFem ? { ...e, manualFem: false } : e));
}

/** Lo que impide resolver un caso antes de llegar al motor. */
function caseErrors(caseId: CaseId, nodalLoads: NodalLoadRow[], nodes: NodeRow[], seismic: SeismicForces): DomainError[] {
  const errors: DomainError[] = [];
  if (caseId === "CS") {
    if (seismic.status === "error") {
      errors.push({ source: "system", refId: "-", severity: "error", message: `Fuerzas sísmicas: ${seismic.message}` });
    }
    return errors;
  }
  const ids = new Set(nodes.map((n) => n.id));
  for (const load of nodalLoads) {
    if (load.loadCase !== caseId || ids.has(load.nodeId)) continue;
    errors.push({
      source: "load",
      refId: load.id,
      refName: load.name,
      severity: "error",
      message: load.nodeId ? "Está en un nudo que ya no existe." : "No tiene nudo: elegí en cuál está.",
    });
  }
  return errors;
}

function caseView(caseId: CaseId): Frame2DView {
  const nodesAtom = atom((get) =>
    caseNodes(get(atomNodes), caseId, get(atomNodalLoads), get(atomLevels), get(atomSeismicForces)),
  );
  const elementsAtom = atom((get) => caseElements(get(atomElements)));
  const loadsAtom = atom((get) => caseLoads(get(atomLoads), caseId));
  const memberLoadsAtom = atom((get) => frame2DMemberLoads(get(nodesAtom), get(elementsAtom), get(loadsAtom)));

  const resultsAtom: Atom<Frame2DResults> = atom((get) => {
    const nodes = get(nodesAtom);
    const errors = caseErrors(caseId, get(atomNodalLoads), nodes, get(atomSeismicForces));
    if (errors.length > 0) return { status: "error", errors, nodesById: new Map(nodes.map((n) => [n.id, n])) };
    return solveFrame2D({
      nodes,
      elements: get(elementsAtom),
      memberLoads: get(memberLoadsAtom),
      restrainedFirst: get(atomRestrainedFirst),
      useDofNumbers: get(atomUseDofNumbers),
      diaphragms: get(atomDiaphragms),
    });
  });

  return {
    atomNodes: nodesAtom,
    atomElements: elementsAtom,
    atomLoads: loadsAtom,
    atomResults: resultsAtom,
    atomMemberLoads: memberLoadsAtom,
    atomMemberDiagrams: atom((get) => frame2DMemberDiagrams(get(resultsAtom), get(elementsAtom), get(memberLoadsAtom))),
    atomMemberShapes: atom((get) => frame2DMemberShapes(get(resultsAtom), get(elementsAtom), get(memberLoadsAtom))),
    atomClassification: atom((get) => frame2DClassification(get(nodesAtom), get(elementsAtom), get(resultsAtom))),
  };
}

/**
 * Una vista de `/frame2d` por caso: el procedimiento entero de cada uno se
 * muestra con los componentes de `/frame2d` (`Frame2DViewProvider`).
 */
export const caseViews: Record<CaseId, Frame2DView> = {
  CM: caseView("CM"),
  CV: caseView("CV"),
  CS: caseView("CS"),
};
