import { atom } from "jotai";

import {
  amplificationFactor,
  periodFromHeight,
  staticAmplificationFactor,
  staticSeismicForces,
  type Amplification,
  type StaticSeismic,
} from "@/lib/engine";
import { atomNodes, type NodeRow } from "@/app/frame2d/store/nodes";
import { atomLevelInputs, atomSeismicParams, type LevelInputs, type SeismicParams } from "./model";

/**
 * Un nivel del edificio: los nudos con la misma cota y la x libre. Con dos o
 * más nudos es un **diafragma rígido** (E.030, 30.3): comparten la traslación.
 */
export interface Level {
  /** «Nivel 1» es el más bajo. */
  id: string;
  name: string;
  z: number;
  /** hᵢ: desde la base. */
  height: number;
  /** En el orden de la tabla: el primero es el dueño del grado compartido. */
  nodeIds: string[];
}

/** Dos cotas que difieren en menos que esto son el mismo nivel (redondeo al escribir 3.5 vs 3.50000001). */
const SAME_LEVEL = 1e-9;

/**
 * Los niveles salen solos de la geometría. La base es la cota más baja del
 * modelo; un nivel es toda cota más alta que tenga algún nudo con la x libre.
 * Un nudo con la x restringida no entra (fijaría el piso entero).
 */
export function deriveLevels(nodes: NodeRow[]): Level[] {
  if (nodes.length === 0) return [];
  const base = Math.min(...nodes.map((n) => n.z));
  const groups: { z: number; nodeIds: string[] }[] = [];
  for (const node of nodes) {
    if (node.restrainedX || node.z - base <= SAME_LEVEL) continue;
    const group = groups.find((g) => Math.abs(g.z - node.z) <= SAME_LEVEL);
    if (group) group.nodeIds.push(node.id);
    else groups.push({ z: node.z, nodeIds: [node.id] });
  }
  return groups
    .sort((a, b) => a.z - b.z)
    .map((g, i) => ({
      id: `nivel-${i + 1}`,
      name: `Nivel ${i + 1}`,
      z: g.z,
      height: g.z - base,
      nodeIds: g.nodeIds,
    }));
}

export const atomLevels = atom((get) => deriveLevels(get(atomNodes)));

/** Los diafragmas que van al motor: solo los niveles con más de un nudo. */
export const atomDiaphragms = atom((get) =>
  get(atomLevels)
    .filter((level) => level.nodeIds.length > 1)
    .map((level) => ({ id: level.id, nodeIds: level.nodeIds })),
);

export type SeismicForces =
  | {
      status: "ok";
      mode: "e030";
      R: number;
      /** h_n: la altura del nivel más alto. */
      hn: number;
      T: number;
      /** C(T) de la Tabla N° 6, para mostrar; el que se usa es `amplification`. */
      table: Amplification;
      /** C para el estático (18.3). */
      amplification: Amplification;
      detail: StaticSeismic;
      /** Fᵢ de diseño por nivel, de abajo hacia arriba. */
      forces: number[];
      /** Por cuánto multiplicar los desplazamientos de CS para las derivas (50.3): V_derivas / V. */
      driftScale: number;
    }
  | { status: "ok"; mode: "manual"; R: number; forces: number[]; driftScale: 1 }
  | { status: "empty"; reason: "no-levels" }
  | { status: "error"; message: string };

export function seismicForces(levels: Level[], params: SeismicParams, inputs: LevelInputs): SeismicForces {
  if (levels.length === 0) return { status: "empty", reason: "no-levels" };
  const R = params.R0 * params.Ia * params.Ip;
  if (!(R > 0)) return { status: "error", message: "R = R₀·Iₐ·Iₚ tiene que ser mayor que cero." };

  if (params.forceMode === "manual") {
    return { status: "ok", mode: "manual", R, forces: levels.map((_, i) => inputs.manualForces[i] ?? 0), driftScale: 1 };
  }

  try {
    const hn = levels[levels.length - 1].height;
    const T = params.periodMode === "height" ? periodFromHeight(hn, params.CT) : params.T;
    const table = amplificationFactor(T, params.TP, params.TL);
    const amplification = staticAmplificationFactor(T, params.TP, params.TL);
    const detail = staticSeismicForces({
      Z: params.Z,
      U: params.U,
      S: params.S,
      R,
      C: amplification.C,
      T,
      levels: levels.map((level, i) => ({ height: level.height, weight: inputs.weights[i] ?? 0 })),
    });
    return {
      status: "ok",
      mode: "e030",
      R,
      hn,
      T,
      table,
      amplification,
      detail,
      forces: detail.levels.map((l) => l.force),
      driftScale: detail.driftBaseShear / detail.baseShear,
    };
  } catch (e) {
    return { status: "error", message: e instanceof Error ? e.message : String(e) };
  }
}

export const atomSeismicForces = atom((get) =>
  seismicForces(get(atomLevels), get(atomSeismicParams), get(atomLevelInputs)),
);
