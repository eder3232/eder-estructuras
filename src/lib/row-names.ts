/**
 * Nombre libre más chico con el prefijo dado: `v3`, `e7`, etc.
 *
 * Contar filas (`v${filas.length + 1}`) no alcanza en cuanto se puede borrar una
 * fila del medio o insertar entre dos existentes: con `v1, v2, v3`, borrar `v2`
 * y agregar de nuevo produce otro `v3`. En este repo las barras referencian
 * nudos por `id`, así que un nombre repetido no rompe el cálculo — pero deja dos
 * filas indistinguibles en los selectores "Desde"/"Hacia" y en toda la salida
 * pedagógica, que se rotula por nombre.
 *
 * Solo mira los nombres con la forma `prefijo + número`: si el usuario renombró
 * una fila a mano ("apoyo izq"), ese nombre no participa de la numeración.
 */
export function nextRowName(prefix: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  let n = 1;
  while (used.has(`${prefix}${n}`)) n += 1;
  return `${prefix}${n}`;
}

/**
 * Posición donde insertar una fila nueva: justo debajo de `afterId`, o al final
 * si no se pasa (botón del encabezado) o si el id ya no existe.
 */
export function insertIndex<T extends { id: string }>(rows: readonly T[], afterId?: string): number {
  if (afterId === undefined) return rows.length;
  const index = rows.findIndex((row) => row.id === afterId);
  return index === -1 ? rows.length : index + 1;
}
