import type { FrameFixedEndForces } from "./frame-element-2d";

/**
 * Cargas a lo largo de una barra de pórtico y el FEM que producen.
 *
 * **La carga es el dato y el FEM se calcula**, siempre con la longitud actual
 * de la barra. El original guardaba el FEM calculado en el momento de escribir
 * la carga, así que mover un nudo después lo dejaba desincronizado (V3 de
 * `docs/frame2d-v1.md`); acá no hay FEM guardado que se pueda quedar viejo.
 *
 * Convenciones:
 * - Las posiciones (`a`, `b`) se miden **a lo largo de la barra**, desde el
 *   extremo «desde», en las mismas unidades que las coordenadas.
 * - Cada valor tiene signo según el eje que se elige en `direction`: `+y'`
 *   (perpendicular, a la izquierda de la barra mirándola de «desde» a «hacia»),
 *   `+x'` (axial, hacia «hacia»), `+X` o `+Z` globales. Una carga de gravedad
 *   es `globalZ` negativa.
 * - El momento concentrado es positivo antihorario, como el momento nodal.
 */
export type LoadDirection = "perpendicular" | "axial" | "globalX" | "globalZ";

export type MemberLoad =
  | {
      kind: "distributed";
      direction: LoadDirection;
      /** Intensidad en `a` y en `b`: iguales es uniforme, una en cero es triangular. */
      q1: number;
      q2: number;
      a: number;
      b: number;
      /**
       * Solo para direcciones globales en barras inclinadas: la intensidad es
       * **por unidad de proyección** (la horizontal para `globalZ`, la vertical
       * para `globalX`) y no por unidad de largo de la barra. Es el caso de la
       * nieve o del peso de una cubierta, que se dan por metro de planta: sobre
       * una barra inclinada la carga total es menor que q·L.
       */
      projected?: boolean;
    }
  | { kind: "point"; direction: LoadDirection; value: number; a: number }
  | { kind: "moment"; value: number; a: number };

/** Lo que una carga necesita saber de su barra: largo y orientación. */
export interface MemberAxis {
  length: number;
  cos: number;
  sin: number;
}

export function memberAxis(from: { x: number; z: number }, to: { x: number; z: number }): MemberAxis {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const length = Math.hypot(dx, dz);
  return { length, cos: length === 0 ? 1 : dx / length, sin: length === 0 ? 0 : dz / length };
}

/**
 * Componentes locales `(x', y')` de una carga de magnitud 1 en la dirección
 * dada. Es la misma rotación que `FrameElement2D.transform()`:
 * `x' = c·X + s·Z`, `y' = −s·X + c·Z`.
 */
export function localDirection(direction: LoadDirection, { cos: c, sin: s }: MemberAxis): [number, number] {
  switch (direction) {
    case "perpendicular":
      return [0, 1];
    case "axial":
      return [1, 0];
    case "globalX":
      return [c, -s];
    case "globalZ":
      return [s, c];
  }
}

/**
 * Cuánto de la intensidad dada cae por unidad de largo de la barra. Por
 * proyección, `q` se reparte sobre el largo proyectado, que es `|c|·L` para
 * `globalZ` y `|s|·L` para `globalX`.
 */
export function lengthFactor(load: MemberLoad, { cos, sin }: MemberAxis): number {
  if (load.kind !== "distributed" || !load.projected) return 1;
  if (load.direction === "globalZ") return Math.abs(cos);
  if (load.direction === "globalX") return Math.abs(sin);
  return 1;
}

/**
 * Lo que está mal en una carga, dicho para el alumno, o `null`. Los mensajes
 * no nombran la carga: el store les antepone de qué fila son.
 */
export function memberLoadProblem(load: MemberLoad, { length }: MemberAxis): string | null {
  const values = load.kind === "distributed" ? [load.q1, load.q2, load.a, load.b] : [load.value, load.a];
  if (values.some((v) => !Number.isFinite(v))) return "tiene un valor que no es un número.";

  const show = (v: number) => Number(v.toFixed(6)).toString();
  const outside = (v: number) => v < 0 || v > length + 1e-9 * Math.max(1, length);
  const where = `el largo de la barra es L = ${show(length)}`;

  if (load.kind === "distributed") {
    if (outside(load.a)) return `empieza en a = ${show(load.a)}, fuera de la barra (${where}).`;
    if (outside(load.b)) return `termina en b = ${show(load.b)}, fuera de la barra (${where}).`;
    if (load.b <= load.a) return `tiene que terminar después de empezar (a = ${show(load.a)}, b = ${show(load.b)}).`;
    return null;
  }

  if (outside(load.a)) return `está en a = ${show(load.a)}, fuera de la barra (${where}).`;
  return null;
}

