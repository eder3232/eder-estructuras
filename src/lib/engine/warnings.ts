/**
 * Lo que el motor tiene para decir cuando **sí** pudo calcular.
 *
 * Un error corta: sin él no hay resultados. Una advertencia no — hay
 * resultados, y además hay algo que conviene saber sobre ellos. Son dos cosas
 * distintas y por eso viajan aparte: mezclarlas en un solo canal es el error
 * que cometió el proyecto original, donde un aviso de severidad `warning`
 * terminaba haciendo desaparecer los resultados enteros porque el mismo array
 * decidía si se mostraban. Está contado en `docs/errores.md`.
 *
 * Regla que se sigue de eso: **una advertencia nunca puede impedir que se
 * muestre un resultado.** Si algo tiene que impedirlo, es un error y se tira.
 */
export interface SolveWarning {
  /**
   * A qué apunta. `system` es para lo que no se puede atribuir a una fila —el
   * condicionamiento de la matriz es del modelo entero, no de un nudo.
   */
  source: "node" | "element" | "system";
  /** Id de la fila señalada, o `"-"` si `source` es `system`. */
  refId: string;
  /** Identidad estable de la advertencia, para poder distinguirlas sin mirar el texto. */
  code: "unconnected-node" | "ill-conditioned" | "dof-order-adjusted";
  /**
   * El texto para el usuario. **No nombra la fila**: el motor solo conoce ids,
   * y un id crudo en pantalla no le dice nada a nadie. Quien lo muestra tiene
   * `refId` y la tabla de nombres, así que arma "Nudo v5 — …" por su cuenta.
   */
  message: string;
}

/**
 * A partir de acá los resultados tienen menos dígitos confiables que los que se
 * muestran.
 *
 * El número no es arbitrario: un `double` tiene unos 16 dígitos decimales, y el
 * número de condición dice cuántos se pierden al resolver. Con 10⁸ se pierde la
 * mitad. Todavía se puede calcular —el límite duro para rechazar es
 * `CONDITION_LIMIT`, 10¹²— pero conviene avisar.
 */
export const CONDITION_WARNING = 1e8;

/** `null` si el condicionamiento es sano, que es el caso normal (10²–10⁵). */
export function illConditionedWarning(condition: number): SolveWarning | null {
  if (!Number.isFinite(condition) || condition <= CONDITION_WARNING) return null;

  const digits = Math.round(Math.log10(condition));
  return {
    source: "system",
    refId: "-",
    code: "ill-conditioned",
    message:
      `La matriz de rigidez está mal condicionada (número de condición ≈ 10^${digits}). ` +
      `Se pudo resolver, pero los últimos dígitos de los desplazamientos no son confiables: ` +
      `suele pasar cuando conviven barras de rigideces muy distintas, o cuando una es mucho más corta que el resto.`,
  };
}

/**
 * La numeración que cargó el alumno no es una permutación de 1..n.
 *
 * **No es un error, y ese es el punto**: el número se usa como criterio de
 * orden, así que con repetidos o con saltos igual sale un orden — solo que no
 * el que el alumno cree. Un repetido se desempata por el orden de la tabla, y
 * un salto no deja ningún hueco en la matriz. Conviene decirlo porque el caso
 * de uso de esta función es *cotejar contra el ejercicio del profesor*, y ahí
 * una numeración mal copiada da matrices que no coinciden por una razón que no
 * se ve.
 *
 * `null` si numeró 1..n sin repetir, que es lo normal.
 */
export function dofNumberingWarning(numbers: readonly number[]): SolveWarning | null {
  if (numbers.length === 0) return null;
  // Nadie numeró todavía: el orden es el de la tabla y no hay nada que avisar.
  if (numbers.every((n) => n === 0)) return null;

  const esperado = numbers.map((_, i) => i + 1);
  const ordenados = [...numbers].sort((a, b) => a - b);
  if (ordenados.every((n, i) => n === esperado[i])) return null;

  const repetidos = ordenados.filter((n, i) => i > 0 && n === ordenados[i - 1]);
  const detalle = repetidos.length > 0 ? `hay números repetidos (${[...new Set(repetidos)].join(", ")})` : "hay saltos";

  return {
    source: "system",
    refId: "-",
    code: "dof-order-adjusted",
    message:
      `La numeración de grados de libertad no va de 1 a ${numbers.length} sin repetir: ${detalle}. ` +
      `Se usó igual como criterio de orden —los repetidos se desempatan por el orden de la tabla— así que los ` +
      `resultados son correctos, pero si estás cotejando contra un ejercicio resuelto las filas pueden no coincidir.`,
  };
}

/**
 * Nudos que no toca ninguna barra.
 *
 * Casi siempre es un nudo que se agregó y quedó sin conectar. **Si está libre no
 * llega hasta acá**: sus grados de libertad no tienen ninguna rigidez que se les
 * oponga, así que el diagnóstico de mecanismo lo rechaza antes y con un mensaje
 * mucho más útil. Lo que sí llega es el nudo suelto **y restringido**, que no
 * rompe nada —los apoyos lo sostienen— pero tampoco aporta: ocupa dos filas de
 * todas las matrices para no decir nada.
 */
export function unconnectedNodeWarnings(
  nodeIds: readonly string[],
  elements: readonly { nodeIds: readonly string[] }[],
): SolveWarning[] {
  const connected = new Set<string>();
  for (const element of elements) {
    for (const nodeId of element.nodeIds) connected.add(nodeId);
  }

  return nodeIds
    .filter((nodeId) => !connected.has(nodeId))
    .map((nodeId) => ({
      source: "node" as const,
      refId: nodeId,
      code: "unconnected-node" as const,
      message:
        "No tiene ninguna barra conectada, así que no aporta rigidez al modelo. " +
        "Sus grados de libertad ocupan filas y columnas en todas las matrices sin cambiar el resultado.",
    }));
}
