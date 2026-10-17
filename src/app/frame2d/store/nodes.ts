import { atom } from "jotai";
import { produce } from "immer";

import { insertIndex, nextRowName } from "@/lib/row-names";
import { storedModel } from "./persisted-model";

/** Los 3 DOF de un nudo de pórtico plano: traslación x, traslación z, rotación. */
export type NodeAxis = "x" | "z" | "r";

export const nodeAxes: NodeAxis[] = ["x", "z", "r"];

/** Etiqueta de cada DOF local, en el orden que espera el motor. */
export const dofLabels = ["x", "z", "θ"];

export interface NodeRow {
  /** Identificador estable, nunca editable — lo referencian los elementos. */
  id: string;
  /** Etiqueta editable que se muestra en la UI. */
  name: string;
  x: number;
  z: number;
  forceX: number;
  forceZ: number;
  /** Momento aplicado: la "fuerza" del DOF rotacional. */
  momentR: number;
  displacementX: number;
  displacementZ: number;
  /** Giro prescrito: el "desplazamiento" del DOF rotacional. */
  displacementR: number;
  restrainedX: boolean;
  restrainedZ: boolean;
  restrainedR: boolean;
  /**
   * El número que el alumno le pone a cada grado de libertad, si la numeración
   * manual está encendida (`atomUseDofNumbers`). `0` es "sin numerar".
   */
  dofNumberX: number;
  dofNumberZ: number;
  dofNumberR: number;
}

export const seedNodeIds = {
  v1: "seed-v1",
  v2: "seed-v2",
  v3: "seed-v3",
  v4: "seed-v4",
} as const;

const emptyLoads = {
  forceX: 0,
  forceZ: 0,
  momentR: 0,
  displacementX: 0,
  displacementZ: 0,
  displacementR: 0,
  dofNumberX: 0,
  dofNumberZ: 0,
  dofNumberR: 0,
};

const fixed = { restrainedX: true, restrainedZ: true, restrainedR: true };
const freeNode = { restrainedX: false, restrainedZ: false, restrainedR: false };

/**
 * Pórtico de un vano con las dos columnas empotradas y carga horizontal en el
 * nudo superior derecho — el mismo caso que valida
 * `src/lib/engine/frame2d/system.test.ts`, para poder cotejar los resultados
 * de la página contra valores ya verificados.
 */
const initialNodes: NodeRow[] = [
  { id: seedNodeIds.v1, name: "v1", x: 0, z: 0, ...emptyLoads, ...fixed },
  { id: seedNodeIds.v2, name: "v2", x: 0, z: 3.5, ...emptyLoads, ...freeNode },
  { id: seedNodeIds.v3, name: "v3", x: 5, z: 3.5, ...emptyLoads, forceX: 5, ...freeNode },
  { id: seedNodeIds.v4, name: "v4", x: 5, z: 0, ...emptyLoads, ...fixed },
];

/** El ejemplo inicial, siempre en una copia nueva. */
export const seedNodes = (): NodeRow[] => initialNodes.map((n) => ({ ...n }));

// Exportado para `dof-order.ts`, que siembra la numeración al encenderla, y
// para la persistencia, que lo pisa al restaurar.
export const atomNodesBase = atom<NodeRow[]>(storedModel?.nodes ?? seedNodes());

export const atomNodes = atom((get) => get(atomNodesBase));

/** Sin argumento agrega al final; con `afterId`, debajo de esa fila. */
export const atomAddNode = atom(null, (get, set, afterId?: string) => {
  set(
    atomNodesBase,
    produce((draft: NodeRow[]) => {
      draft.splice(insertIndex(draft, afterId), 0, {
        id: crypto.randomUUID(),
        name: nextRowName(
          "v",
          draft.map((n) => n.name),
        ),
        x: 0,
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

export type NodeNumericField =
  | "x"
  | "z"
  | "forceX"
  | "forceZ"
  | "momentR"
  | "displacementX"
  | "displacementZ"
  | "displacementR"
  | "dofNumberX"
  | "dofNumberZ"
  | "dofNumberR";

export const atomUpdateNodeField = atom(
  null,
  (
    get,
    set,
    input: { id: string; field: "name"; value: string } | { id: string; field: NodeNumericField; value: number },
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

/** Mapas eje → campo: la tabla itera los ejes en vez de repetir el JSX por eje. */
export const coordinateFieldByAxis = { x: "x", z: "z" } as const;

export const restrainedFieldByAxis = {
  x: "restrainedX",
  z: "restrainedZ",
  r: "restrainedR",
} as const;

export const forceFieldByAxis = { x: "forceX", z: "forceZ", r: "momentR" } as const;

export const displacementFieldByAxis = {
  x: "displacementX",
  z: "displacementZ",
  r: "displacementR",
} as const;

export const dofNumberFieldByAxis = { x: "dofNumberX", z: "dofNumberZ", r: "dofNumberR" } as const;

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
