export interface Element {
  id: string;
  nodeIds: readonly [string, string];

  /** Matriz de rigidez ya en direcciones globales, tamaño (2*dofPerNode)×(2*dofPerNode). */
  stiffness(): number[][];

  /**
   * Carga nodal equivalente (temperatura, defectos de fabricación, cargas
   * distribuidas futuras). Default: vector cero — no todos los sistemas
   * estructurales la necesitan (p. ej. springs).
   */
  equivalentLoad?(): number[];

  /**
   * Fuerza interna a partir de los desplazamientos globales resueltos en
   * sus 2 nodos. La forma del resultado la decide cada Element concreto.
   */
  internalForce(nodeDisplacements: [number[], number[]]): unknown;

  /**
   * Solo pórticos planos (grados de libertad `[x, z, θ]` por nudo): dónde
   * están sus dos nudos. El equilibrio global de un pórtico necesita brazos de
   * palanca —la suma de momentos se toma respecto de un punto—, y el motor no
   * guarda coordenadas en ningún otro lado.
   */
  readonly nodePositions?: readonly [{ x: number; z: number }, { x: number; z: number }];
}
