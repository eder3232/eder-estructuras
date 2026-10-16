import { multiply, transpose } from "mathjs";
import type { Element } from "../element";

export interface TrussPoint3D {
  id: string;
  x: number;
  y: number;
  z: number;
}

export interface Truss3DInternalForce {
  axialForce: number;
}

/**
 * Los pasos intermedios de la rigidez de una barra espacial, para mostrarlos
 * con los mismos números que se usan para calcular. Es el `TrussBreakdown` de
 * `TrussElement2D` con un coseno más (ver ahí por qué existe).
 */
export interface Truss3DBreakdown {
  length: number;
  /** `[Cx, Cy, Cz]`, en el orden de los DOF. */
  cosines: [number, number, number];
  eaOverL: number;
  /** `A`, 6×2: lleva los 2 DOF axiales de la barra a los 6 DOF globales de sus nudos. */
  transform: number[][];
  /** `Aᵀ`, 2×6. Es un operando visible de la cadena. */
  transformTransposed: number[][];
  /** `k` en ejes locales, 2×2: `EA/L · [[1,−1],[−1,1]]`. */
  localStiffness: number[][];
  /** `A · k · Aᵀ`, 6×6. Es lo que devuelve `stiffness()`. */
  globalStiffness: number[][];
}

/**
 * Barra de armadura espacial: solo rigidez axial, 3 DOF de traslación por nudo.
 * Es el mismo elemento que `TrussElement2D` con un coseno director más — la
 * única diferencia real entre armaduras planas y espaciales.
 */
export class TrussElement3D implements Element {
  readonly nodeIds: readonly [string, string];
  private readonly length: number;
  private readonly cos: readonly [number, number, number];
  private readonly eaOverL: number;

  constructor(
    readonly id: string,
    from: TrussPoint3D,
    to: TrussPoint3D,
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
    const dy = to.y - from.y;
    const dz = to.z - from.z;
    const length = Math.hypot(dx, dy, dz);
    if (length === 0) {
      throw new Error(`El elemento ${id} tiene longitud cero: los nodos ${from.id} y ${to.id} coinciden.`);
    }

    this.length = length;
    this.cos = [dx / length, dy / length, dz / length];
    this.eaOverL = (elasticity * area) / length;
  }

  /** Cosenos directores de la barra, en el orden de los DOF (x, y, z). */
  get directionCosines(): readonly [number, number, number] {
    return this.cos;
  }

  get axialStiffness(): number {
    return this.eaOverL;
  }

  /** Los pasos intermedios de `stiffness()`, para poder mostrarlos. Ver `Truss3DBreakdown`. */
  breakdown(): Truss3DBreakdown {
    const [cx, cy, cz] = this.cos;
    const transform = [
      [cx, 0],
      [cy, 0],
      [cz, 0],
      [0, cx],
      [0, cy],
      [0, cz],
    ];
    const localStiffness = [
      [this.eaOverL, -this.eaOverL],
      [-this.eaOverL, this.eaOverL],
    ];

    const transformTransposed = transpose(transform) as number[][];

    return {
      length: this.length,
      cosines: [cx, cy, cz],
      eaOverL: this.eaOverL,
      transform,
      transformTransposed,
      localStiffness,
      globalStiffness: multiply(multiply(transform, localStiffness), transformTransposed) as number[][],
    };
  }

  stiffness(): number[][] {
    return this.breakdown().globalStiffness;
  }

  internalForce([from, to]: [number[], number[]]): Truss3DInternalForce {
    const elongation = this.cos.reduce((sum, c, axis) => sum + c * (to[axis] - from[axis]), 0);
    return { axialForce: this.eaOverL * elongation };
  }
}
