import { atom } from "jotai";
import { inv, multiply } from "mathjs";

import {
  combineEndForces,
  combineVectors,
  combinedMemberDiagram,
  condense,
  diagramEnvelope,
  inelasticFactor,
  rayleighPeriod,
  storyDrifts,
  type CaseMember,
  type Condensation,
  type EnvelopePoint,
  type FrameEndForcePair,
  type FrameInternalForce,
  type LoadCombination,
  type MemberDiagram,
  type SolveResult,
  type StoryDrift,
} from "@/lib/engine";
import { atomElements } from "@/app/frame2d/store/elements";
import { dofLabels } from "@/app/frame2d/store/nodes";
import type { Frame2DMemberLoads, Frame2DResults } from "@/app/frame2d/store/results";
import { caseViews } from "./cases";
import { CASES, atomCombinations, atomLevelInputs, atomSeismicParams, type CaseId } from "./model";
import { atomLevels, atomSeismicForces, type Level } from "./seismic";

type Solved = Record<CaseId, SolveResult>;

/** Los tres casos resueltos, o `null` si alguno no se pudo: sin los tres no hay combinaciones. */
const atomSolvedCases = atom((get): Solved | null => {
  const solved = {} as Solved;
  for (const { id } of CASES) {
    const results: Frame2DResults = get(caseViews[id].atomResults);
    if (results.status !== "ok") return null;
    solved[id] = results.solved;
  }
  return solved;
});

// ─── Rigidez lateral, Rayleigh y derivas ───────────────────────────────────

export interface LateralAnalysis {
  status: "ok";
  levels: Level[];
  /** La condensación de `K_ff` dejando la traslación de cada nivel, de abajo hacia arriba. */
  condensation: Condensation;
  /** Los índices globales de `K_ff`, para rotular `K_aa`, `K_ab`… */
  freeGlobalIndices: number[];
  /** Fᵢ del caso CS. */
  forces: number[];
  /** δ = K_L⁻¹·F: los desplazamientos laterales por la matriz condensada. */
  condensedDisplacements: number[];
  /** Los mismos, del análisis completo de CS. Tienen que coincidir: es el control. */
  displacements: number[];
  /** E.030, 36.2; `null` sin pesos o sin fuerzas. */
  rayleighPeriod: number | null;
  /** 0.75R o 0.85R. */
  inelasticFactor: number;
  /** V_derivas / V (50.3): 1 salvo que el mínimo de C/R mande. */
  driftScale: number;
  drifts: StoryDrift[];
}

export type LateralResult =
  | LateralAnalysis
  | { status: "unavailable"; reason: "no-levels" | "case-error" | "seismic-error" }
  | { status: "error"; message: string };

/** El índice (en `K_ff`) de la traslación de un nivel: la del primer nudo, que es el dueño si hay diafragma. */
function lateralPosition(solved: SolveResult, level: Level): number {
  const entry = solved.assembly.dofOrder.find((e) => e.nodeId === level.nodeIds[0] && e.localDof === 0);
  if (!entry) throw new Error(`${level.name} no está en el sistema.`);
  return solved.assembly.partition.free.indexOf(entry.globalIndex);
}

export const atomLateralAnalysis = atom((get): LateralResult => {
  const levels = get(atomLevels);
  if (levels.length === 0) return { status: "unavailable", reason: "no-levels" };
  const seismic = get(atomSeismicForces);
  if (seismic.status !== "ok") return { status: "unavailable", reason: seismic.status === "empty" ? "no-levels" : "seismic-error" };
  const solved = get(atomSolvedCases);
  if (!solved) return { status: "unavailable", reason: "case-error" };

  try {
    const cs = solved.CS;
    const keep = levels.map((level) => lateralPosition(cs, level));
    const condensation = condense(cs.assembly.partition.kff, keep);
    const forces = seismic.forces;
    const condensedDisplacements = (multiply(inv(condensation.condensed), forces.map((f) => [f])) as number[][]).map(
      (row) => row[0],
    );
    const displacements = levels.map((level) => cs.displacements.get(level.nodeIds[0])![0]);

    const weights = get(atomLevelInputs).weights;
    let period: number | null = null;
    try {
      period = rayleighPeriod(
        levels.map((_, i) => ({ weight: weights[i] ?? 0, force: forces[i], displacement: displacements[i] })),
        get(atomSeismicParams).g,
      );
      if (!(period > 0)) period = null;
    } catch {
      period = null;
    }

    const params = get(atomSeismicParams);
    const factor = inelasticFactor(seismic.R, params.regular);
    const drifts = storyDrifts({
      heights: levels.map((l) => l.height),
      displacements: displacements.map((d) => d * seismic.driftScale),
      factor,
      limit: params.driftLimit,
    });

    return {
      status: "ok",
      levels,
      condensation,
      freeGlobalIndices: cs.assembly.partition.free,
      forces,
      condensedDisplacements,
      displacements,
      rayleighPeriod: period,
      inelasticFactor: factor,
      driftScale: seismic.driftScale,
      drifts,
    };
  } catch (e) {
    return { status: "error", message: e instanceof Error ? e.message : String(e) };
  }
});

