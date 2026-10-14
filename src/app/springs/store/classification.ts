import { atom } from "jotai";

import { determinacy, type Determinacy } from "@/lib/engine";
import { classificationVerdict, type Verdict } from "@/lib/classification-verdict";
import { atomElements } from "./elements";
import { atomNodes } from "./nodes";
import { atomResults } from "./results";

export type SpringsClassification =
  | { status: "empty" }
  | { status: "counted"; springs: number; reactions: number; nodes: number; count: Determinacy; verdict: Verdict };

/**
 * `g = b + r − n`: una fuerza desconocida por resorte, una reacción por nudo
 * restringido y **una** ecuación de equilibrio por nudo, porque cada nudo tiene
 * un solo grado de libertad. El veredicto cruza esa cuenta con lo que encontró
 * el motor — ver `lib/classification-verdict.ts`.
 */
export const atomClassification = atom<SpringsClassification>((get) => {
  const nodes = get(atomNodes);
  const elements = get(atomElements);
  const results = get(atomResults);

  if (results.status === "empty") return { status: "empty" };

  const reactions = nodes.filter((node) => node.restrained).length;
  const count = determinacy({
    unknownsPerElement: 1,
    dofPerNode: 1,
    elements: elements.length,
    nodes: nodes.length,
    reactions,
  });

  const mechanism = results.status === "error" && results.errors.some((e) => e.mechanism);
  const verdict = classificationVerdict(
    count.degree,
    results.status === "ok" ? "solved" : mechanism ? "mechanism" : "data-errors",
  );

  return { status: "counted", springs: elements.length, reactions, nodes: nodes.length, count, verdict };
});
