import { atom } from "jotai";

import { determinacy, type Determinacy } from "@/lib/engine";
import { atomElements } from "./elements";
import { atomNodes } from "./nodes";
import { atomResults } from "./results";

/**
 * Qué se puede afirmar de la estructura juntando **dos fuentes que no dicen lo
 * mismo**: el conteo `b + r − 2n`, que es lo que se hace en el pizarrón antes
 * de armar nada, y lo que encontró el motor al mirar la matriz.
 *
 * - `unstable-by-count`: faltan incógnitas. Es un mecanismo seguro, y el
 *   conteo solo alcanza para afirmarlo.
 * - `unstable-by-arrangement`: el conteo da `g ≥ 0` y aun así el motor
 *   encontró un mecanismo. **Es el caso que enseña**: el conteo es condición
 *   necesaria, no suficiente — las barras están, pero mal puestas.
 * - `determinate` / `indeterminate`: el conteo y la matriz coinciden. Solo se
 *   afirma cuando el motor resolvió; antes sería creerle al conteo.
 * - `unconfirmed`: el conteo da `g ≥ 0` pero el modelo tiene errores de datos y
 *   no se pudo mirar la matriz. Se dice lo que da la cuenta y que falta
 *   confirmarlo.
 */
export type Verdict = "unstable-by-count" | "unstable-by-arrangement" | "determinate" | "indeterminate" | "unconfirmed";

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
  const verdict: Verdict =
    count.degree < 0
      ? "unstable-by-count"
      : mechanism
        ? "unstable-by-arrangement"
        : results.status === "ok"
          ? count.degree === 0
            ? "determinate"
            : "indeterminate"
          : "unconfirmed";

  return { status: "counted", bars: elements.length, reactions, nodes: nodes.length, count, verdict };
});
