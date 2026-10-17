import type { ModelExample } from "@/components/custom/model-persistence";
import type { ElementRow } from "@/app/frame2d/store/elements";
import type { LoadRow } from "@/app/frame2d/store/loads";
import type { NodeRow } from "@/app/frame2d/store/nodes";
import { DEFAULT_PARAMS, defaultCombinations, type GravityCase, type NodalLoadRow, type SeismicParams } from "./model";
import type { PersistedSeismicModel } from "./persistence";

/**
 * Pórticos listos para cargar, **cada uno para mostrar algo que los otros no
 * muestran**, como en los demás sistemas. Las lecciones están medidas en
 * `examples.test.ts`, no supuestas. En t y m.
 */
export type SeismicExample = ModelExample<PersistedSeismicModel>;

const E = 15000 * Math.sqrt(210) * 10;
const COLUMN = { area: 0.4 * 0.4, inertia: (0.4 * 0.4 ** 3) / 12 };
const BEAM = { area: 0.3 * 0.6, inertia: (0.3 * 0.6 ** 3) / 12 };

type Restraint = [boolean, boolean, boolean];
const FIXED: Restraint = [true, true, true];
const PINNED: Restraint = [true, true, false];
const FREE: Restraint = [false, false, false];

function node(prefix: string, name: string, x: number, z: number, restrained: Restraint = FREE): NodeRow {
  return {
    id: `${prefix}-${name}`,
    name,
    x,
    z,
    forceX: 0,
    forceZ: 0,
    momentR: 0,
    displacementX: 0,
    displacementZ: 0,
    displacementR: 0,
    restrainedX: restrained[0],
    restrainedZ: restrained[1],
    restrainedR: restrained[2],
    dofNumberX: 0,
    dofNumberZ: 0,
    dofNumberR: 0,
  };
}

function bar(prefix: string, name: string, from: string, to: string, section = COLUMN): ElementRow {
  return {
    id: `${prefix}-${name}`,
    name,
    fromNodeId: `${prefix}-${from}`,
    toNodeId: `${prefix}-${to}`,
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
  };
}

function load(prefix: string, name: string, element: string, q: number, loadCase: GravityCase): LoadRow {
  return {
    id: `${prefix}-${name}`,
    name,
    elementId: `${prefix}-${element}`,
    kind: "distributed",
    direction: "globalZ",
    q1: q,
    q2: q,
    wholeBar: true,
    a: 0,
    b: 0,
    projected: false,
    loadCase,
  };
}

function model(
  nodes: NodeRow[],
  elements: ElementRow[],
  loads: LoadRow[],
  extras: { params?: Partial<SeismicParams>; weights: number[]; manualForces?: number[]; nodalLoads?: NodalLoadRow[] },
): PersistedSeismicModel {
  return {
    nodes,
    elements,
    loads,
    restrainedFirst: false,
    useDofNumbers: false,
    nodalLoads: extras.nodalLoads ?? [],
    params: { ...DEFAULT_PARAMS, ...extras.params },
    levels: { weights: extras.weights, manualForces: extras.manualForces ?? extras.weights.map(() => 0) },
    combinations: defaultCombinations(),
  };
}

// ─── Tres pisos y dos vanos ────────────────────────────────────────────────
// Un diafragma de tres nudos: la columna del medio tiene dos vigas que la
// frenan en cada piso, así que es más rígida que las de los bordes.

const tp = "tres-pisos";
const tresPisos = model(
  [
    node(tp, "a1", 0, 0, FIXED),
    node(tp, "a2", 6, 0, FIXED),
    node(tp, "a3", 12, 0, FIXED),
    ...[1, 2, 3].flatMap((p) => [node(tp, `b${p}1`, 0, 3.5 * p), node(tp, `b${p}2`, 6, 3.5 * p), node(tp, `b${p}3`, 12, 3.5 * p)]),
  ],
  [
    ...[1, 2, 3].flatMap((p) => {
      const below = (i: number) => (p === 1 ? `a${i}` : `b${p - 1}${i}`);
      return [1, 2, 3].map((i) => bar(tp, `c${p}${i}`, below(i), `b${p}${i}`));
    }),
    ...[1, 2, 3].flatMap((p) => [
      bar(tp, `v${p}1`, `b${p}1`, `b${p}2`, BEAM),
      bar(tp, `v${p}2`, `b${p}2`, `b${p}3`, BEAM),
    ]),
  ],
  [1, 2, 3].flatMap((p) =>
    [1, 2].flatMap((i) => [
      load(tp, `cm${p}${i}`, `v${p}${i}`, p === 3 ? -2.5 : -3, "CM"),
      load(tp, `cv${p}${i}`, `v${p}${i}`, p === 3 ? -0.5 : -1.2, "CV"),
    ]),
  ),
  { weights: [45, 45, 30] },
);

