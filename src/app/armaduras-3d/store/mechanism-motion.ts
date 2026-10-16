import type { MechanismDiagnosis } from "@/lib/engine";

/** Cómo se mueve un nudo en el mecanismo: un vector, con la mayor norma del conjunto igual a 1. */
export interface NodeMotion {
  nodeId: string;
  vector: [number, number, number];
}

/** Por debajo de esto, relativo a la mayor componente, el nudo no se mueve. */
const MOVES = 1e-6;

/**
 * El diagnóstico de mecanismo, agrupado por nudo para poder dibujarlo.
 *
 * El modo del motor viene por grado de libertad (`a` en x, `a` en z, …) y una
 * flecha por grado diría tres cosas donde hay una: el nudo se mueve **en una
 * dirección**, la suma de sus componentes. Si el motor no pudo calcular el modo,
 * quedan los grados sueltos, que se sabe exacto cuáles son: cada uno es un
 * movimiento posible sobre su eje.
 *
 * El signo no significa nada —un modo vale lo mismo multiplicado por −1—, así
 * que lo que se dibuja es una dirección, no un sentido elegido.
 */
export function mechanismMotion(diagnosis: MechanismDiagnosis): NodeMotion[] {
  const components = diagnosis.mode ?? diagnosis.loose.map((dof) => ({ ...dof, value: 1 }));
  const byNode = new Map<string, [number, number, number]>();
  for (const { nodeId, localDof, value } of components) {
    const vector = byNode.get(nodeId) ?? [0, 0, 0];
    vector[localDof] += value;
    byNode.set(nodeId, vector);
  }

  const norm = (v: [number, number, number]) => Math.hypot(...v);
  const largest = Math.max(0, ...[...byNode.values()].map(norm));
  if (largest === 0) return [];

  return [...byNode]
    .filter(([, vector]) => norm(vector) > MOVES * largest)
    .map(([nodeId, vector]) => ({ nodeId, vector: vector.map((c) => c / largest) as [number, number, number] }));
}
