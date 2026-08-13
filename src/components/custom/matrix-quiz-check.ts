import { evaluate } from "mathjs";

export type CellKey = `${number}-${number}`;

export const cellKey = (row: number, col: number): CellKey => `${row}-${col}`;

export interface PositionsResult {
  /** Marcadas y correctas. */
  hit: CellKey[];
  /** Correctas que no marcó. */
  missing: CellKey[];
  /** Marcadas de más. */
  extra: CellKey[];
}

/**
 * Corrige "marcá dónde aporta esta barra".
 *
 * Distingue **faltantes de sobrantes** en vez de dar un puntaje: son dos
 * errores distintos y se corrigen de forma distinta. Marcar de menos suele ser
 * olvidarse de que la barra aporta también en los cruces entre sus dos nudos;
 * marcar de más es haber tomado filas o columnas enteras.
 */
export function checkPositions(selected: Iterable<CellKey>, expected: Iterable<CellKey>): PositionsResult {
  const marcadas = new Set(selected);
  const correctas = new Set(expected);

  return {
    hit: [...marcadas].filter((key) => correctas.has(key)),
    missing: [...correctas].filter((key) => !marcadas.has(key)),
    extra: [...marcadas].filter((key) => !correctas.has(key)),
  };
}

export type CellStatus = "ok" | "wrong" | "empty" | "invalid";

/**
 * Corrige un valor cargado a mano contra el que da el motor.
 *
 * La tolerancia es **relativa** y no absoluta: en una matriz donde conviven
 * 6666.6667 y 0 —el caso normal, porque `EA/L` es de 10³ y las celdas fuera del
 * eje de la barra son cero— un margen fijo o deja pasar cualquier cosa en las
 * grandes o rechaza redondeos legítimos en las chicas. Con 0.5% relativo, quien
 * escribe `6666.67` o `6667` acierta, que es lo que sale de resolverlo a mano.
 *
 * Acepta expresiones (`2e7*0.001/3`), que es como el alumno tiene el número
 * cuando lo está calculando en vez de copiando.
 */
export function checkValue(entered: string, expected: number, relativeTolerance = 0.005): CellStatus {
  const raw = entered.trim();
  if (raw === "") return "empty";

  let value: unknown;
  try {
    value = evaluate(raw);
  } catch {
    return "invalid";
  }
  if (typeof value !== "number" || !Number.isFinite(value)) return "invalid";

  const margin = Math.max(Math.abs(expected) * relativeTolerance, 1e-9);
  return Math.abs(value - expected) <= margin ? "ok" : "wrong";
}

/** Cuántas celdas están bien, para poder decir "12 de 16" en vez de un tilde. */
export function countOk(statuses: CellStatus[]): number {
  return statuses.filter((status) => status === "ok").length;
}
