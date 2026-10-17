import { atom } from "jotai";

import type { SeismicWorkbookInput } from "@/lib/excel/frame-2d-seismic-workbook";
import type { FrameInternalForce } from "@/lib/engine";
import { atomElements } from "@/app/frame2d/store/elements";
import { atomNodes } from "@/app/frame2d/store/nodes";
import { atomCombinationResults, atomLateralAnalysis, freeDofLabels } from "./analysis";
import { caseViews } from "./cases";
import { atomCombinations, atomLevelInputs, atomSeismicParams, type CaseId } from "./model";

const CASE_IDS: CaseId[] = ["CM", "CV", "CS"];

/**
 * Lo que necesita el libro de Excel (`lib/excel/frame-2d-seismic-workbook.ts`),
 * o `null` si todavía no hay con qué armarlo: sin los tres casos resueltos ni
 * la rigidez lateral, el libro no tendría sus números.
 */
export const atomSeismicWorkbookInput = atom((get): SeismicWorkbookInput | null => {
  const lateral = get(atomLateralAnalysis);
  const combined = get(atomCombinationResults);
  if (lateral.status !== "ok" || combined.status !== "ok") return null;

  const solved = Object.fromEntries(
    CASE_IDS.map((id) => {
      const results = get(caseViews[id].atomResults);
      return [id, results.status === "ok" ? results.solved : null];
    }),
  );
  if (CASE_IDS.some((id) => !solved[id])) return null;

  const nodes = get(atomNodes);
  const names = new Map(nodes.map((n) => [n.id, n.name]));
  const inputs = get(atomLevelInputs);
  const labels = freeDofLabels(get(caseViews.CS.atomResults), lateral.freeGlobalIndices);
  const { condensation } = lateral;

  return {
    params: get(atomSeismicParams),
    levels: lateral.levels.map((level, i) => ({
      name: level.name,
      nodes: level.nodeIds.map((id) => names.get(id) ?? id).join(", "),
      height: level.height,
      weight: inputs.weights[i] ?? 0,
      manualForce: inputs.manualForces[i] ?? 0,
    })),
    lateral: {
      kaa: condensation.kaa,
      kab: condensation.kab,
      kbb: condensation.kbb,
      kept: condensation.keep.map((i) => labels[i]),
      dropped: condensation.drop.map((i) => labels[i]),
    },
    combinations: get(atomCombinations),
    elements: get(atomElements).map((element) => ({
      name: element.name,
      from: names.get(element.fromNodeId) ?? "",
      to: names.get(element.toNodeId) ?? "",
      endForces: Object.fromEntries(
        CASE_IDS.map((id) => [id, solved[id]!.internalForces.get(element.id) as FrameInternalForce]),
      ) as SeismicWorkbookInput["elements"][number]["endForces"],
    })),
    supports: nodes
      .filter((n) => n.restrainedX || n.restrainedZ || n.restrainedR)
      .map((node) => ({
        name: node.name,
        reactions: Object.fromEntries(
          CASE_IDS.map((id) => [id, solved[id]!.reactions.get(node.id)!]),
        ) as SeismicWorkbookInput["supports"][number]["reactions"],
      })),
  };
});
