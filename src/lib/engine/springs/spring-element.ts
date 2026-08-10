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
