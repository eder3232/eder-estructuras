/**
 * El análisis sísmico estático de la **E.030 Diseño Sismorresistente (2026)**,
 * artículo por artículo. Funciones puras: ni Z ni S ni R se eligen acá —eso
 * pide clasificar el suelo y la estructura, que está fuera del alcance de la
 * app—, se reciben ya decididos. Ver `docs/frame2d-seismic-v1.md`, sección 3.
 */

/** E.030, 34.2: el cortante de diseño nunca baja de este C/R. */
export const MIN_C_OVER_R = 0.11;

/** Cuál renglón de la Tabla N° 6 se usó: para mostrar el paso. */
export type AmplificationBranch = "short" | "plateau" | "descending" | "long";

export interface Amplification {
  C: number;
  branch: AmplificationBranch;
}

/**
 * E.030, 18.1, Tabla N° 6: el factor de amplificación sísmica C(T).
 *
 * El primer renglón, `C = 1 + 7.5·T/T_P` para `T < 0.2·T_P`, **es nuevo en la
 * versión 2026**. Para el cortante del análisis estático no se usa: ver
 * `staticAmplificationFactor`.
 */
export function amplificationFactor(T: number, TP: number, TL: number): Amplification {
  checkPeriods(T, TP, TL);
  if (T < 0.2 * TP) return { C: 1 + 7.5 * (T / TP), branch: "short" };
  if (T <= TP) return { C: 2.5, branch: "plateau" };
  if (T < TL) return { C: 2.5 * (TP / T), branch: "descending" };
  return { C: 2.5 * ((TP * TL) / T ** 2), branch: "long" };
}

/**
 * E.030, 18.3 (y la nota del 34.1): **para el cortante basal del análisis
 * estático, C = 2.5 en todo `0 ≤ T ≤ T_P`**. El tramo corto de la Tabla N° 6
 * no aplica acá, y es fácil de pasar por alto.
 */
export function staticAmplificationFactor(T: number, TP: number, TL: number): Amplification {
  checkPeriods(T, TP, TL);
  if (T <= TP) return { C: 2.5, branch: "plateau" };
  return amplificationFactor(T, TP, TL);
}

/** E.030, 35.2: el exponente de la distribución en altura. */
export function heightExponent(T: number): number {
  if (!(T >= 0)) throw new Error("El período T tiene que ser un número mayor o igual a cero.");
  return T <= 0.5 ? 1 : Math.min(0.75 + 0.5 * T, 2);
}

/** E.030, 36.1: `T = h_n / C_T` (C_T = 35, 45 o 60 según el sistema). */
export function periodFromHeight(hn: number, CT: number): number {
  if (!(hn > 0)) throw new Error("La altura del edificio h_n tiene que ser mayor que cero.");
  if (!(CT > 0)) throw new Error("C_T tiene que ser mayor que cero.");
  return hn / CT;
}

export interface SeismicLevelInput {
  /** hᵢ: la altura del nivel **medida desde la base**. */
  height: number;
  /** Pᵢ: el peso del nivel (E.030, artículo 31). */
  weight: number;
}

export interface SeismicLevel extends SeismicLevelInput {
  /** `Pᵢ·hᵢᵏ`, el numerador de αᵢ. */
  weightedHeight: number;
  alpha: number;
  /** Fᵢ = αᵢ·V, con el V de diseño. */
  force: number;
  /** Fᵢ con el V para derivas (sin el mínimo de C/R). Igual a `force` si el mínimo no manda. */
  driftForce: number;
}

export interface StaticSeismicInput {
  Z: number;
  U: number;
  S: number;
  R: number;
  /** El C ya calculado (ver `staticAmplificationFactor`), o el que escribió el alumno. */
  C: number;
  /** El período, para k. */
  T: number;
  levels: SeismicLevelInput[];
}

export interface StaticSeismic {
  k: number;
  /** El C/R que sale de los datos, antes de aplicar el mínimo. */
  cOverR: number;
  /** Si C/R < 0.11 y el cortante de diseño se calculó con 0.11. */
  minimumGoverns: boolean;
  /** P = Σ Pᵢ. */
  weight: number;
  /** El cortante basal de diseño (E.030, 34.1 y 34.2). */
  baseShear: number;
  /**
   * El cortante para los desplazamientos: **sin** el mínimo de C/R (E.030,
   * 50.3). Distinto de `baseShear` solo si el mínimo manda.
   */
  driftBaseShear: number;
  /** En el orden en que llegaron. */
  levels: SeismicLevel[];
}

