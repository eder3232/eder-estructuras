import { atom } from "jotai";
import { produce } from "immer";

import { E060_COMBINATIONS, type LoadCombination } from "@/lib/engine";
import { insertIndex, nextRowName } from "@/lib/row-names";
import type { ElementRow } from "@/app/frame2d/store/elements";
import type { LoadRow } from "@/app/frame2d/store/loads";
import type { NodeRow } from "@/app/frame2d/store/nodes";
import { atomNodes } from "@/app/frame2d/store/nodes";

/**
 * Lo propio del modelo sísmico. **Nudos, barras y cargas en barras son los
 * átomos de `/frame2d`**, aislados en el `Provider` de Jotai de la página
 * (`docs/frame2d-seismic-v1.md`, paso 3); las cargas en barras llevan su caso
 * en `LoadRow.loadCase`. Lo de acá es lo que `/frame2d` no tiene.
 *
 * Las fuerzas y los desplazamientos prescritos de `NodeRow` **no se usan**:
 * las cargas en nudos van por caso, en su propia tabla (`NodalLoadRow`).
 */

export type GravityCase = "CM" | "CV";
export type CaseId = GravityCase | "CS";

export const CASES: { id: CaseId; name: string }[] = [
  { id: "CM", name: "Carga muerta" },
  { id: "CV", name: "Carga viva" },
  { id: "CS", name: "Sismo" },
];

/** Una carga en un nudo, de un caso. */
export interface NodalLoadRow {
  id: string;
  name: string;
  nodeId: string;
  loadCase: GravityCase;
  forceX: number;
  forceZ: number;
  moment: number;
}

/**
 * Los datos de la E.030. **No se eligen acá**: la zona, el suelo, la
 * categoría y el sistema estructural los decide el alumno con la norma en la
 * mano (`docs/frame2d-seismic-v1.md`, sección 3).
 */
export interface SeismicParams {
  Z: number;
  U: number;
  S: number;
  TP: number;
  TL: number;
  /** R = R₀·Iₐ·Iₚ (artículo 26). */
  R0: number;
  Ia: number;
  Ip: number;
  /** T = h_n/C_T (36.1) o escrito. */
  periodMode: "height" | "manual";
  CT: number;
  T: number;
  /** Las Fᵢ salen de la E.030 o las escribe el alumno (las que da el profesor). */
  forceMode: "e030" | "manual";
  /** 0.75R si es regular, 0.85R si no (artículo 50). */
  regular: boolean;
  /** Δᵢ/hₑᵢ admisible (Tabla N° 14). */
  driftLimit: number;
  /** En las unidades de longitud del modelo, para el período de Rayleigh. */
  g: number;
}

/** Lo que el alumno escribe por nivel, de abajo hacia arriba. Se completa con ceros si sobran niveles. */
export interface LevelInputs {
  weights: number[];
  manualForces: number[];
}

export interface SeismicExtras {
  nodalLoads: NodalLoadRow[];
  params: SeismicParams;
  levels: LevelInputs;
  combinations: LoadCombination[];
}

/** Zona 4, S₂ sin Vs30 (S = 1.10, T_P = 0.6, T_L = 2.0), categoría C, pórticos de concreto. */
export const DEFAULT_PARAMS: SeismicParams = {
  Z: 0.45,
  U: 1,
  S: 1.1,
  TP: 0.6,
  TL: 2,
  R0: 8,
  Ia: 1,
  Ip: 1,
  periodMode: "height",
  CT: 35,
  T: 0.2,
  forceMode: "e030",
  regular: true,
  driftLimit: 0.007,
  g: 9.81,
};

export const defaultCombinations = (): LoadCombination[] =>
  E060_COMBINATIONS.map((c) => ({ ...c, factors: { ...c.factors } }));

// ─── El ejemplo inicial ────────────────────────────────────────────────────
// Pórtico de dos pisos y un vano, en t y m (E = 15000·√210 kg/cm² = 2.17·10⁶ t/m²).

const E = 15000 * Math.sqrt(210) * 10;
const column = { area: 0.4 * 0.4, inertia: (0.4 * 0.4 ** 3) / 12 };
const beam = { area: 0.3 * 0.6, inertia: (0.3 * 0.6 ** 3) / 12 };

const node = (id: string, x: number, z: number, base: boolean): NodeRow => ({
  id: `seismic-${id}`,
  name: id,
  x,
  z,
  forceX: 0,
  forceZ: 0,
  momentR: 0,
  displacementX: 0,
  displacementZ: 0,
  displacementR: 0,
  restrainedX: base,
  restrainedZ: base,
  restrainedR: base,
  dofNumberX: 0,
  dofNumberZ: 0,
  dofNumberR: 0,
});

const bar = (id: string, from: string, to: string, section: { area: number; inertia: number }): ElementRow => ({
  id: `seismic-${id}`,
  name: id,
  fromNodeId: `seismic-${from}`,
  toNodeId: `seismic-${to}`,
  area: section.area,
  elasticity: E,
  inertia: section.inertia,
  manualFem: false,
  femAxialFrom: 0,
  femShearFrom: 0,
  femMomentFrom: 0,
  femAxialTo: 0,
  femShearTo: 0,
  femMomentTo: 0,
});

const beamLoad = (id: string, element: string, q: number, loadCase: GravityCase): LoadRow => ({
  id: `seismic-${id}`,
  name: id,
  elementId: `seismic-${element}`,
  kind: "distributed",
  direction: "globalZ",
  q1: q,
  q2: q,
  wholeBar: true,
  a: 0,
  b: 0,
  projected: false,
  loadCase,
});

