import { inv, multiply, subtract } from "mathjs";
import type { AssemblyResult } from "../system";

/**
 * La condensación estática: de las ecuaciones `K·u = F` con fuerzas solo en
 * los grados `a`, se eliminan los `b` y queda
 *
 *   `K_c = K_aa − K_ab · K_bb⁻¹ · K_ba`,
 *
 * la rigidez que «ve» quien empuja solo por `a`. Con `a` = la traslación de
 * cada piso es la **rigidez lateral** del pórtico, el puente entre el método
 * matricial y el análisis sísmico de edificios.
 */
export interface Condensation {
  /** Posiciones (en la matriz que se condensó) de los grados que se conservan, en ese orden. */
  keep: number[];
  /** Las de los que se eliminan. */
  drop: number[];
  kaa: number[][];
  kab: number[][];
  kba: number[][];
  kbb: number[][];
  /** `K_bb⁻¹`; vacía si no hay nada que eliminar. */
  kbbInverse: number[][];
  /** `K_ab · K_bb⁻¹ · K_ba`, lo que se le resta a `K_aa`. */
  correction: number[][];
  condensed: number[][];
}

const gather = (matrix: number[][], rows: number[], cols: number[]) => rows.map((r) => cols.map((c) => matrix[r][c]));

export function condense(k: number[][], keep: number[]): Condensation {
  const size = k.length;
  if (keep.length === 0) throw new Error("Hay que conservar al menos un grado de libertad.");
  if (new Set(keep).size !== keep.length || keep.some((i) => !(i >= 0 && i < size && Number.isInteger(i)))) {
    throw new Error("Los grados a conservar tienen que ser posiciones distintas de la matriz.");
  }
  const kept = new Set(keep);
  const drop = [...Array(size).keys()].filter((i) => !kept.has(i));

  const kaa = gather(k, keep, keep);
  const kab = gather(k, keep, drop);
  const kba = gather(k, drop, keep);
  const kbb = gather(k, drop, drop);

  if (drop.length === 0) {
    const zero = keep.map(() => keep.map(() => 0));
    return { keep, drop, kaa, kab, kba, kbb, kbbInverse: [], correction: zero, condensed: kaa.map((row) => [...row]) };
  }

  let kbbInverse: number[][];
  try {
    kbbInverse = inv(kbb) as number[][];
  } catch {
    throw new Error("K_bb es singular: los grados que se eliminan no están sostenidos por sí solos.");
  }
  const correction = multiply(multiply(kab, kbbInverse), kba) as number[][];
  const condensed = subtract(kaa, correction) as number[][];
  return { keep, drop, kaa, kab, kba, kbb, kbbInverse, correction, condensed };
}

export interface LateralStiffness extends Condensation {
  /** El diafragma de cada fila de `condensed`, en el orden pedido. */
  diaphragmIds: string[];
  /** El índice global de cada grado de `kff`, para poder rotular las matrices. */
  freeGlobalIndices: number[];
}

/**
 * La rigidez lateral de un pórtico con diafragmas: condensa `K_ff` (la de los
 * grados libres) dejando la traslación de cada diafragma, en el orden de
 * `diaphragmIds` (de abajo hacia arriba, si los niveles se piden así).
 */
export function lateralStiffness(assembly: AssemblyResult, diaphragmIds: string[]): LateralStiffness {
  const { free, kff } = assembly.partition;
  const keep = diaphragmIds.map((id) => {
    const entry = assembly.dofOrder.find((e) => e.diaphragmId === id);
    if (!entry) throw new Error(`El diafragma ${id} no está en el sistema.`);
    const position = free.indexOf(entry.globalIndex);
    if (position < 0) throw new Error(`El grado del diafragma ${id} está restringido.`);
    return position;
  });
  return { ...condense(kff, keep), diaphragmIds, freeGlobalIndices: free };
}
