import { multiply, transpose } from "mathjs";
import type { Element } from "../element";

export interface FramePoint {
  id: string;
  x: number;
  z: number;
}

/** Fuerzas en un extremo de la barra, en coordenadas locales. */
export interface FrameEndForces {
  /** Positiva = tracción sobre el extremo j, según la convención local del elemento. */
  axial: number;
  shear: number;
  moment: number;
}

/** Terna (axial, corte, momento) en los dos extremos, en ejes locales de la barra. */
export interface FrameEndForcePair {
  from: FrameEndForces;
  to: FrameEndForces;
}

export type FrameInternalForce = FrameEndForcePair;

/**
 * Momentos (y fuerzas) de empotramiento perfecto: lo que la barra desarrolla en
 * sus extremos por una carga aplicada a lo largo de ella, con ambos extremos
 * impedidos de moverse. Es el vector que las tablas de FEM dan para carga
 * distribuida, puntual, etc. — **siempre en ejes locales**, porque las tablas
 * están definidas respecto del eje de la barra, no de los ejes globales.
 */
export type FrameFixedEndForces = FrameEndForcePair;

const NO_FIXED_END_FORCES: FrameFixedEndForces = {
  from: { axial: 0, shear: 0, moment: 0 },
  to: { axial: 0, shear: 0, moment: 0 },
};

function toVector({ from, to }: FrameEndForcePair): number[] {
  return [from.axial, from.shear, from.moment, to.axial, to.shear, to.moment];
}

/**
 * Barra de pórtico plano: 3 DOF por nudo (traslación x, traslación z, rotación).
 * A diferencia de `TrussElement2D`, la rigidez combina el término axial (EA/L)
 * con los de flexión (que dependen de la inercia, no solo del área), y el
 * DOF rotacional no rota con la barra — por eso la matriz de transformación
 * tiene un 1 en la fila/columna de la rotación.
 */
export class FrameElement2D implements Element {
  readonly nodeIds: readonly [string, string];
  readonly nodePositions: readonly [{ x: number; z: number }, { x: number; z: number }];
  readonly length: number;
  private readonly cos: number;
  private readonly sin: number;
  private readonly eaOverL: number;
  private readonly ei: number;

  private readonly fixedEndForces: number[];

  constructor(
    readonly id: string,
    from: FramePoint,
    to: FramePoint,
    area: number,
    elasticity: number,
    inertia: number,
    fixedEndForces: FrameFixedEndForces = NO_FIXED_END_FORCES,
  ) {
    if (area <= 0) {
      throw new Error(`El elemento ${id} debe tener área positiva.`);
    }
    if (elasticity <= 0) {
      throw new Error(`El elemento ${id} debe tener módulo de elasticidad positivo.`);
    }
    if (inertia <= 0) {
      throw new Error(`El elemento ${id} debe tener momento de inercia positivo.`);
    }

    this.nodeIds = [from.id, to.id];
    this.nodePositions = [
      { x: from.x, z: from.z },
      { x: to.x, z: to.z },
    ];

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
    this.ei = elasticity * inertia;
    this.fixedEndForces = toVector(fixedEndForces);
  }

  /** Rigidez en coordenadas locales: axial desacoplado de flexión, orden [u, w, θ] por extremo. */
  localStiffness(): number[][] {
    const l = this.length;
    const ea = this.eaOverL;
    const ei12 = (12 * this.ei) / l ** 3;
    const ei6 = (6 * this.ei) / l ** 2;
    const ei4 = (4 * this.ei) / l;
    const ei2 = (2 * this.ei) / l;

    return [
      [ea, 0, 0, -ea, 0, 0],
      [0, ei12, ei6, 0, -ei12, ei6],
      [0, ei6, ei4, 0, -ei6, ei2],
      [-ea, 0, 0, ea, 0, 0],
      [0, -ei12, -ei6, 0, ei12, -ei6],
      [0, ei6, ei2, 0, -ei6, ei4],
    ];
  }

  /** Matriz de transformación global → local. La rotación no se transforma. */
  transform(): number[][] {
    const c = this.cos;
    const s = this.sin;

    return [
      [c, s, 0, 0, 0, 0],
      [-s, c, 0, 0, 0, 0],
      [0, 0, 1, 0, 0, 0],
      [0, 0, 0, c, s, 0],
      [0, 0, 0, -s, c, 0],
      [0, 0, 0, 0, 0, 1],
    ];
  }

  stiffness(): number[][] {
    const t = this.transform();
    return multiply(multiply(transpose(t), this.localStiffness()), t) as number[][];
  }

  /**
   * Carga nodal equivalente a las cargas repartidas a lo largo de la barra:
   * `F_eq = −Tᵀ · FEM_local`.
   *
   * Los dos detalles que hay que respetar acá, y que el proyecto original
   * erraba (ver `docs/refactor-roadmap.md`):
   * - **La transformación**. El FEM está en ejes locales, así que hay que
   *   llevarlo a globales antes de sumarlo al vector de cargas del sistema.
   *   Saltearse `Tᵀ` solo pasa desapercibido en barras horizontales, donde T
   *   es la identidad; en una columna o una barra inclinada, la carga termina
   *   apuntando en la dirección equivocada.
   * - **El signo**. La carga equivalente es el *opuesto* del FEM: el FEM es lo
   *   que la barra desarrolla con los extremos empotrados, y lo que se le
   *   aplica a los nudos para reproducir ese efecto es su negativo.
   */
  equivalentLoad(): number[] {
    const fem = this.fixedEndForces.map((value) => [value]);
    const globalFem = multiply(transpose(this.transform()), fem) as number[][];
    return globalFem.map((row) => -row[0]);
  }

  /**
   * Superposición: a la respuesta de la estructura resuelta con cargas solo
   * nodales (`k·u`) se le devuelve la carga real de la barra (`+ FEM_local`),
   * que es la que produce el diagrama de momentos correcto a lo largo de ella.
   */
  internalForce([from, to]: [number[], number[]]): FrameInternalForce {
    const globalDisplacement = [...from, ...to].map((value) => [value]);
    const localDisplacement = multiply(this.transform(), globalDisplacement) as number[][];
    const forces = (multiply(this.localStiffness(), localDisplacement) as number[][]).map(
      (row, i) => row[0] + this.fixedEndForces[i],
    );

    return {
      from: { axial: forces[0], shear: forces[1], moment: forces[2] },
      to: { axial: forces[3], shear: forces[4], moment: forces[5] },
    };
  }
}
