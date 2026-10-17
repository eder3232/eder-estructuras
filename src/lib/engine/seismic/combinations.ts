import type { FrameEndForcePair } from "../frame2d/frame-element-2d";
import { memberDiagram, type DiagramValues, type MemberDiagram } from "../frame2d/member-diagrams";
import type { MemberAxis, MemberLoad } from "../frame2d/member-loads";

/**
 * Combinaciones de carga y envolvente, **por superposición**: el análisis es
 * lineal y `K` es la misma en todos los casos, así que se resuelve una vez por
 * caso (CM, CV, CS) y cada combinación es la suma de los resultados de los
 * casos por sus factores. El sismo en el otro sentido es el mismo CS con el
 * signo cambiado.
 */
export interface LoadCombination {
  id: string;
  name: string;
  /** Factor por caso; un caso que no figura vale 0. */
  factors: Record<string, number>;
}

/**
 * E.060 (2009), 9.2: 9-1, y 9-4 y 9-5 con el ± expandido. CS positivo es el
 * sismo hacia +x. Son el valor por defecto; el alumno las puede editar.
 */
export const E060_COMBINATIONS: LoadCombination[] = [
  { id: "u1", name: "1.4 CM + 1.7 CV", factors: { CM: 1.4, CV: 1.7 } },
  { id: "u2", name: "1.25 (CM + CV) + CS", factors: { CM: 1.25, CV: 1.25, CS: 1 } },
  { id: "u3", name: "1.25 (CM + CV) − CS", factors: { CM: 1.25, CV: 1.25, CS: -1 } },
  { id: "u4", name: "0.9 CM + CS", factors: { CM: 0.9, CS: 1 } },
  { id: "u5", name: "0.9 CM − CS", factors: { CM: 0.9, CS: -1 } },
];

/** Σ factor·vector, componente a componente. Los casos tienen que tener el mismo largo. */
export function combineVectors(byCase: Record<string, readonly number[]>, factors: Record<string, number>): number[] {
  const lengths = new Set(Object.values(byCase).map((v) => v.length));
  if (lengths.size > 1) throw new Error("Los casos no tienen el mismo largo.");
  const length = lengths.values().next().value ?? 0;
  const result = new Array<number>(length).fill(0);
  for (const [caseId, vector] of Object.entries(byCase)) {
    const factor = factors[caseId] ?? 0;
    if (factor === 0) continue;
    vector.forEach((value, i) => (result[i] += factor * value));
  }
  // `0 +` normaliza un `-0`: no es un dato.
  return result.map((v) => 0 + v);
}

export function combineEndForces(
  byCase: Record<string, FrameEndForcePair>,
  factors: Record<string, number>,
): FrameEndForcePair {
  const sum = (end: "from" | "to", key: "axial" | "shear" | "moment") =>
    0 + Object.entries(byCase).reduce((total, [id, pair]) => total + (factors[id] ?? 0) * pair[end][key], 0);
  const pick = (end: "from" | "to") => ({
    axial: sum(end, "axial"),
    shear: sum(end, "shear"),
    moment: sum(end, "moment"),
  });
  return { from: pick("from"), to: pick("to") };
}

export function scaleMemberLoad(load: MemberLoad, factor: number): MemberLoad {
  if (load.kind === "distributed") return { ...load, q1: factor * load.q1, q2: factor * load.q2 };
  return { ...load, value: factor * load.value };
}

export interface CaseMember {
  endForces: FrameEndForcePair;
  loads: readonly MemberLoad[];
}

/**
 * El diagrama de una combinación en una barra. **Es exacto, no interpolado**:
 * por linealidad, es el diagrama de las fuerzas de extremo combinadas con las
 * cargas escaladas por su factor. Así tiene sus propios máximos de M (donde
 * su V se anula), que no tienen por qué coincidir con los de ningún caso.
 */
export function combinedMemberDiagram(
  byCase: Record<string, CaseMember>,
  factors: Record<string, number>,
  axis: MemberAxis,
): MemberDiagram {
  const endForces = combineEndForces(
    Object.fromEntries(Object.entries(byCase).map(([id, member]) => [id, member.endForces])),
    factors,
  );
  const loads = Object.entries(byCase).flatMap(([id, member]) => {
    const factor = factors[id] ?? 0;
    return factor === 0 ? [] : member.loads.map((load) => scaleMemberLoad(load, factor));
  });
  return memberDiagram(endForces, loads, axis);
}

type Effect = keyof DiagramValues;

export interface EnvelopePoint {
  x: number;
  max: DiagramValues;
  min: DiagramValues;
  /** Qué combinación da cada máximo y cada mínimo. */
  maxBy: Record<Effect, string>;
  minBy: Record<Effect, string>;
}

const EFFECTS: Effect[] = ["N", "V", "M"];

/**
 * La envolvente de una barra: en cada estación, **el máximo y el mínimo** de
 * cada esfuerzo entre todas las combinaciones (no «el más lejano de cero»,
 * que era el bug S5 del original).
 *
 * Las estaciones son todas las de todos los diagramas, así que entran los
 * extremos de cada combinación y los bordes de cada carga. En un `x` donde
 * alguna combinación salta, van dos puntos: el de la izquierda y el de la
 * derecha.
 */
export function diagramEnvelope(diagrams: { id: string; diagram: MemberDiagram }[]): EnvelopePoint[] {
  if (diagrams.length === 0) return [];
  const length = diagrams[0].diagram.length;
  const stations = [...new Set(diagrams.flatMap(({ diagram }) => diagram.points.map((p) => p.x)))].sort((a, b) => a - b);

  const pointAt = (x: number, side: "left" | "right"): EnvelopePoint => {
    const values = diagrams.map(({ id, diagram }) => ({ id, value: diagram.at(x, side) }));
    const max = {} as DiagramValues;
    const min = {} as DiagramValues;
    const maxBy = {} as Record<Effect, string>;
    const minBy = {} as Record<Effect, string>;
    for (const effect of EFFECTS) {
      const top = values.reduce((best, v) => (v.value[effect] > best.value[effect] ? v : best));
      const bottom = values.reduce((best, v) => (v.value[effect] < best.value[effect] ? v : best));
      max[effect] = top.value[effect];
      maxBy[effect] = top.id;
      min[effect] = bottom.value[effect];
      minBy[effect] = bottom.id;
    }
    return { x, max, min, maxBy, minBy };
  };

  const points: EnvelopePoint[] = [];
  for (const x of stations) {
    const interior = x > 0 && x < length;
    const jumps =
      interior &&
      diagrams.some(({ diagram }) => {
        const l = diagram.at(x, "left");
        const r = diagram.at(x, "right");
        return EFFECTS.some((e) => Math.abs(l[e] - r[e]) > 1e-9 * (1 + Math.abs(l[e])));
      });
    if (jumps) points.push(pointAt(x, "left"));
    points.push(pointAt(x, "right"));
  }
  return points;
}
