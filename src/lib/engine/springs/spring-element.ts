import type { Element } from "../element";

export interface SpringInternalForce {
  axialForce: number;
}

export class SpringElement implements Element {
  readonly nodeIds: readonly [string, string];

  constructor(
    readonly id: string,
    nodeIds: [string, string],
    private readonly k: number,
  ) {
    // Un resorte con `k ≤ 0` no es un resorte: con cero no aporta nada y con
    // negativo empuja a favor del desplazamiento. Se resolvía igual, sin
    // quejarse — se encontró revisando `/springs` (2026-10-14). Es la misma
    // regla que `TrussElement2D` aplica al área y a la elasticidad.
    if (!(k > 0)) {
      throw new Error(`El elemento ${id} debe tener rigidez k positiva.`);
    }
    this.nodeIds = nodeIds;
  }

  stiffness(): number[][] {
    return [
      [this.k, -this.k],
      [-this.k, this.k],
    ];
  }

  internalForce([from, to]: [number[], number[]]): SpringInternalForce {
    return { axialForce: this.k * (to[0] - from[0]) };
  }
}
