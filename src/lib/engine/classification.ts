/**
 * El conteo con que se clasifica una estructura antes de resolverla: cuántas
 * incógnitas de fuerza hay contra cuántas ecuaciones de equilibrio.
 *
 *     g = (incógnitas por barra) · b + r − (grados por nudo) · n
 *
 * En una armadura plana es `g = b + r − 2n`: una fuerza axial por barra, una
 * reacción por grado restringido, y dos ecuaciones de equilibrio por nudo. Los
 * coeficientes son lo único que cambia entre sistemas (pórtico plano
 * `3b + r − 3n`, armadura espacial `b + r − 3n`), así que la cuenta vive acá y
 * cada sistema pone los suyos.
 *
 * **Es condición necesaria, no suficiente**, y esa es la lección: `g < 0`
 * garantiza un mecanismo, pero `g ≥ 0` no garantiza nada — una armadura puede
 * tener las barras justas y estar mal dispuesta (tres apoyos paralelos, un
 * cuadro sin diagonal compensado con una barra de más en otro lado). Por eso
 * este módulo **no dice si la estructura es estable**: eso lo decide `solve()`,
 * que mira la matriz y no la cuenta. El veredicto junta las dos cosas y vive en
 * cada sistema, porque depende de cómo ese sistema reporta su resultado.
 */

export interface StructureCount {
  /** Fuerzas internas desconocidas que aporta cada barra (armadura: 1, pórtico plano: 3). */
  unknownsPerElement: number;
  /** Ecuaciones de equilibrio por nudo, que son sus grados de libertad. */
  dofPerNode: number;
  elements: number;
  nodes: number;
  /** Grados de libertad restringidos: cada uno es una reacción desconocida. */
  reactions: number;
}

export interface Determinacy {
  unknowns: number;
  equations: number;
  /** `unknowns − equations`. Negativo: faltan incógnitas. Positivo: grado de hiperestaticidad. */
  degree: number;
}

export function determinacy({ unknownsPerElement, dofPerNode, elements, nodes, reactions }: StructureCount): Determinacy {
  const unknowns = unknownsPerElement * elements + reactions;
  const equations = dofPerNode * nodes;
  return { unknowns, equations, degree: unknowns - equations };
}
