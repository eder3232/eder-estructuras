import type { ModelExample } from "@/components/custom/model-persistence";
import type { ElementRow } from "./elements";
import type { NodeRow } from "./nodes";
import type { PersistedModel } from "./persisted-model";

/**
 * Armaduras espaciales listas para cargar.
 *
 * **Cada una existe para mostrar algo que las demás no muestran** — el criterio
 * de `/armaduras-2d`. El ejemplo inicial (el tetraedro de `armor3d`, que es
 * además la regresión del motor) no está en la lista: es el estado por defecto
 * y se vuelve a él con «Volver al ejemplo inicial». Su lección está fijada en
 * `examples.test.ts` junto con la de estos tres, y **no es la que se le
 * suponía**: es hiperestático de grado 1 y su apoyo `b` baja 1 cm, pero ese
 * descenso **solo no tensiona ninguna barra** — es compatible con un giro
 * rígido alrededor de la recta `a–c` (`a` fijo, `c` restringido solo en z). Es
 * la misma trampa que el asentamiento de `/armaduras-2d`: *hiperestática +
 * asentamiento* no implica esfuerzos. Se midió al armar estos ejemplos
 * (2026-10-16).
 */
export type Example = ModelExample<PersistedModel>;

/** El mismo material en todos: lo que cambia es la estructura. */
const AREA = 0.002;
const ELASTICITY = 2 * 10 ** 7;

interface NodeInput {
  x: number;
  y: number;
  z: number;
  force?: [number, number, number];
  restrained?: [boolean, boolean, boolean];
  displacement?: [number, number, number];
}

const PINNED: [boolean, boolean, boolean] = [true, true, true];

/** Los ids son estables y legibles a propósito: se guardan y se leen a mano al depurar. */
function node(
  prefix: string,
  name: string,
  { x, y, z, force = [0, 0, 0], restrained = [false, false, false], displacement = [0, 0, 0] }: NodeInput,
): NodeRow {
  return {
    id: `${prefix}-${name}`,
    name,
    x,
    y,
    z,
    forceX: force[0],
    forceY: force[1],
    forceZ: force[2],
    displacementX: displacement[0],
    displacementY: displacement[1],
    displacementZ: displacement[2],
    restrainedX: restrained[0],
    restrainedY: restrained[1],
    restrainedZ: restrained[2],
    dofNumberX: 0,
    dofNumberY: 0,
    dofNumberZ: 0,
  };
}

function bar(prefix: string, name: string, from: string, to: string): ElementRow {
  return {
    id: `${prefix}-${name}`,
    name,
    fromNodeId: `${prefix}-${from}`,
    toNodeId: `${prefix}-${to}`,
    area: AREA,
    elasticity: ELASTICITY,
  };
}

const model = (nodes: NodeRow[], elements: ElementRow[]): PersistedModel => ({
  nodes,
  elements,
  restrainedFirst: false,
  useDofNumbers: false,
});

/**
 * Tres patas apoyadas en el suelo con articulaciones fijas y un nudo arriba.
 * **Isostático**: `b + r − 3n = 3 + 9 − 12 = 0`, así que los esfuerzos salen
 * del equilibrio del nudo de arriba —tres ecuaciones, tres barras— y no
 * dependen ni del área ni del material. Es el triángulo de `/armaduras-2d`
 * llevado al espacio, y lo que el tetraedro inicial, hiperestático, no puede
 * mostrar.
 *
 * El nudo de arriba no está sobre el centroide del triángulo de apoyos y la
 * carga tiene una componente horizontal: si no, las tres patas llevarían casi
 * lo mismo y no habría nada que mirar.
 */
const tripode = model(
  [
    node("tri", "a", { x: 0, y: 0, z: 0, restrained: PINNED }),
    node("tri", "b", { x: 4, y: 0, z: 0, restrained: PINNED }),
    node("tri", "c", { x: 2, y: 3, z: 0, restrained: PINNED }),
    node("tri", "d", { x: 1.5, y: 1, z: 3, force: [6, 0, -30] }),
  ],
  [bar("tri", "e1", "a", "d"), bar("tri", "e2", "b", "d"), bar("tri", "e3", "c", "d")],
);

