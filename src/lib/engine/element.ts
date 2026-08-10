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
}
