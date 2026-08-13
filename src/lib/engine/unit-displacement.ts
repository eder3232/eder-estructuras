import type { AssemblyResult } from "./system";

export interface UnitDisplacementForce {
  nodeId: string;
  localDof: number;
  /** `K[i][j]`: la fuerza que aparece en este grado de libertad. */
  value: number;
}

export interface UnitDisplacementState {
  /** Desplazamiento por nudo: 1 en el grado de libertad elegido, 0 en todos los demás. */
  displacements: Map<string, number[]>;
  /** Fuerza por grado de libertad, en el orden de `dofOrder`. Es la columna `j` de la matriz global. */
  forces: UnitDisplacementForce[];
}

/**
 * El experimento que define a la matriz de rigidez: se impone un **desplazamiento
 * unitario** en un grado de libertad, se mantienen todos los demás en cero, y se
 * pregunta qué fuerzas hacen falta para sostener esa configuración.
 *
 * La respuesta es la columna `j` de `K`, por definición de `K·U = F` con
 * `U = e_j`. O sea que **una columna de la matriz no es una lista de números:
 * es un experimento físico completo**, y esta función devuelve las dos mitades
 * —la deformada y las fuerzas— para poder dibujarlas juntas.
 *
 * No hay cálculo nuevo acá: `K` ya está ensamblada. Lo único que hace esta
 * función es reordenar lo que el motor ya sabe en la forma que consume la capa
 * de visualización, que trabaja por nudo y no por índice global.
 */
export function unitDisplacementState(assembly: AssemblyResult, globalIndex: number): UnitDisplacementState {
  const total = assembly.dofOrder.length;
  if (!Number.isInteger(globalIndex) || globalIndex < 0 || globalIndex >= total) {
    throw new Error(`El grado de libertad ${globalIndex} no existe (hay ${total}).`);
  }

  const displacements = new Map<string, number[]>();
  for (const entry of assembly.dofOrder) {
    const vector = displacements.get(entry.nodeId) ?? [];
    vector[entry.localDof] = entry.globalIndex === globalIndex ? 1 : 0;
    displacements.set(entry.nodeId, vector);
  }

  // `K[i][j]` es la fuerza en el DOF i por el desplazamiento unitario en j, así
  // que se recorre la **columna** j: la fila es dónde aparece la fuerza.
  const forces = assembly.dofOrder.map((entry) => ({
    nodeId: entry.nodeId,
    localDof: entry.localDof,
    value: assembly.globalStiffness[entry.globalIndex][globalIndex],
  }));

  return { displacements, forces };
}