// ─── Combinaciones y envolvente ────────────────────────────────────────────

export interface CombinationResult {
  combination: LoadCombination;
  displacements: Map<string, number[]>;
  reactions: Map<string, number[]>;
  endForces: Map<string, FrameEndForcePair>;
  diagrams: Map<string, MemberDiagram>;
}

export interface ReactionEnvelope {
  max: number[];
  min: number[];
  maxBy: string[];
  minBy: string[];
}

export type CombinationsResult =
  | {
      status: "ok";
      combinations: CombinationResult[];
      /** Por barra. */
      envelope: Map<string, EnvelopePoint[]>;
      /** Por nudo con algún grado restringido. */
      reactions: Map<string, ReactionEnvelope>;
    }
  | { status: "unavailable"; reason: "case-error" | "no-combinations" };

const byCase = <T>(make: (id: CaseId) => T): Record<CaseId, T> =>
  Object.fromEntries(CASES.map(({ id }) => [id, make(id)])) as Record<CaseId, T>;

export const atomCombinationResults = atom((get): CombinationsResult => {
  const solved = get(atomSolvedCases);
  if (!solved) return { status: "unavailable", reason: "case-error" };
  const combinations = get(atomCombinations);
  if (combinations.length === 0) return { status: "unavailable", reason: "no-combinations" };

  const memberLoads = byCase((id): Frame2DMemberLoads => get(caseViews[id].atomMemberLoads));
  const elements = get(atomElements);
  const nodeIds = [...solved.CM.displacements.keys()];

  const results: CombinationResult[] = combinations.map((combination) => {
    const { factors } = combination;
    const perNode = (pick: (s: SolveResult) => Map<string, number[]>) =>
      new Map(nodeIds.map((id) => [id, combineVectors(byCase((c) => pick(solved[c]).get(id)!), factors)]));

    const endForces = new Map<string, FrameEndForcePair>();
    const diagrams = new Map<string, MemberDiagram>();
    for (const element of elements) {
      const members = byCase(
        (c): CaseMember => ({
          endForces: solved[c].internalForces.get(element.id) as FrameInternalForce,
          loads: memberLoads[c].loadsByElement.get(element.id) ?? [],
        }),
      );
      const axis = memberLoads.CM.axisByElement.get(element.id);
      endForces.set(element.id, combineEndForces(byCase((c) => members[c].endForces), factors));
      if (axis) diagrams.set(element.id, combinedMemberDiagram(members, factors, axis));
    }

    return {
      combination,
      displacements: perNode((s) => s.displacements),
      reactions: perNode((s) => s.reactions),
      endForces,
      diagrams,
    };
  });

  const envelope = new Map(
    elements
      .filter((e) => results[0].diagrams.has(e.id))
      .map((e) => [
        e.id,
        diagramEnvelope(results.map((r) => ({ id: r.combination.id, diagram: r.diagrams.get(e.id)! }))),
      ]),
  );

  const restrainedNodes = get(caseViews.CM.atomNodes).filter((n) => n.restrainedX || n.restrainedZ || n.restrainedR);
  const reactions = new Map(
    restrainedNodes.map((node) => {
      const values = results.map((r) => ({ id: r.combination.id, value: r.reactions.get(node.id)! }));
      const pick = (better: (a: number, b: number) => boolean) => {
        const value: number[] = [];
        const by: string[] = [];
        for (let i = 0; i < 3; i++) {
          const best = values.reduce((acc, v) => (better(v.value[i], acc.value[i]) ? v : acc));
          value.push(best.value[i]);
          by.push(best.id);
        }
        return { value, by };
      };
      const max = pick((a, b) => a > b);
      const min = pick((a, b) => a < b);
      return [node.id, { max: max.value, min: min.value, maxBy: max.by, minBy: min.by }];
    }),
  );

  return { status: "ok", combinations: results, envelope, reactions };
});

/**
 * El rótulo de cada grado de libertad de `K_ff`: el del piso si es de un
 * diafragma («N1 x»), el del nudo si no («v3θ»). Lo usan la página y el Excel;
 * `space` es el espacio entre el piso y el eje (la página pone uno que no parte
 * el renglón).
 */
export function freeDofLabels(results: Frame2DResults, freeGlobalIndices: number[], space = " "): string[] {
  if (results.status !== "ok") return freeGlobalIndices.map(String);
  const byIndex = new Map(results.solved.assembly.dofOrder.map((e) => [e.globalIndex, e]));
  return freeGlobalIndices.map((index) => {
    const entry = byIndex.get(index);
    if (!entry) return String(index);
    if (entry.diaphragmId) return `${entry.diaphragmId.replace("Nivel ", "N")}${space}x`;
    return `${results.nodesById.get(entry.nodeId)?.name ?? entry.nodeId}${dofLabels[entry.localDof]}`;
  });
}