/**
 * Funciones de forma de la barra en `x`, en el orden del vector de extremo
 * `[u, w, θ]` de cada extremo: lineales para la axial, Hermite para la
 * flexión. `dHermite` son sus derivadas respecto de `x`, que son las que
 * reparten un momento concentrado.
 */
function shapeFunctions(x: number, length: number) {
  const xi = x / length;
  return {
    axial: [1 - xi, xi] as const,
    hermite: [
      1 - 3 * xi ** 2 + 2 * xi ** 3,
      length * (xi - 2 * xi ** 2 + xi ** 3),
      3 * xi ** 2 - 2 * xi ** 3,
      length * (-(xi ** 2) + xi ** 3),
    ] as const,
    dHermite: [
      (-6 * xi + 6 * xi ** 2) / length,
      1 - 4 * xi + 3 * xi ** 2,
      (6 * xi - 6 * xi ** 2) / length,
      -2 * xi + 3 * xi ** 2,
    ] as const,
  };
}

/** Gauss–Legendre de 3 puntos en [−1, 1]: exacto hasta grado 5. */
const GAUSS_3 = [
  { t: -Math.sqrt(3 / 5), w: 5 / 9 },
  { t: 0, w: 8 / 9 },
  { t: Math.sqrt(3 / 5), w: 5 / 9 },
];

/** Carga nodal equivalente local `[u_i, w_i, θ_i, u_j, w_j, θ_j]` de una sola carga. */
function equivalentLocalLoad(load: MemberLoad, axis: MemberAxis): number[] {
  const { length } = axis;
  const out = [0, 0, 0, 0, 0, 0];

  const addForce = (x: number, px: number, py: number) => {
    const { axial, hermite } = shapeFunctions(x, length);
    out[0] += axial[0] * px;
    out[3] += axial[1] * px;
    out[1] += hermite[0] * py;
    out[2] += hermite[1] * py;
    out[4] += hermite[2] * py;
    out[5] += hermite[3] * py;
  };

  if (load.kind === "moment") {
    // Trabajo virtual de un momento: M·θ(a), y θ = w' → las derivadas de Hermite.
    const { dHermite } = shapeFunctions(load.a, length);
    out[1] += dHermite[0] * load.value;
    out[2] += dHermite[1] * load.value;
    out[4] += dHermite[2] * load.value;
    out[5] += dHermite[3] * load.value;
    return out;
  }

  const [ux, uy] = localDirection(load.direction, axis);

  if (load.kind === "point") {
    addForce(load.a, ux * load.value, uy * load.value);
    return out;
  }

  // Intensidad lineal × función de forma cúbica = grado 4: Gauss de 3 puntos
  // la integra exacta, así que esto no es una aproximación numérica.
  const factor = lengthFactor(load, axis);
  const half = (load.b - load.a) / 2;
  const mid = (load.a + load.b) / 2;
  for (const { t, w } of GAUSS_3) {
    const x = mid + half * t;
    const q = factor * (load.q1 + ((load.q2 - load.q1) * (x - load.a)) / (load.b - load.a));
    addForce(x, ux * q * w * half, uy * q * w * half);
  }
  return out;
}

const ZERO: FrameFixedEndForces = {
  from: { axial: 0, shear: 0, moment: 0 },
  to: { axial: 0, shear: 0, moment: 0 },
};

/**
 * El FEM de una carga: lo que la barra desarrolla en sus extremos con los dos
 * empotrados, en ejes locales. Es el **opuesto** de la carga nodal equivalente
 * —la reacción del empotramiento—, que es la convención de
 * `FrameElement2D` (ver su `equivalentLoad`).
 *
 * Tira un error si la carga está mal (`memberLoadProblem`): un FEM calculado
 * con una posición fuera de la barra no significa nada.
 */
export function loadFixedEndForces(load: MemberLoad, axis: MemberAxis): FrameFixedEndForces {
  const problem = memberLoadProblem(load, axis);
  if (problem) throw new Error(`La carga ${problem}`);

  const [ai, vi, mi, aj, vj, mj] = equivalentLocalLoad(load, axis).map((v) => -v);
  return {
    from: { axial: ai, shear: vi, moment: mi },
    to: { axial: aj, shear: vj, moment: mj },
  };
}

/** La superposición: el FEM de varias cargas es la suma de los FEM de cada una. */
export function sumFixedEndForces(forces: readonly FrameFixedEndForces[]): FrameFixedEndForces {
  return forces.reduce(
    (acc, f) => ({
      from: {
        axial: acc.from.axial + f.from.axial,
        shear: acc.from.shear + f.from.shear,
        moment: acc.from.moment + f.from.moment,
      },
      to: {
        axial: acc.to.axial + f.to.axial,
        shear: acc.to.shear + f.to.shear,
        moment: acc.to.moment + f.to.moment,
      },
    }),
    ZERO,
  );
}
