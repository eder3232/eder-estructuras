/**
 * Qué se puede afirmar de una estructura juntando **dos fuentes que no dicen lo
 * mismo**: el conteo (`determinacy` del motor), que es lo que se hace en el
 * pizarrón antes de armar nada, y lo que encontró el motor al mirar la matriz.
 *
 * - `unstable-by-count`: faltan incógnitas. Es un mecanismo seguro, y el
 *   conteo solo alcanza para afirmarlo.
 * - `unstable-by-arrangement`: el conteo da `g ≥ 0` y aun así el motor
 *   encontró un mecanismo. **Es el caso que enseña**: el conteo es condición
 *   necesaria, no suficiente.
 * - `determinate` / `indeterminate`: el conteo y la matriz coinciden. Solo se
 *   afirma cuando el motor resolvió; antes sería creerle al conteo.
 * - `unconfirmed`: el conteo da `g ≥ 0` pero el modelo tiene errores de datos y
 *   no se pudo mirar la matriz.
 *
 * Nació en `/armaduras-2d` y se sacó acá al llevarlo a `/springs`: no depende
 * de qué elementos tenga el sistema, solo del signo de `g` y del resultado.
 */
export type Verdict = "unstable-by-count" | "unstable-by-arrangement" | "determinate" | "indeterminate" | "unconfirmed";

/** Lo único del resultado del cálculo que le importa al veredicto. */
export type SolveOutcome = "solved" | "mechanism" | "data-errors";

export function classificationVerdict(degree: number, outcome: SolveOutcome): Verdict {
  if (degree < 0) return "unstable-by-count";
  if (outcome === "mechanism") return "unstable-by-arrangement";
  if (outcome === "solved") return degree === 0 ? "determinate" : "indeterminate";
  return "unconfirmed";
}
