export interface LdlOk {
  ok: true;
  /** Pivotes, en el mismo orden que los grados de libertad de la matriz. */
  d: number[];
  /** Triangular inferior con 1 en la diagonal. */
  l: number[][];
}

export interface LdlFailure {
  ok: false;
  /** Índice del primer pivote no positivo: **es** el grado de libertad culpable. */
  failedAt: number;
  /** El pivote que falló, para poder mostrarlo. */
  pivot: number;
  /** Los que sí salieron, hasta ese punto. */
  d: number[];
}

export type LdlResult = LdlOk | LdlFailure;

/**
 * Factorización `A = L · D · Lᵀ` de una matriz simétrica, **sin pivoteo**.
 *
 * **Por qué existe.** Una matriz de rigidez con los apoyos ya aplicados es
 * simétrica y definida positiva, y para ese caso factorizar es mejor que
 * invertir por tres razones: es más rápido, es numéricamente más estable, y
 * sobre todo **falla justo cuando la matriz deja de ser definida positiva**. O
 * sea que el control de estabilidad no es un chequeo agregado encima del
 * cálculo: es el cálculo mismo, que no puede seguir. Es lo que hace cualquier
 * programa de análisis estructural, y por eso sus mensajes suenan a
 * *"instability at joint 5, DOF UX"*.
 *
 * **Sin pivoteo a propósito.** Una matriz definida positiva no lo necesita, y
 * saltearlo tiene un beneficio que acá vale más que la robustez extra: los
 * pivotes salen **en el orden de los grados de libertad**, así que el índice del
 * que falla nombra directamente al nudo y al eje. Con pivoteo habría que
 * deshacer la permutación de filas para averiguar lo mismo.
 *
 * **`LDLᵀ` y no Cholesky (`LLᵀ`)** porque evita la raíz cuadrada: Cholesky
 * revienta con la raíz de un número negativo, que es un error de dominio y no
 * un diagnóstico. Acá el pivote no positivo se devuelve como dato.
 *
 * La tolerancia es **relativa a la diagonal**: en rigideces del orden de 10⁷ un
 * pivote de 10⁻³ es cero a todos los efectos, y con un umbral absoluto no lo
 * sería.
 */
export function ldl(matrix: number[][], relativeTolerance = 1e-12): LdlResult {
  const n = matrix.length;
  const scale = Math.max(...matrix.map((row, i) => Math.abs(row[i] ?? 0)), 1);
  const tolerance = scale * relativeTolerance;

  const d: number[] = [];
  const l: number[][] = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)),
  );

  for (let j = 0; j < n; j++) {
    let pivot = matrix[j][j];
    for (let k = 0; k < j; k++) pivot -= l[j][k] * l[j][k] * d[k];

    if (!(pivot > tolerance)) {
      return { ok: false, failedAt: j, pivot, d };
    }
    d.push(pivot);

    for (let i = j + 1; i < n; i++) {
      let sum = matrix[i][j];
      for (let k = 0; k < j; k++) sum -= l[i][k] * l[j][k] * d[k];
      l[i][j] = sum / pivot;
    }
  }

  return { ok: true, d, l };
}