/**
 * El tetraedro inicial con el nudo `d` bajado al plano de los otros tres.
 *
 * **La lección que solo existe en 3D**: un nudo con todas sus barras en un
 * plano no tiene rigidez fuera de él. La cuenta da lo mismo que antes
 * (`g = 6 + 7 − 12 = 1`, hiperestático) porque no mira la geometría, y la
 * matriz dice mecanismo: `d` queda suelto en z, que es justo donde va la
 * carga. Es el «la cuenta es necesaria, no suficiente» de la clasificación, en
 * el caso en que el alumno no lo ve venir.
 *
 * Es el único ejemplo que **no resuelve, a propósito**. Va sin el asentamiento
 * del tetraedro inicial para que lo único distinto sea la `z` de `d`.
 */
const aplastado = model(
  [
    node("apl", "a", { x: 0, y: 0, z: 0, restrained: PINNED }),
    node("apl", "b", { x: 3.5, y: 0, z: 0, restrained: PINNED }),
    node("apl", "c", { x: 3.5, y: 2, z: 0, restrained: [false, false, true] }),
    node("apl", "d", { x: 1.5, y: 1.2, z: 0, force: [0, 0, -25] }),
  ],
  [
    bar("apl", "e1", "a", "b"),
    bar("apl", "e2", "b", "c"),
    bar("apl", "e3", "a", "c"),
    bar("apl", "e4", "a", "d"),
    bar("apl", "e5", "b", "d"),
    bar("apl", "e6", "c", "d"),
  ],
);

/**
 * Una torre de libro: base cuadrada de 2 m con los cuatro apoyos fijos, un
 * anillo a 3 m arriostrado en sus cuatro caras, y un remate piramidal a 4.5 m.
 * Viento sobre una cara y peso en la punta.
 *
 * Está para **ejercitar las herramientas de matrices grandes**: 9 nudos son 27
 * grados de libertad, así que `F = K·U` arranca con `K` como mapa (pasados 19)
 * y los pasos de ensamblaje arrancan cerrados (pasados 12). Con 16 barras, es
 * además el primer ejemplo donde contar a mano ya no es instantáneo.
 */
const torre = model(
  [
    node("tor", "a1", { x: 0, y: 0, z: 0, restrained: PINNED }),
    node("tor", "a2", { x: 2, y: 0, z: 0, restrained: PINNED }),
    node("tor", "a3", { x: 2, y: 2, z: 0, restrained: PINNED }),
    node("tor", "a4", { x: 0, y: 2, z: 0, restrained: PINNED }),
    node("tor", "b1", { x: 0, y: 0, z: 3, force: [4, 0, 0] }),
    node("tor", "b2", { x: 2, y: 0, z: 3 }),
    node("tor", "b3", { x: 2, y: 2, z: 3 }),
    node("tor", "b4", { x: 0, y: 2, z: 3, force: [4, 0, 0] }),
    node("tor", "c", { x: 1, y: 1, z: 4.5, force: [2, 0, -20] }),
  ],
  [
    // Montantes.
    bar("tor", "e1", "a1", "b1"),
    bar("tor", "e2", "a2", "b2"),
    bar("tor", "e3", "a3", "b3"),
    bar("tor", "e4", "a4", "b4"),
    // Anillo.
    bar("tor", "e5", "b1", "b2"),
    bar("tor", "e6", "b2", "b3"),
    bar("tor", "e7", "b3", "b4"),
    bar("tor", "e8", "b4", "b1"),
    // Una diagonal por cara.
    bar("tor", "e9", "a1", "b2"),
    bar("tor", "e10", "a2", "b3"),
    bar("tor", "e11", "a3", "b4"),
    bar("tor", "e12", "a4", "b1"),
    // Remate.
    bar("tor", "e13", "b1", "c"),
    bar("tor", "e14", "b2", "c"),
    bar("tor", "e15", "b3", "c"),
    bar("tor", "e16", "b4", "c"),
  ],
);

export const examples: Example[] = [
  {
    id: "tripode",
    name: "Trípode isostático",
    description: "3 barras. Los esfuerzos salen del equilibrio del nudo de arriba y no dependen del área ni del material.",
    model: tripode,
  },
  {
    id: "aplastado",
    name: "Tetraedro aplastado",
    description:
      "El nudo de arriba bajado al plano de los otros: la cuenta dice hiperestático y la matriz dice mecanismo.",
    model: aplastado,
  },
  {
    id: "torre",
    name: "Torre de 9 nudos",
    description: "27 grados de libertad: K se muestra como mapa y los pasos de ensamblaje se abren de a uno.",
    model: torre,
  },
];
