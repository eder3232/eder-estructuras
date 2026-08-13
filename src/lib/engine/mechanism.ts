import { eigs } from "mathjs";

export interface MechanismDof {
  nodeId: string;
  localDof: number;
}

export interface MechanismDiagnosis {
  /**
   * Grados de libertad sin **ninguna** rigidez: fila entera de ceros. Es el caso
   * más común y se detecta exacto — un nudo que se agregó y todavía no se
   * conectó, o uno al que solo llegan barras paralelas entre sí.
   */
  loose: MechanismDof[];
  /**
   * Cómo se mueve la estructura sin deformarse, normalizado para que la mayor
   * componente valga 1. Es el autovector del autovalor nulo. `null` si no se
   * pudo calcular: el diagnóstico sigue sirviendo sin él.
   */
  mode: (MechanismDof & { value: number })[] | null;
}

/**
 * Diagnóstico de una matriz de rigidez que no se puede invertir.
 *
 * **Por qué esto existe en vez de un mensaje traducido.** Que `Kff` sea singular
 * no es un problema numérico: significa que la estructura es un **mecanismo**,
 * o sea que puede moverse sin deformarse — los autovalores nulos son modos de
 * cuerpo rígido, movimientos que no almacenan energía. Y en una app académica
 * ese es el error más común del principiante: apoyos insuficientes, un nudo sin
 * conectar, una barra suelta. Decir "no se puede invertir la matriz" convierte
 * el momento más didáctico del método en un callejón sin salida.
 */
export class SingularStiffnessError extends Error {
  constructor(readonly diagnosis: MechanismDiagnosis) {
    super(
      "La estructura es un mecanismo: puede moverse sin deformarse, así que no hay una solución única. " +
        "Suele faltar un apoyo o una barra.",
    );
    this.name = "SingularStiffnessError";
  }
}

/** Filas nulas de la matriz: grados de libertad a los que no se opone nada. */
export function zeroStiffnessRows(kff: number[][], tolerance = 1e-9): number[] {
  const scale = Math.max(...kff.flat().map(Math.abs), 1);
  return kff
    .map((row, i) => (row.every((value) => Math.abs(value) <= tolerance * scale) ? i : -1))
    .filter((i) => i >= 0);
}

/** Norma infinito: la mayor suma de valores absolutos de una fila. */
function infinityNorm(matrix: number[][]): number {
  return Math.max(0, ...matrix.map((row) => row.reduce((sum, value) => sum + Math.abs(value), 0)));
}

/**
 * Estimación del número de condición, `‖K‖ · ‖K⁻¹‖`.
 *
 * **Por qué hace falta y por qué no alcanza con mirar el resultado.** Invertir
 * una matriz singular no siempre falla: si el determinante da 10⁻¹⁰ en vez de 0
 * —lo normal por redondeo—, mathjs devuelve una "inversa" con números enormes y
 * el sistema se resuelve en silencio con resultados sin sentido.
 *
 * Comprobar que `Kff · Uf` reproduce el término independiente **no sirve**, y
 * vale la pena dejarlo escrito porque es la idea que aparece primero: el error
 * de esa solución vive en la dirección del modo nulo, donde `Kff · u = 0` por
 * definición, así que la ecuación se cumple igual de bien. Se probó y no
 * detectaba nada.
 *
 * El número de condición sí: una armadura sana anda en 10²–10⁵, y una que es un
 * mecanismo se dispara a 10¹⁶ o más.
 */
export function conditionEstimate(matrix: number[][], inverse: number[][]): number {
  return infinityNorm(matrix) * infinityNorm(inverse);
}

/** Arriba de esto, la solución no tiene dígitos significativos que valgan. */
export const CONDITION_LIMIT = 1e12;

/**
 * El movimiento que la estructura puede hacer sin deformarse: el autovector del
 * autovalor nulo. Devuelve `null` si la matriz no lo tiene (o si el cálculo no
 * converge, que con una matriz mal condicionada puede pasar).
 *
 * La tolerancia es **relativa** al mayor autovalor: en rigideces del orden de
 * 10⁶ un autovalor de 10⁻³ es cero a todos los efectos, y con un umbral
 * absoluto no lo sería.
 */
