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

/**
 * Los pasos intermedios que van de la geometría de la barra a su matriz de
 * rigidez global. Existe para la UI: es el paso que distingue una armadura de un
 * resorte, así que hay que poder mostrarlo, y mostrarlo **con los mismos números
 * que se usan para calcular**.
 *
 * Antes de esto la página recalculaba `cos`/`sin`/`eaOverL` por su cuenta desde
 * las coordenadas de los nudos, en dos archivos distintos: había tres copias de
 * la misma fórmula y nada garantizaba que la matriz dibujada fuera la aplicada.
 */
export interface TrussBreakdown {
  length: number;
  cos: number;
  sin: number;
  eaOverL: number;
  /** `A`, 4×2: lleva los 2 DOF axiales de la barra a los 4 DOF globales de sus nudos. */
  transform: number[][];
  /** `Aᵀ`, 2×4. Va acá y no se transpone en la UI porque es un operando visible de la cadena. */
  transformTransposed: number[][];
  /** `k` en ejes locales, 2×2: `EA/L · [[1,−1],[−1,1]]`. */
  localStiffness: number[][];
  /** `A · k · Aᵀ`, 4×4. Es lo que devuelve `stiffness()`. */
  globalStiffness: number[][];
}

export class TrussElement2D implements Element {
  readonly nodeIds: readonly [string, string];
  private readonly length: number;
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

    this.length = length;
    this.cos = dx / length;
    this.sin = dz / length;
    this.eaOverL = (elasticity * area) / length;
  }

  /** Los pasos intermedios de `stiffness()`, para poder mostrarlos. Ver `TrussBreakdown`. */
  breakdown(): TrussBreakdown {
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

    const transformTransposed = transpose(transform) as number[][];

    return {
      length: this.length,
      cos: this.cos,
      sin: this.sin,
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

  internalForce([from, to]: [number[], number[]]): TrussInternalForce {
    const elongation =
      -this.cos * from[0] - this.sin * from[1] + this.cos * to[0] + this.sin * to[1];
    return { axialForce: this.eaOverL * elongation };
  }
}