export const seedSeismicNodes = (): NodeRow[] => [
  node("v1", 0, 0, true),
  node("v2", 6, 0, true),
  node("v3", 0, 3.5, false),
  node("v4", 6, 3.5, false),
  node("v5", 0, 6.5, false),
  node("v6", 6, 6.5, false),
];

export const seedSeismicElements = (): ElementRow[] => [
  bar("e1", "v1", "v3", column),
  bar("e2", "v2", "v4", column),
  bar("e3", "v3", "v5", column),
  bar("e4", "v4", "v6", column),
  bar("e5", "v3", "v4", beam),
  bar("e6", "v5", "v6", beam),
];

export const seedSeismicLoads = (): LoadRow[] => [
  beamLoad("c1", "e5", -3, "CM"),
  beamLoad("c2", "e6", -2.5, "CM"),
  beamLoad("c3", "e5", -1.2, "CV"),
  beamLoad("c4", "e6", -0.6, "CV"),
];

export const seedSeismicExtras = (): SeismicExtras => ({
  nodalLoads: [],
  params: { ...DEFAULT_PARAMS },
  levels: { weights: [30, 20], manualForces: [0, 0] },
  combinations: defaultCombinations(),
});

// ─── Átomos ────────────────────────────────────────────────────────────────
// Los valores iniciales son la semilla: la página restaura lo guardado en su
// store antes de dibujar (ver `persistence.ts`).

const seed = seedSeismicExtras();

export const atomNodalLoadsBase = atom<NodalLoadRow[]>(seed.nodalLoads);
export const atomNodalLoads = atom((get) => get(atomNodalLoadsBase));

export const atomSeismicParamsBase = atom<SeismicParams>(seed.params);
export const atomSeismicParams = atom((get) => get(atomSeismicParamsBase));

export const atomLevelInputsBase = atom<LevelInputs>(seed.levels);
export const atomLevelInputs = atom((get) => get(atomLevelInputsBase));

export const atomCombinationsBase = atom<LoadCombination[]>(seed.combinations);
export const atomCombinations = atom((get) => get(atomCombinationsBase));

// ─── Cargas en nudos ───────────────────────────────────────────────────────

/** Copia la fila de arriba salvo el nombre, como las otras tablas. */
export const atomAddNodalLoad = atom(null, (get, set, input?: { afterId?: string }) => {
  set(
    atomNodalLoadsBase,
    produce((draft: NodalLoadRow[]) => {
      const at = insertIndex(draft, input?.afterId);
      const previous = draft[at - 1] ?? draft[draft.length - 1];
      const free = get(atomNodes).find((n) => !n.restrainedX || !n.restrainedZ);
      const base: Omit<NodalLoadRow, "id" | "name"> = previous
        ? { ...previous }
        : { nodeId: free?.id ?? "", loadCase: "CM", forceX: 0, forceZ: 0, moment: 0 };
      draft.splice(at, 0, {
        ...base,
        id: crypto.randomUUID(),
        name: nextRowName(
          "p",
          draft.map((l) => l.name),
        ),
      });
    }),
  );
});

export const atomRemoveNodalLoad = atom(null, (get, set, id: string) => {
  set(atomNodalLoadsBase, (rows) => rows.filter((r) => r.id !== id));
});

type NodalLoadUpdate =
  | { id: string; field: "name" | "nodeId"; value: string }
  | { id: string; field: "loadCase"; value: GravityCase }
  | { id: string; field: "forceX" | "forceZ" | "moment"; value: number };

export const atomUpdateNodalLoad = atom(null, (get, set, input: NodalLoadUpdate) => {
  set(
    atomNodalLoadsBase,
    produce((draft: NodalLoadRow[]) => {
      const row = draft.find((r) => r.id === input.id);
      if (row) Object.assign(row, { [input.field]: input.value });
    }),
  );
});

// ─── Parámetros y niveles ──────────────────────────────────────────────────

export const atomUpdateSeismicParams = atom(null, (get, set, patch: Partial<SeismicParams>) => {
  set(atomSeismicParamsBase, { ...get(atomSeismicParamsBase), ...patch });
});

export const atomUpdateLevelInput = atom(
  null,
  (get, set, input: { field: keyof LevelInputs; index: number; value: number }) => {
    set(
      atomLevelInputsBase,
      produce((draft: LevelInputs) => {
        const list = draft[input.field];
        while (list.length <= input.index) list.push(0);
        list[input.index] = input.value;
      }),
    );
  },
);

// ─── Combinaciones ─────────────────────────────────────────────────────────

export const atomAddCombination = atom(null, (get, set) => {
  set(
    atomCombinationsBase,
    produce((draft: LoadCombination[]) => {
      draft.push({
        id: crypto.randomUUID(),
        name: nextRowName(
          "U",
          draft.map((c) => c.name),
        ),
        factors: { CM: 1, CV: 1, CS: 0 },
      });
    }),
  );
});

export const atomRemoveCombination = atom(null, (get, set, id: string) => {
  set(atomCombinationsBase, (rows) => rows.filter((r) => r.id !== id));
});

export const atomUpdateCombination = atom(
  null,
  (get, set, input: { id: string; name: string } | { id: string; caseId: CaseId; factor: number }) => {
    set(
      atomCombinationsBase,
      produce((draft: LoadCombination[]) => {
        const row = draft.find((r) => r.id === input.id);
        if (!row) return;
        if ("name" in input) row.name = input.name;
        else row.factors[input.caseId] = input.factor;
      }),
    );
  },
);

/** Vuelve a las cinco de la E.060. */
export const atomResetCombinations = atom(null, (get, set) => {
  set(atomCombinationsBase, defaultCombinations());
});