export function nullMode(kff: number[][], tolerance = 1e-10): number[] | null {
  return nullSpace(kff, tolerance)[0] ?? null;
}

/**
 * **Todos** los movimientos que no cuestan energía, no solo el primero.
 *
 * En una matriz de rigidez **sin condiciones de borde** son exactamente los
 * movimientos de cuerpo rígido: 3 en el plano (dos traslaciones y una rotación)
 * y 6 en el espacio. O sea que `K` sin apoyos es singular **siempre**, hasta en
 * una estructura perfectamente sujeta — no es un caso patológico, es la teoría.
 * Poner apoyos es precisamente sacarle esos modos hasta dejarla definida
 * positiva.
 *
 * Cada modo viene normalizado por su mayor componente, para poder dibujarlo tal
 * cual sea cual sea la escala de la rigidez.
 */
export function nullSpace(matrix: number[][], tolerance = 1e-10): number[][] {
  if (matrix.length === 0) return [];

  try {
    const { eigenvectors } = eigs(matrix);
    let mayor = 0;
    for (const { value } of eigenvectors) mayor = Math.max(mayor, Math.abs(Number(value)));
    if (mayor === 0) return [];

    return eigenvectors
      .filter(({ value }) => Math.abs(Number(value)) <= tolerance * mayor)
      .map(({ vector }) => {
        const raw = (vector as unknown as { toArray?: () => number[] }).toArray?.() ??
          (vector as unknown as number[]);
        const componentes = [...raw].map(Number);
        const maximo = Math.max(...componentes.map(Math.abs));
        return maximo === 0 ? [] : componentes.map((c) => c / maximo);
      })
      .filter((modo) => modo.length > 0);
  } catch {
    return [];
  }
}

/**
 * Los autovalores de una matriz simétrica, de menor a mayor.
 *
 * Para una matriz de rigidez son **la rigidez del sistema en cada dirección
 * propia**: cuánto cuesta el movimiento más barato, cuánto el más caro. Un cero
 * quiere decir que hay una dirección que no cuesta nada, y el más chico dividido
 * por el más grande es, esencialmente, el número de condición.
 */
export function spectrum(matrix: number[][]): number[] {
  if (matrix.length === 0) return [];
  try {
    const { values } = eigs(matrix);
    const raw = (values as unknown as { toArray?: () => number[] }).toArray?.() ??
      (values as unknown as number[]);
    return [...raw].map(Number).sort((a, b) => a - b);
  } catch {
    return [];
  }
}

export type LoadVerdict = "accelerates" | "indeterminate";

export interface LoadCompatibility {
  verdict: LoadVerdict;
  /** Proyección de la carga sobre cada modo, normalizada. Cero = ortogonal. */
  projections: number[];
}

/**
 * La **alternativa de Fredholm**, que es lo que decide qué significa que la
 * matriz sea singular.
 *
 * Como `K` es simétrica, su imagen es el complemento ortogonal de su núcleo, así
 * que `K · U = F` tiene solución **si y solo si `F` es ortogonal a todos los
 * modos nulos**. De ahí salen dos situaciones físicas muy distintas, y ninguna
 * es "el programa se rompió":
 *
 * - **La carga empuja en la dirección del mecanismo** (`accelerates`): no existe
 *   ninguna configuración en equilibrio. La estructura acelera, y eso ya no es
 *   un problema de estática.
 * - **La carga es ortogonal** (`indeterminate`): hay equilibrio, pero infinitas
 *   posiciones posibles. Y como el modo no deforma ninguna barra, **los
 *   esfuerzos y las reacciones quedan determinados**: lo único arbitrario es el
 *   desplazamiento.
 */
export function loadCompatibility(
  modes: number[][],
  forces: number[],
  tolerance = 1e-8,
): LoadCompatibility {
  const norma = Math.hypot(...forces) || 1;

  const projections = modes.map((mode) => {
    const dot = mode.reduce((sum, value, i) => sum + value * (forces[i] ?? 0), 0);
    return dot / (norma * (Math.hypot(...mode) || 1));
  });

  return {
    verdict: projections.some((p) => Math.abs(p) > tolerance) ? "accelerates" : "indeterminate",
    projections,
  };
}
