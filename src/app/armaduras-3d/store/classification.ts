import { atom } from "jotai";

import { determinacy, type Determinacy } from "@/lib/engine";
import { classificationVerdict, type Verdict } from "@/lib/classification-verdict";
import { atomElements } from "./elements";
import { atomNodes } from "./nodes";
import { atomResults } from "./results";

export type Armaduras3DClassification =
  | { status: "empty" }
  | { status: "counted"; bars: number; reactions: number; nodes: number; count: Determinacy; verdict: Verdict };

/**
 * `g = b + r − 3n`: una fuerza axial por barra, una reacción por grado
 * restringido, y **tres** ecuaciones de equilibrio por nudo. El veredicto
 * cruza la cuenta con lo que encontró el motor (`lib/classification-verdict.ts`).
 */
export const atomClassification = atom<Armaduras3DClassification>((get) => {
  const nodes = get(atomNodes);
  const elements = get(atomElements);
  const results = get(atomResults);

  if (results.status === "empty") return { status: "empty" };

  const reactions = nodes.reduce(
    (sum, node) => sum + Number(node.restrainedX) + Number(node.restrainedY) + Number(node.restrainedZ),
    0,
  );
  const count = determinacy({
    unknownsPerElement: 1,
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
});