/**
 * E.030, artículos 34 y 35: el cortante basal y su reparto en altura.
 *
 * `V = Z·U·C·S / R · P`, con `C/R ≥ 0.11`; `Fᵢ = αᵢ·V` y
 * `αᵢ = Pᵢ·hᵢᵏ / Σ Pⱼ·hⱼᵏ`.
 */
export function staticSeismicForces({ Z, U, S, R, C, T, levels }: StaticSeismicInput): StaticSeismic {
  for (const [name, value] of [
    ["Z", Z],
    ["U", U],
    ["S", S],
    ["R", R],
    ["C", C],
  ] as const) {
    if (!(value > 0)) throw new Error(`${name} tiene que ser mayor que cero.`);
  }
  if (levels.length === 0) throw new Error("Hace falta al menos un nivel.");
  levels.forEach((level, i) => {
    if (!(level.height > 0)) throw new Error(`La altura del nivel ${i + 1} tiene que ser mayor que cero.`);
    if (!(level.weight >= 0)) throw new Error(`El peso del nivel ${i + 1} no puede ser negativo.`);
  });

  const weight = levels.reduce((sum, level) => sum + level.weight, 0);
  if (!(weight > 0)) throw new Error("El peso total P tiene que ser mayor que cero.");

  const k = heightExponent(T);
  const cOverR = C / R;
  const minimumGoverns = cOverR < MIN_C_OVER_R;
  const driftBaseShear = Z * U * S * cOverR * weight;
  const baseShear = Z * U * S * Math.max(cOverR, MIN_C_OVER_R) * weight;

  const weighted = levels.map((level) => level.weight * level.height ** k);
  const total = weighted.reduce((sum, value) => sum + value, 0);

  return {
    k,
    cOverR,
    minimumGoverns,
    weight,
    baseShear,
    driftBaseShear,
    levels: levels.map((level, i) => {
      const alpha = weighted[i] / total;
      return {
        ...level,
        weightedHeight: weighted[i],
        alpha,
        force: alpha * baseShear,
        driftForce: alpha * driftBaseShear,
      };
    }),
  };
}

export interface RayleighLevel {
  weight: number;
  /** fᵢ: la fuerza lateral del nivel. */
  force: number;
  /** dᵢ: el desplazamiento lateral del nivel bajo las fᵢ. */
  displacement: number;
}

/**
 * E.030, 36.2: `T = 2π·√(Σ Pᵢ·dᵢ² / (g·Σ fᵢ·dᵢ))`. `g` en las unidades de
 * longitud del modelo (9.81 si los desplazamientos están en metros).
 */
export function rayleighPeriod(levels: RayleighLevel[], g: number): number {
  if (!(g > 0)) throw new Error("g tiene que ser mayor que cero.");
  const numerator = levels.reduce((sum, l) => sum + l.weight * l.displacement ** 2, 0);
  const denominator = g * levels.reduce((sum, l) => sum + l.force * l.displacement, 0);
  if (!(denominator > 0)) {
    throw new Error("Las fuerzas laterales no producen desplazamientos en su mismo sentido: no hay período que calcular.");
  }
  return 2 * Math.PI * Math.sqrt(numerator / denominator);
}

/** E.030, 50.1 y 50.2: por cuánto se multiplican los desplazamientos del análisis elástico. */
export function inelasticFactor(R: number, regular: boolean): number {
  if (!(R > 0)) throw new Error("R tiene que ser mayor que cero.");
  return (regular ? 0.75 : 0.85) * R;
}

function checkPeriods(T: number, TP: number, TL: number) {
  if (!(T >= 0)) throw new Error("El período T tiene que ser un número mayor o igual a cero.");
  if (!(TP > 0) || !(TL > TP)) throw new Error("Los períodos del suelo tienen que cumplir 0 < T_P < T_L.");
}
