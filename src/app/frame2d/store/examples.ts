import type { ModelExample } from "@/components/custom/model-persistence";
import type { ElementRow } from "./elements";
import type { LoadRow } from "./loads";
import type { NodeRow } from "./nodes";
import type { PersistedModel } from "./persisted-model";

/**
 * Pórticos listos para cargar, **cada uno para mostrar algo que los demás no
 * muestran** —el criterio de los otros sistemas— y los tres con cargas en las
 * barras, que es lo que el pórtico inicial (la regresión del motor) no tiene.
 * Las lecciones están medidas en `examples.test.ts`, no supuestas: dos veces en
 * este repo una lección supuesta resultó falsa.
 */
export type Example = ModelExample<PersistedModel>;

/** Hormigón de f'c = 210 kg/cm², como el pórtico inicial: E = 15000·√210 kg/cm², en tonf/m². */
const ELASTICITY = 15000 * Math.sqrt(210) * 10;
const COLUMN = { area: 0.3 * 0.4, inertia: (0.3 * 0.4 ** 3) / 12 };
const BEAM = { area: 0.3 * 0.5, inertia: (0.3 * 0.5 ** 3) / 12 };

type Restraint = [boolean, boolean, boolean];
const FIXED: Restraint = [true, true, true];
const PINNED: Restraint = [true, true, false];
const ROLLER: Restraint = [false, true, false];
const FREE: Restraint = [false, false, false];

/** Los ids son estables y legibles a propósito: se guardan y se leen a mano al depurar. */
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

function bar(
  prefix: string,
  name: string,
  from: string,
  to: string,
  section: { area: number; inertia: number },
): ElementRow {
  return {
    id: `${prefix}-${name}`,
    name,
    fromNodeId: `${prefix}-${from}`,
    toNodeId: `${prefix}-${to}`,
    elasticity: ELASTICITY,
    ...section,
    manualFem: false,
    femAxialFrom: 0,
    femShearFrom: 0,
    femMomentFrom: 0,
    femAxialTo: 0,
    femShearTo: 0,
    femMomentTo: 0,
  };
}

function load(prefix: string, name: string, element: string, fields: Partial<LoadRow>): LoadRow {
  return {
    id: `${prefix}-${name}`,
    name,
    elementId: `${prefix}-${element}`,
    kind: "distributed",
    direction: "globalZ",
    q1: 0,
    q2: 0,
    wholeBar: true,
    a: 0,
    b: 0,
    projected: false,
    ...fields,
  };
}

const model = (nodes: NodeRow[], elements: ElementRow[], loads: LoadRow[]): PersistedModel => ({
  nodes,
  elements,
  loads,
  restrainedFirst: false,
  useDofNumbers: false,
});

/**
 * Una viga de dos tramos iguales sobre tres apoyos, con la misma carga
 * uniforme en los dos. **Es el caso de libro para cotejar contra el
 * pizarrón**: el momento sobre el apoyo del medio es `−qL²/8 = −31.25`, las
 * reacciones de los extremos `3qL/8` y la del medio `10qL/8`. Hiperestática
 * de grado 1 (`3·2 + 4 − 3·3`), y el diagrama de momentos cambia de signo
 * dos veces: el apoyo del medio tracciona la fibra de **arriba**.
 */
const continua = model(
  [node("vc", "a", 0, 0, PINNED), node("vc", "b", 5, 0, ROLLER), node("vc", "c", 10, 0, ROLLER)],
  [bar("vc", "e1", "a", "b", BEAM), bar("vc", "e2", "b", "c", BEAM)],
  [load("vc", "c1", "e1", { q1: -10, q2: -10 }), load("vc", "c2", "e2", { q1: -10, q2: -10 })],
);

/**
 * Un pórtico a dos aguas: dos columnas empotradas de 4 m y una cubierta que
 * sube 2 m hasta la cumbrera, con su peso **por metro de planta**. Lo que
 * enseña es la proyección: las dos vigas inclinadas miden 5.39 m cada una,
 * pero la carga total es `8 × 10 = 80` (la luz en planta) y no `8 × 10.77`.
 * Las vigas trabajan además a compresión, cosa que una viga horizontal con
 * carga vertical no hace.
 */
const dosAguas = model(
  [
    node("da", "a", 0, 0, FIXED),
    node("da", "b", 0, 4),
    node("da", "c", 5, 6),
    node("da", "d", 10, 4),
    node("da", "e", 10, 0, FIXED),
  ],
  [
    bar("da", "e1", "a", "b", COLUMN),
    bar("da", "e2", "b", "c", BEAM),
    bar("da", "e3", "c", "d", BEAM),
    bar("da", "e4", "e", "d", COLUMN),
  ],
  [
    load("da", "c1", "e2", { q1: -8, q2: -8, projected: true }),
    load("da", "c2", "e3", { q1: -8, q2: -8, projected: true }),
  ],
);

/**
 * Un pórtico con un apoyo articulado y uno móvil: **isostático**
 * (`3·3 + 3 − 3·4 = 0`). Viento repartido sobre una columna y una carga
 * puntual sobre la viga. Lo que enseña es lo mismo que el triángulo de
 * `/armaduras-2d`: los esfuerzos salen del equilibrio solo, así que **no
 * dependen de la sección** — cambiá la inercia de la viga y los diagramas no
 * se mueven; la deformada sí. Es lo que ningún pórtico hiperestático puede
 * mostrar.
 */
const isostatico = model(
  [node("is", "a", 0, 0, PINNED), node("is", "b", 0, 4), node("is", "c", 6, 4), node("is", "d", 6, 0, ROLLER)],
  [bar("is", "e1", "a", "b", COLUMN), bar("is", "e2", "b", "c", BEAM), bar("is", "e3", "c", "d", COLUMN)],
  [
    load("is", "c1", "e1", { direction: "globalX", q1: 3, q2: 3 }),
    load("is", "c2", "e2", { kind: "point", q1: -20, a: 2 }),
  ],
);

export const examples: Example[] = [
  {
    id: "viga-continua",
    name: "Viga continua de dos tramos",
    description: "Carga uniforme sobre tres apoyos: −qL²/8 sobre el del medio, para cotejar con el libro.",
    model: continua,
  },
  {
    id: "dos-aguas",
    name: "Pórtico a dos aguas",
    description: "Cubierta inclinada cargada por metro de planta: la carga total es q por la luz, no por el largo.",
    model: dosAguas,
  },
  {
    id: "isostatico",
    name: "Pórtico isostático",
    description: "Articulado y móvil, con viento y una puntual: los momentos no dependen de la sección.",
    model: isostatico,
  },
];
