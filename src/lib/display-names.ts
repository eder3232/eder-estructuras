/**
 * Reemplaza los ids internos por los nombres que ve el alumno en un mensaje
 * del motor.
 *
 * **El motor solo conoce ids, y está bien que así sea**: los nombres son de la
 * UI y cambiarlos no debería recalcular nada. Pero sus mensajes se arman con
 * esos ids, y llegaban tal cual a la pantalla — «El elemento **seed-e1** debe
 * tener área positiva», con un título arriba que sí decía «e1». Se encontró
 * revisando `/springs` (2026-10-14) y alcanzaba también a `/armaduras-2d`.
 *
 * Se traduce acá, en el borde entre el motor y la UI, y no reescribiendo los
 * mensajes del motor sin sujeto: así siguen siendo útiles en los tests y en
 * cualquier otro lugar que no tenga la tabla de nombres a mano.
 */
export function withDisplayNames(message: string, names: ReadonlyMap<string, string>): string {
  // De más largo a más corto: si no, `seed-v1` se comería el principio de
  // `seed-v10` y quedaría `v10` convertido en `v1` + `0`.
  const ids = [...names.keys()].filter((id) => message.includes(id)).sort((a, b) => b.length - a.length);
  return ids.reduce((text, id) => text.split(id).join(names.get(id)!), message);
}

/** La tabla de nombres de un modelo: nudos y elementos juntos, porque un mensaje puede nombrar a los dos. */
export function displayNames(...rows: readonly { id: string; name: string }[][]): Map<string, string> {
  return new Map(rows.flat().map((row) => [row.id, row.name]));
}
