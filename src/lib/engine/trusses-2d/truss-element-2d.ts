import { multiply, transpose } from "mathjs";
import type { Element } from "../element";

export interface TrussPoint {
  id: string;
  x: number;
  z: number;
}

export interface TrussInternalForce {
  axialForce: number;
}

export class TrussElement2D implements Element {
  readonly nodeIds: readonly [string, string];
  private readonly cos: number;
  private readonly sin: number;
  private readonly eaOverL: number;

  constructor(
    readonly id: string,
    from: TrussPoint,
    to: TrussPoint,
    area: number,
    elasticity: number,
  ) {
    if (area <= 0) {
      throw new Error(`El elemento ${id} debe tener área positiva.`);
    }
    if (elasticity <= 0) {
      throw new Error(`El elemento ${id} debe tener módulo de elasticidad positivo.`);
    }

    this.nodeIds = [from.id, to.id];

    const dx = to.x - from.x;
    const dz = to.z - from.z;
    const length = Math.hypot(dx, dz);
    if (length === 0) {
      throw new Error(`El elemento ${id} tiene longitud cero: los nodos ${from.id} y ${to.id} coinciden.`);
    }

    this.cos = dx / length;
    this.sin = dz / length;
    this.eaOverL = (elasticity * area) / length;
  }

  stiffness(): number[][] {
    const transform = [
      [this.cos, 0],
      [this.sin, 0],
      [0, this.cos],
      [0, this.sin],
    ];
    const localStiffness = [
      [this.eaOverL, -this.eaOverL],
      [-this.eaOverL, this.eaOverL],
    ];

    return multiply(
      multiply(transform, localStiffness),
      transpose(transform),
    ) as number[][];
  }

  internalForce([from, to]: [number[], number[]]): TrussInternalForce {
    const elongation =
      -this.cos * from[0] - this.sin * from[1] + this.cos * to[0] + this.sin * to[1];
    return { axialForce: this.eaOverL * elongation };
  }
}
