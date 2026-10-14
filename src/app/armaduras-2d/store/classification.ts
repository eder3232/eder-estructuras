import { atom } from "jotai";

import { determinacy, type Determinacy } from "@/lib/engine";
import { classificationVerdict, type Verdict } from "@/lib/classification-verdict";
import { atomElements } from "./elements";
import { atomNodes } from "./nodes";
import { atomResults } from "./results";

export type { Verdict } from "@/lib/classification-verdict";

export type Armaduras2DClassification =
  | { status: "empty" }
  | {
      status: "counted";
      bars: number;
      reactions: number;
      nodes: number;
      count: Determinacy;
      verdict: Verdict;
    };

export const atomClassification = atom<Armaduras2DClassification>((get) => {
  const nodes = get(atomNodes);
  const elements = get(atomElements);
  const results = get(atomResults);

  if (results.status === "empty") return { status: "empty" };

  const reactions = nodes.reduce((sum, node) => sum + Number(node.restrainedX) + Number(node.restrainedZ), 0);
  // Armadura plana: una fuerza axial por barra, dos ecuaciones por nudo.
  const count = determinacy({
    unknownsPerElement: 1,
    dofPerNode: 2,
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