// ─── Mandó el mínimo de C/R ────────────────────────────────────────────────
// Un pórtico flexible (columnas de 25×25, pisos pesados) en un suelo S₁: su
// período —escrito, el de Rayleigh que da la propia página— es largo, y C/R
// queda por debajo de 0.11.

const cr = "minimo-cr";
const SLENDER_COLUMN = { area: 0.25 * 0.25, inertia: (0.25 * 0.25 ** 3) / 12 };
const SLENDER_BEAM = { area: 0.25 * 0.4, inertia: (0.25 * 0.4 ** 3) / 12 };
const minimoCR = model(
  [
    node(cr, "v1", 0, 0, FIXED),
    node(cr, "v2", 6, 0, FIXED),
    node(cr, "v3", 0, 3.5, FREE),
    node(cr, "v4", 6, 3.5, FREE),
    node(cr, "v5", 0, 6.5, FREE),
    node(cr, "v6", 6, 6.5, FREE),
  ],
  [
    bar(cr, "e1", "v1", "v3", SLENDER_COLUMN),
    bar(cr, "e2", "v2", "v4", SLENDER_COLUMN),
    bar(cr, "e3", "v3", "v5", SLENDER_COLUMN),
    bar(cr, "e4", "v4", "v6", SLENDER_COLUMN),
    bar(cr, "e5", "v3", "v4", SLENDER_BEAM),
    bar(cr, "e6", "v5", "v6", SLENDER_BEAM),
  ],
  [
    load(cr, "c1", "e5", -3, "CM"),
    load(cr, "c2", "e6", -2.5, "CM"),
    load(cr, "c3", "e5", -1.2, "CV"),
    load(cr, "c4", "e6", -0.6, "CV"),
  ],
  // T = 1.24 s es el de Rayleigh de este mismo pórtico (la página da 1.242): el
  // dato es coherente con la estructura, no inventado.
  { params: { S: 1, TP: 0.4, TL: 2.5, periodMode: "manual", T: 1.24 }, weights: [60, 40] },
);

// ─── Fuerzas dadas y bases articuladas ─────────────────────────────────────
// El ejercicio de clase: las Fᵢ las da el enunciado. Con las bases articuladas
// el pórtico pierde el momento en la base y es mucho más flexible.

const ar = "articulado";
const articulado = model(
  [
    node(ar, "v1", 0, 0, PINNED),
    node(ar, "v2", 6, 0, PINNED),
    node(ar, "v3", 0, 3.5, FREE),
    node(ar, "v4", 6, 3.5, FREE),
    node(ar, "v5", 0, 6.5, FREE),
    node(ar, "v6", 6, 6.5, FREE),
  ],
  [
    bar(ar, "e1", "v1", "v3"),
    bar(ar, "e2", "v2", "v4"),
    bar(ar, "e3", "v3", "v5"),
    bar(ar, "e4", "v4", "v6"),
    bar(ar, "e5", "v3", "v4", BEAM),
    bar(ar, "e6", "v5", "v6", BEAM),
  ],
  [
    load(ar, "c1", "e5", -3, "CM"),
    load(ar, "c2", "e6", -2.5, "CM"),
    load(ar, "c3", "e5", -1.2, "CV"),
    load(ar, "c4", "e6", -0.6, "CV"),
  ],
  {
    params: { forceMode: "manual" },
    weights: [30, 20],
    manualForces: [3.5, 4.3],
    nodalLoads: [
      { id: `${ar}-p1`, name: "p1", nodeId: `${ar}-v4`, loadCase: "CV", forceX: 0, forceZ: -2, moment: 0 },
    ],
  },
);

export const seismicExamples: SeismicExample[] = [
  {
    id: "tres-pisos",
    name: "Tres pisos y dos vanos",
    description: "Diafragmas de tres nudos: la columna del medio se lleva más corte, y el piso que más deriva es el segundo.",
    model: tresPisos,
  },
  {
    id: "minimo-cr",
    name: "Mandó el mínimo de C/R",
    description: "Un pórtico flexible, T = 1.24 s: el cortante de diseño sube a C/R = 0.11, las derivas no.",
    model: minimoCR,
  },
  {
    id: "articulado",
    name: "Fuerzas dadas y bases articuladas",
    description: "Las Fᵢ del enunciado y sin momento en la base: el primer piso deriva cuatro veces más.",
    model: articulado,
  },
];
