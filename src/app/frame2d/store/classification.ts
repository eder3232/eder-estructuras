import { atom } from "jotai";

import { determinacy, type Determinacy } from "@/lib/engine";
import { classificationVerdict, type Verdict } from "@/lib/classification-verdict";
import { atomElements, type ElementRow } from "./elements";
import { atomNodes, type NodeRow } from "./nodes";
import { atomResults, type Frame2DResults } from "./results";

export type Frame2DClassification =
  | { status: "empty" }
  | { status: "counted"; bars: number; reactions: number; nodes: number; count: Determinacy; verdict: Verdict };

/**
 * `g = 3b + r − 3n`: **tres** esfuerzos desconocidos por barra (N, V y M en un
 * extremo; los del otro salen del equilibrio de la barra), una reacción por
 * grado restringido —un empotramiento aporta tres— y tres ecuaciones de
 * equilibrio por nudo. Es la cuenta de `/armaduras-2d` con los coeficientes
 * cambiados: `determinacy` los recibe como parámetro desde el principio. El
 * veredicto cruza la cuenta con lo que encontró el motor
 * (`lib/classification-verdict.ts`).
 */
export const atomClassification = atom<Frame2DClassification>((get) =>
  frame2DClassification(get(atomNodes), get(atomElements), get(atomResults)),
);

export function frame2DClassification(
  nodes: NodeRow[],
  elements: ElementRow[],
  results: Frame2DResults,
): Frame2DClassification {
  if (results.status === "empty") return { status: "empty" };

  const reactions = nodes.reduce(
    (sum, node) => sum + Number(node.restrainedX) + Number(node.restrainedZ) + Number(node.restrainedR),
    0,
  );
  const count = determinacy({
    unknownsPerElement: 3,
    dofPerNode: 3,
    elements: elements.length,
    nodes: nodes.length,
    reactions,
  });

  const mechanism = results.status === "error" && results.errors.some((e) => e.mechanism);
  const verdict = classificationVerdict(
    count.degree,
    results.status === "ok" ? "solved" : mechanism ? "mechanism" : "data-errors",
  );

  return { status: "counted", bars: elements.length, reactions, nodes: nodes.length, count, verdict };
}
