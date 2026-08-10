import { atom } from "jotai";
import { produce } from "immer";

/** Los 3 DOF de un nudo de armadura espacial: las tres traslaciones. */
export type NodeAxis = "x" | "y" | "z";

export const nodeAxes: NodeAxis[] = ["x", "y", "z"];

/**
 * Etiqueta de cada DOF local, en el orden que espera el motor. A diferencia de
 * frame2d — que también tiene 3 DOF por nudo — acá los tres son traslaciones de
 * la misma magnitud física, así que no hace falta distinguir fuerza de momento.
 */
export const dofLabels = ["x", "y", "z"];

export interface NodeRow {
  /** Identificador estable, nunca editable — lo referencian los elementos. */
  id: string;
  /** Etiqueta editable que se muestra en la UI. */
  name: string;
  x: number;
  y: number;
  z: number;
  forceX: number;
  forceY: number;
  forceZ: number;
  displacementX: number;
  displacementY: number;
  displacementZ: number;
  restrainedX: boolean;
  restrainedY: boolean;
  restrainedZ: boolean;
}

export const seedNodeIds = {
  a: "seed-a",
  b: "seed-b",
  c: "seed-c",
  d: "seed-d",
} as const;

const emptyLoads = {
  forceX: 0,
  forceY: 0,
  forceZ: 0,
  displacementX: 0,
  displacementY: 0,
  displacementZ: 0,
};

const pinned = { restrainedX: true, restrainedY: true, restrainedZ: true };
const freeNode = { restrainedX: false, restrainedY: false, restrainedZ: false };

/**
 * Armadura espacial de 4 nudos y 6 barras: el mismo dato de ejemplo del
 * programa original (`armor3d/data/data1.ts`) y de la regresión
 * `src/lib/engine/trusses-3d/system.test.ts`, para poder cotejar los resultados
 * de la página contra valores ya verificados. Incluye un asentamiento prescrito
 * de −0.01 en el apoyo `b`, que ejercita la rama `Ur ≠ 0` del motor.
 */
const initialNodes: NodeRow[] = [
  { id: seedNodeIds.a, name: "a", x: 0, y: 0, z: 0, ...emptyLoads, ...pinned },
  { id: seedNodeIds.b, name: "b", x: 3.5, y: 0, z: 0, ...emptyLoads, displacementZ: -0.01, ...pinned },
  {
    id: seedNodeIds.c,
    name: "c",
    x: 3.5,
    y: 2,
    z: 0,
    ...emptyLoads,
    restrainedX: false,
    restrainedY: false,
    restrainedZ: true,
  },
  { id: seedNodeIds.d, name: "d", x: 1.5, y: 1.2, z: 3, ...emptyLoads, forceZ: -25, ...freeNode },
];

const atomNodesBase = atom<NodeRow[]>(initialNodes);

export const atomNodes = atom((get) => get(atomNodesBase));

export const atomAddNode = atom(null, (get, set) => {
  set(
    atomNodesBase,
    produce((draft: NodeRow[]) => {
      draft.push({
        id: crypto.randomUUID(),
        name: `v${draft.length + 1}`,
        x: 0,
        y: 0,
        z: 0,
        ...emptyLoads,
        ...freeNode,
      });
    }),
  );
});

export const atomRemoveNode = atom(null, (get, set, id: string) => {
  set(
    atomNodesBase,
    produce((draft: NodeRow[]) => {
      const index = draft.findIndex((n) => n.id === id);
      if (index !== -1) draft.splice(index, 1);
    }),
  );
});

type NumericField =
  | "x"
  | "y"
  | "z"
  | "forceX"
  | "forceY"
  | "forceZ"
  | "displacementX"
  | "displacementY"
  | "displacementZ";

export const atomUpdateNodeField = atom(
  null,
  (
    get,
    set,
    input: { id: string; field: "name"; value: string } | { id: string; field: NumericField; value: number },
  ) => {
    set(
      atomNodesBase,
      produce((draft: NodeRow[]) => {
        const node = draft.find((n) => n.id === input.id);
        if (!node) return;
        if (input.field === "name") node.name = input.value as string;
        else node[input.field] = input.value as number;
      }),
    );
  },
);

/** Mapas eje → campo: con 3 ejes un `if` por eje ya no escala (mismo criterio que frame2d). */
export const coordinateFieldByAxis = { x: "x", y: "y", z: "z" } as const;

export const restrainedFieldByAxis = {
  x: "restrainedX",
  y: "restrainedY",
  z: "restrainedZ",
} as const;

export const forceFieldByAxis = { x: "forceX", y: "forceY", z: "forceZ" } as const;

export const displacementFieldByAxis = {
  x: "displacementX",
  y: "displacementY",
  z: "displacementZ",
} as const;

export const atomToggleNodeRestrained = atom(
  null,
  (get, set, { id, axis }: { id: string; axis: NodeAxis }) => {
    set(
      atomNodesBase,
      produce((draft: NodeRow[]) => {
        const node = draft.find((n) => n.id === id);
        if (!node) return;
        // System.addNode rechaza fuerza en un DOF restringido y desplazamiento en uno libre.
        const restrained = !node[restrainedFieldByAxis[axis]];
        node[restrainedFieldByAxis[axis]] = restrained;
        if (restrained) node[forceFieldByAxis[axis]] = 0;
        else node[displacementFieldByAxis[axis]] = 0;
      }),
    );
  },
);
