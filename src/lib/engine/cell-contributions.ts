import type { AssemblyStep, DofOrderEntry } from "./system";

/** Cuánto le sumó una barra a una celda de la matriz global. */
export interface CellContribution {
  elementId: string;
  value: number;
}

/**
 * Qué barras aportan a la celda `(row, col)` de la matriz global, y cuánto.
 *
 * Responde la pregunta que no se entiende del método matricial: *¿por qué
 * aparece un número en esta celda y no en la de al lado?* La respuesta es
 * topológica — **una barra aporta a `K[i][j]` si toca los dos nudos**, el de la
 * fila y el de la columna— y por eso la matriz global tiene la forma que tiene:
 * los ceros son pares de nudos que ninguna barra conecta.
 *
 * El valor sale de la diferencia entre dos pasos consecutivos del ensamblaje,
 * que es exactamente lo que esa barra sumó.
 *
 * **Una barra que toca los dos nudos y aporta `0` se devuelve igual**, y eso es
 * a propósito: es el caso que más enseña. Una barra horizontal no aporta nada
 * al grado de libertad vertical de sus nudos —solo tiene rigidez sobre su
 * propio eje— y ver el cero al lado del nombre de la barra es la misma lección
 * que el diagnóstico de mecanismo da cuando ya es tarde.
 */
export function cellContributions(
  steps: readonly AssemblyStep[],
  elements: readonly { id: string; nodeIds: readonly string[] }[],
  dofOrder: readonly DofOrderEntry[],
  row: number,
  col: number,
): CellContribution[] {
  const nodeOfRow = dofOrder[row]?.nodeId;
  const nodeOfCol = dofOrder[col]?.nodeId;
  if (nodeOfRow === undefined || nodeOfCol === undefined) return [];

  const byId = new Map(elements.map((element) => [element.id, element]));

  return steps.flatMap((step, k) => {
    const element = byId.get(step.elementId);
    if (!element) return [];
    if (!element.nodeIds.includes(nodeOfRow) || !element.nodeIds.includes(nodeOfCol)) return [];

    const before = k > 0 ? steps[k - 1].globalStiffnessAfter[row][col] : 0;
    return [{ elementId: step.elementId, value: step.globalStiffnessAfter[row][col] - before }];
  });
}
